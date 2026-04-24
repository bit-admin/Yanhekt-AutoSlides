import axios, { AxiosError } from 'axios';
import Bottleneck from 'bottleneck';
import { app } from 'electron';
import { ConfigService } from './configService';

const DEBUG = false;

const debugLog = (...args: unknown[]) => {
  if (DEBUG) console.log('[LLM:DEBUG]', ...args);
};

const debugError = (...args: unknown[]) => {
  if (DEBUG) console.error('[LLM:DEBUG:ERROR]', ...args);
};

// OpenAI-compatible message format
export interface ContentPart {
  type: 'text' | 'image_url';
  text?: string;
  image_url?: {
    url: string;
    detail?: 'low' | 'high' | 'auto';
  };
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string | ContentPart[];
}

export interface ChatCompletionResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: {
    index: number;
    message: { role: string; content: string };
    finish_reason: string;
  }[];
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export type LLMProviderId = 'builtin' | 'copilot' | 'modelscope' | 'lm_studio' | 'other';

// Stable identity for session-exhaustion tracking. For hosted providers this is just
// the provider id; for 'other' we also fold in the base URL so two different custom
// endpoints don't share an exhausted set.
function providerScopeKey(providerId: LLMProviderId, baseUrl: string): string {
  if (providerId === 'other') return `other::${baseUrl}`;
  return providerId;
}

export type LLMErrorKind =
  | 'rate_limited'         // HTTP 429, generic rate limit
  | 'quota_exceeded'       // ModelScope per-model daily quota — chain can retry next model
  | 'auth_failed'          // 401/403 (not cloudflare)
  | 'cloudflare_blocked'   // 403 with Cloudflare challenge page
  | 'timeout'              // ETIMEDOUT / ECONNABORTED
  | 'network'              // ECONNRESET / ENOTFOUND / etc.
  | 'server_error'         // 5xx
  | 'bad_request'          // other 4xx
  | 'parse_failed'         // response 200 but body not parseable (reserved for callers)
  | 'unknown';

export interface LLMError {
  kind: LLMErrorKind;
  status?: number;
  message: string;
  modelAttempted?: string;
  rawProviderMessage?: string;
}

export type LLMResult<T> =
  | { ok: true; value: T; modelUsed: string }
  | { ok: false; error: LLMError };

export interface ChatCompletionRequestInput {
  baseUrl: string;
  apiKey: string;
  messages: ChatMessage[];
  headers?: Record<string, string>;
  timeoutMs?: number;
  maxTokens?: number;
  temperature?: number;
}

const BUILTIN_API_BASE_URL = 'https://openai.ruc.edu.kg';
const BUILTIN_FALLBACK_MODEL = 'gpt-4.1';

const QUOTA_EXCEEDED_SIGNATURE = /exceeded today'?s quota for model/i;

export class LLMApiService {
  private configService: ConfigService;
  private limiter: Bottleneck;
  // Session-scoped: models that returned quota_exceeded in this app session.
  // Keyed by `${providerScope}::${modelName}`. Cleared on launch and on config changes.
  private exhaustedModels: Set<string> = new Set();

  constructor(configService: ConfigService) {
    this.configService = configService;

    const config = this.configService.getAIFilteringConfig();
    const rateLimit = config.rateLimit || 10;
    const maxConcurrent = config.maxConcurrent || 1;
    const minTime = config.minTime || 6000;

    this.limiter = new Bottleneck({
      maxConcurrent,
      minTime,
      reservoir: rateLimit,
      reservoirRefreshAmount: rateLimit,
      reservoirRefreshInterval: 60000
    });

    this.limiter.on('depleted', () => {
      console.log('[LLM] Rate limit reservoir depleted, waiting for refresh');
    });
  }

  updateRateLimitConfig(): void {
    const config = this.configService.getAIFilteringConfig();
    const rateLimit = config.rateLimit || 10;
    const maxConcurrent = config.maxConcurrent || 1;
    const minTime = config.minTime || 6000;
    this.limiter.updateSettings({
      reservoir: rateLimit,
      reservoirRefreshAmount: rateLimit,
      maxConcurrent,
      minTime
    });
    debugLog('Rate limit config updated', { rateLimit, maxConcurrent, minTime });
  }

  getRateLimit(): number {
    const config = this.configService.getAIFilteringConfig();
    return config.rateLimit || 10;
  }

  /** Clear the session-scoped exhausted-model set. Called when API URL/key/chain changes. */
  resetExhaustedModels(providerId?: LLMProviderId, baseUrl?: string): void {
    if (!providerId) {
      this.exhaustedModels.clear();
      return;
    }
    const scope = providerScopeKey(providerId, baseUrl || '');
    const prefix = `${scope}::`;
    for (const key of Array.from(this.exhaustedModels)) {
      if (key.startsWith(prefix)) this.exhaustedModels.delete(key);
    }
  }

  /** Read-only view of models currently marked exhausted for the given provider. */
  getExhaustedModels(providerId: LLMProviderId, baseUrl: string): string[] {
    const scope = providerScopeKey(providerId, baseUrl);
    const prefix = `${scope}::`;
    const result: string[] = [];
    for (const key of this.exhaustedModels) {
      if (key.startsWith(prefix)) result.push(key.slice(prefix.length));
    }
    return result;
  }

  private markExhausted(providerId: LLMProviderId, baseUrl: string, model: string): void {
    this.exhaustedModels.add(`${providerScopeKey(providerId, baseUrl)}::${model}`);
  }

  private isExhausted(providerId: LLMProviderId, baseUrl: string, model: string): boolean {
    return this.exhaustedModels.has(`${providerScopeKey(providerId, baseUrl)}::${model}`);
  }

  private isCloudflareBlocked(data: unknown): boolean {
    const dataStr = typeof data === 'string' ? data : JSON.stringify(data);
    return dataStr.includes('<!DOCTYPE') ||
           dataStr.includes('<html') ||
           dataStr.includes('Just a moment') ||
           dataStr.includes('cf-mitigated');
  }

  /**
   * Fetch the model name for the built-in service.
   * @throws Error with 'cloudflareBlocked' or 'fetchFailed' for the renderer to branch on.
   */
  async getBuiltinModelName(token: string): Promise<string> {
    try {
      const response = await axios.get(`${BUILTIN_API_BASE_URL}/model`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'User-Agent': `${app.getName()}/${app.getVersion()}`
        },
        timeout: 10000
      });

      if (this.isCloudflareBlocked(response.data)) {
        console.error('[LLM] Received Cloudflare challenge page');
        throw new Error('cloudflareBlocked');
      }

      if (response.data && response.data.model) return response.data.model;
      return BUILTIN_FALLBACK_MODEL;
    } catch (error) {
      if (error instanceof Error && error.message === 'cloudflareBlocked') throw error;
      if (error instanceof AxiosError && error.response && this.isCloudflareBlocked(error.response.data)) {
        throw new Error('cloudflareBlocked');
      }
      console.error('[LLM] Failed to fetch built-in model name:', error);
      throw new Error('fetchFailed');
    }
  }

  /**
   * Make one OpenAI-compatible chat completion request. Rate-limited via Bottleneck.
   * Returns LLMResult — errors are typed, not thrown.
   */
  private async makeChatCompletionRequest(
    model: string,
    input: ChatCompletionRequestInput
  ): Promise<LLMResult<ChatCompletionResponse>> {
    return this.limiter.schedule(async () => {
      const hasImages = input.messages.some(msg =>
        Array.isArray(msg.content) && msg.content.some(item => item.type === 'image_url')
      );

      const headers = input.headers || {
        'Authorization': `Bearer ${input.apiKey}`,
        'Content-Type': 'application/json'
      };

      const requestBody = {
        model,
        messages: input.messages,
        max_tokens: input.maxTokens ?? 100,
        temperature: input.temperature ?? 0
      };

      debugLog('Chat completion request', {
        url: `${input.baseUrl}/chat/completions`,
        model,
        hasImages,
        messageCount: input.messages.length
      });

      const startTime = Date.now();
      try {
        const response = await axios.post<ChatCompletionResponse>(
          `${input.baseUrl}/chat/completions`,
          requestBody,
          { headers, timeout: input.timeoutMs ?? 30000 }
        );
        debugLog('Chat completion response', {
          duration: `${Date.now() - startTime}ms`,
          status: response.status,
          finishReason: response.data.choices[0]?.finish_reason
        });
        return { ok: true, value: response.data, modelUsed: model };
      } catch (error) {
        debugError('Chat completion failed', { duration: `${Date.now() - startTime}ms`, error });
        return { ok: false, error: this.classifyError(error, model) };
      }
    });
  }

  private classifyError(error: unknown, modelAttempted: string): LLMError {
    if (error instanceof AxiosError) {
      const status = error.response?.status;
      const responseData = error.response?.data;
      const rawMessage =
        (responseData && typeof responseData === 'object' &&
          (responseData as { error?: { message?: string } }).error?.message) ||
        (typeof responseData === 'string' ? responseData : undefined) ||
        error.message;

      if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
        return { kind: 'timeout', status, message: error.message, modelAttempted, rawProviderMessage: rawMessage };
      }

      if (status === 429) {
        // Distinguish ModelScope per-model daily quota from generic 429
        const bodyStr = typeof responseData === 'string' ? responseData : JSON.stringify(responseData || '');
        if (QUOTA_EXCEEDED_SIGNATURE.test(bodyStr) || QUOTA_EXCEEDED_SIGNATURE.test(rawMessage || '')) {
          return {
            kind: 'quota_exceeded',
            status,
            message: `Model quota exceeded: ${modelAttempted}`,
            modelAttempted,
            rawProviderMessage: rawMessage
          };
        }
        return { kind: 'rate_limited', status, message: rawMessage || 'Rate limited', modelAttempted, rawProviderMessage: rawMessage };
      }

      if (status === 401 || status === 403) {
        if (status === 403 && this.isCloudflareBlocked(responseData)) {
          return { kind: 'cloudflare_blocked', status, message: 'Cloudflare challenge', modelAttempted };
        }
        return { kind: 'auth_failed', status, message: rawMessage || 'Auth failed', modelAttempted, rawProviderMessage: rawMessage };
      }

      if (typeof status === 'number' && status >= 500) {
        return { kind: 'server_error', status, message: rawMessage || `Server error ${status}`, modelAttempted, rawProviderMessage: rawMessage };
      }

      if (typeof status === 'number' && status >= 400) {
        return { kind: 'bad_request', status, message: rawMessage || `Bad request ${status}`, modelAttempted, rawProviderMessage: rawMessage };
      }

      if (!error.response) {
        return { kind: 'network', message: error.message, modelAttempted };
      }

      return { kind: 'unknown', status, message: error.message, modelAttempted, rawProviderMessage: rawMessage };
    }

    if (error instanceof Error) {
      return { kind: 'unknown', message: error.message, modelAttempted };
    }
    return { kind: 'unknown', message: 'Unknown error', modelAttempted };
  }

  /**
   * Iterate through a model list, trying each one. On quota_exceeded, mark the model exhausted
   * for this session and try the next. On any other error, return immediately (don't cycle).
   *
   * Single-model lists behave identically to makeChatCompletionRequest — no chain logic applies.
   */
  async runWithModelChain(
    providerId: LLMProviderId,
    input: ChatCompletionRequestInput,
    models: string[],
    options?: { onModelExhausted?: (model: string) => void }
  ): Promise<LLMResult<ChatCompletionResponse>> {
    if (models.length === 0) {
      return { ok: false, error: { kind: 'unknown', message: 'No models configured' } };
    }

    // Filter out already-exhausted models in this session
    const candidates = models.filter(m => !this.isExhausted(providerId, input.baseUrl, m));
    if (candidates.length === 0) {
      return {
        ok: false,
        error: {
          kind: 'quota_exceeded',
          message: 'all_models_exhausted',
          rawProviderMessage: `All ${models.length} configured model(s) have exceeded today's quota in this session.`
        }
      };
    }

    let lastError: LLMError | null = null;
    for (const model of candidates) {
      const result = await this.makeChatCompletionRequest(model, input);
      if (result.ok) return result;

      lastError = result.error;
      if (result.error.kind === 'quota_exceeded') {
        this.markExhausted(providerId, input.baseUrl, model);
        options?.onModelExhausted?.(model);
        console.warn(`[LLM] Model quota exceeded, trying next in chain: ${model}`);
        continue;
      }
      // Non-quota errors don't benefit from trying a different model — fail fast.
      return result;
    }

    return { ok: false, error: lastError || { kind: 'unknown', message: 'Chain exhausted without response' } };
  }
}
