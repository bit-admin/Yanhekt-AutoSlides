import axios, { AxiosError } from 'axios';
import Bottleneck from 'bottleneck';
import { app } from 'electron';
import { ConfigService } from './configService';

const DEBUG = true;

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
  | 'rate_limited'           // HTTP 429, generic rate limit — auto-retried transparently
  | 'upstream_rate_limited'  // HTTP 502 — our proxy/gateway is being throttled — auto-retried silently
  | 'quota_exceeded'         // ModelScope per-model daily quota — chain can retry next model
  | 'auth_failed'            // 401/403 (not cloudflare)
  | 'cloudflare_blocked'     // 403 with Cloudflare challenge page
  | 'timeout'                // ETIMEDOUT / ECONNABORTED
  | 'network'                // ECONNRESET / ENOTFOUND / etc.
  | 'service_unavailable'    // HTTP 503 — backend intentionally down (built-in MODEL unset, etc.)
  | 'server_error'           // other 5xx
  | 'bad_request'            // other 4xx
  | 'parse_failed'           // response 2xx but body missing choices / has embedded error
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
// Built-in worker sentinel when MODEL env var is unset (returned at HTTP 503).
const BUILTIN_TEMP_UNAVAILABLE_MODEL = 'TEMP_UNAVAILABLE';

// Transport-level retry config for transient rate-limit errors (429 generic, 502 upstream).
// ModelScope per-model daily 429 (quota_exceeded) is NOT retried here — the chain handles it.
// HTTP 503 is NOT retried (signals backend intentionally down).
const RATE_LIMIT_RETRY_MAX = 4;          // up to 4 attempts after the initial one
const RATE_LIMIT_RETRY_BASE_MS = 2000;   // 2s base
const RATE_LIMIT_RETRY_MAX_MS = 30000;   // cap single backoff at 30s
const RATE_LIMIT_RETRY_JITTER_MS = 500;  // random jitter added to each backoff

// Some OpenAI-compatible gateways return HTTP 200 with `choices:null` and zero
// usage when the selected model cannot produce a response. Retry once for a
// transient provider hiccup; ModelScope chain handling can then try the next model.
const EMPTY_CHOICES_RETRY_MAX = 1;
const EMPTY_CHOICES_RETRY_DELAY_MS = 1500;

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Parse a Retry-After header value. Supports seconds (integer) and HTTP-date forms.
 * Returns a non-negative ms delay, or null if unparseable.
 */
function parseRetryAfter(headerValue: unknown): number | null {
  if (!headerValue) return null;
  const v = String(headerValue).trim();
  // Integer seconds
  const asInt = Number(v);
  if (Number.isFinite(asInt) && asInt >= 0) return Math.min(asInt * 1000, 300_000);
  // HTTP-date form
  const parsed = Date.parse(v);
  if (!Number.isNaN(parsed)) {
    const delta = parsed - Date.now();
    if (delta > 0) return Math.min(delta, 300_000);
  }
  return null;
}

function computeBackoffMs(attempt: number, retryAfterMs: number | null): number {
  if (retryAfterMs != null) return retryAfterMs;
  const expo = Math.min(RATE_LIMIT_RETRY_BASE_MS * Math.pow(2, attempt - 1), RATE_LIMIT_RETRY_MAX_MS);
  return expo + Math.floor(Math.random() * RATE_LIMIT_RETRY_JITTER_MS);
}

function hasEmbeddedError(data: unknown): string | null {
  if (!data || typeof data !== 'object') return null;
  const maybeError = (data as { error?: unknown }).error;
  if (typeof maybeError === 'string' && maybeError.length > 0) return maybeError;
  if (maybeError && typeof maybeError === 'object') {
    const msg = (maybeError as { message?: unknown }).message;
    if (typeof msg === 'string' && msg.length > 0) return msg;
  }
  return null;
}

function isEmptyChoicesResponse(data: unknown): boolean {
  if (!data || typeof data !== 'object') return false;
  const response = data as {
    choices?: unknown;
    usage?: { total_tokens?: unknown; completion_tokens?: unknown; prompt_tokens?: unknown };
    object?: unknown;
    created?: unknown;
  };
  const usage = response.usage;
  const zeroUsage =
    usage &&
    usage.total_tokens === 0 &&
    usage.completion_tokens === 0 &&
    usage.prompt_tokens === 0;
  return response.choices == null && (zeroUsage || response.object === '' || response.created === 0);
}

function isEmptyChoicesError(error: LLMError): boolean {
  return (
    error.kind === 'parse_failed' &&
    (
      error.message.includes('choices:null') ||
      /"choices"\s*:\s*null/.test(error.rawProviderMessage || '')
    )
  );
}

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

      // Worker sentinel: MODEL env var unset — returned at 200 in some edge cases
      if (response.data && response.data.model === BUILTIN_TEMP_UNAVAILABLE_MODEL) {
        throw new Error('temporarilyUnavailable');
      }

      if (response.data && response.data.model) return response.data.model;
      return BUILTIN_FALLBACK_MODEL;
    } catch (error) {
      if (error instanceof Error && error.message === 'cloudflareBlocked') throw error;
      if (error instanceof Error && error.message === 'temporarilyUnavailable') throw error;

      if (error instanceof AxiosError && error.response) {
        if (this.isCloudflareBlocked(error.response.data)) {
          throw new Error('cloudflareBlocked');
        }
        const data = error.response.data as { model?: string; error?: string } | undefined;
        // Worker returns 503 with body { model: 'TEMP_UNAVAILABLE' } when env.MODEL is unset
        if (error.response.status === 503 && data?.model === BUILTIN_TEMP_UNAVAILABLE_MODEL) {
          throw new Error('temporarilyUnavailable');
        }
        // Also accept generic 503 Service Unavailable signature on /model
        if (error.response.status === 503) {
          throw new Error('temporarilyUnavailable');
        }
      }
      console.error('[LLM] Failed to fetch built-in model name:', error);
      throw new Error('fetchFailed');
    }
  }

  /**
   * Single axios call + 2xx-body validation. Returns a typed LLMResult. On transient
   * rate-limit kinds, the caller may decide to retry. Unknown axios errors surface a
   * `retryAfterMs` on the error object when the server sent a Retry-After header.
   */
  private async attemptChatCompletion(
    model: string,
    input: ChatCompletionRequestInput
  ): Promise<LLMResult<ChatCompletionResponse> & { retryAfterMs?: number }> {
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

      const data = response.data as ChatCompletionResponse | undefined;
      const embeddedError = hasEmbeddedError(data);
      const emptyChoicesResponse = isEmptyChoicesResponse(data);
      const choicesMissing =
        !data ||
        typeof data !== 'object' ||
        !Array.isArray((data as ChatCompletionResponse).choices) ||
        (data as ChatCompletionResponse).choices.length === 0;

      if (embeddedError || choicesMissing) {
        debugError('Chat completion returned malformed 2xx', {
          duration: `${Date.now() - startTime}ms`,
          status: response.status,
          embeddedError,
          choicesMissing
        });
        return {
          ok: false,
          error: {
            kind: 'parse_failed',
            status: response.status,
            message: embeddedError || (emptyChoicesResponse
              ? 'Provider returned empty choices (choices:null)'
              : 'Response missing choices array'),
            modelAttempted: model,
            rawProviderMessage:
              typeof data === 'string' ? data : JSON.stringify(data ?? null)
          }
        };
      }

      debugLog('Chat completion response', {
        duration: `${Date.now() - startTime}ms`,
        status: response.status,
        finishReason: data.choices[0]?.finish_reason
      });
      return { ok: true, value: data, modelUsed: model };
    } catch (error) {
      debugError('Chat completion failed', { duration: `${Date.now() - startTime}ms`, error });
      const result: LLMResult<ChatCompletionResponse> & { retryAfterMs?: number } = {
        ok: false,
        error: this.classifyError(error, model)
      };
      if (error instanceof AxiosError && error.response) {
        const retryAfter = parseRetryAfter(
          error.response.headers?.['retry-after'] ?? error.response.headers?.['Retry-After']
        );
        if (retryAfter != null) result.retryAfterMs = retryAfter;
      }
      return result;
    }
  }

  /**
   * Make one OpenAI-compatible chat completion request. Rate-limited via Bottleneck.
   * Automatically retries transient rate-limit errors (429 generic, 502 upstream) with
   * exponential backoff + jitter, honoring Retry-After when present. Retries hold the
   * Bottleneck slot so concurrent callers don't pile on during the backoff.
   *
   * Returns LLMResult — typed errors, never thrown.
   */
  private async makeChatCompletionRequest(
    model: string,
    input: ChatCompletionRequestInput
  ): Promise<LLMResult<ChatCompletionResponse>> {
    return this.limiter.schedule(async () => {
      let attempt = 0;
      // attempt 0 = initial, attempts 1..RATE_LIMIT_RETRY_MAX = retries
      for (;;) {
        const result = await this.attemptChatCompletion(model, input);
        if (result.ok) return result;

        const kind = result.error.kind;
        const isTransientRateLimit = kind === 'rate_limited' || kind === 'upstream_rate_limited';
        const isRetryableEmptyChoices = isEmptyChoicesError(result.error);
        const retryMax = isTransientRateLimit
          ? RATE_LIMIT_RETRY_MAX
          : (isRetryableEmptyChoices ? EMPTY_CHOICES_RETRY_MAX : 0);

        if (attempt >= retryMax) {
          return { ok: result.ok, error: result.error } as LLMResult<ChatCompletionResponse>;
        }

        attempt += 1;
        const delay = isTransientRateLimit
          ? computeBackoffMs(attempt, result.retryAfterMs ?? null)
          : EMPTY_CHOICES_RETRY_DELAY_MS + Math.floor(Math.random() * RATE_LIMIT_RETRY_JITTER_MS);
        console.log(
          `[LLM] ${isRetryableEmptyChoices ? 'empty_choices' : kind} on ${model} — retry ${attempt}/${retryMax} in ${delay}ms` +
            (result.retryAfterMs != null ? ` (Retry-After honored)` : '')
        );
        await sleep(delay);
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

      if (status === 502) {
        // Built-in proxy returns 502 when its upstream is rate-limiting us. Retried silently.
        return {
          kind: 'upstream_rate_limited',
          status,
          message: rawMessage || 'Upstream rate limit',
          modelAttempted,
          rawProviderMessage: rawMessage
        };
      }

      if (status === 503) {
        return {
          kind: 'service_unavailable',
          status,
          message: rawMessage || 'Service Unavailable',
          modelAttempted,
          rawProviderMessage: rawMessage
        };
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
   * for this session and try the next. ModelScope empty-choices responses also advance to
   * the next model for this request, but are not marked session-exhausted.
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
      if (providerId === 'modelscope' && isEmptyChoicesError(result.error)) {
        console.warn(`[LLM] Model returned empty choices, trying next in chain: ${model}`);
        continue;
      }
      // Other errors don't benefit from trying a different model — fail fast.
      return result;
    }

    return { ok: false, error: lastError || { kind: 'unknown', message: 'Chain exhausted without response' } };
  }
}
