import { ConfigService, MODELSCOPE_API_BASE_URL } from './configService';
import { AIPromptsService, AIPromptType } from './aiPromptsService';
import { CopilotService } from './copilotService';
import {
  LLMApiService,
  LLMProviderId,
  LLMError,
  ChatMessage,
  ContentPart,
  ChatCompletionResponse,
  LLMResult
} from './llmApiService';
import { app } from 'electron';

const DEBUG = false;

const debugLog = (...args: unknown[]) => {
  if (DEBUG) console.log('[AI:DEBUG]', ...args);
};

const debugError = (...args: unknown[]) => {
  if (DEBUG) console.error('[AI:DEBUG:ERROR]', ...args);
};

export type ClassificationValue = 'slide' | 'not_slide' | 'may_be_slide_edit';

export interface ClassificationResult {
  classification: ClassificationValue;
}

export interface BatchClassificationResult {
  [key: string]: ClassificationValue;
}

export interface AIFilteringResult {
  success: boolean;
  result?: ClassificationResult | BatchClassificationResult;
  // Human-readable error string. Kept for back-compat with existing renderer
  // parseAIError() regex-matching. New code should prefer `errorKind`.
  error?: string;
  // Typed error kind for future switch-based error surfacing.
  // TODO(notification-system): downstream (usePostProcessing, postProcessingService,
  // useOfflineProcessing) currently treats error results by leaving images classified
  // as 'slide'. Route `errorKind` through a session notification channel + surface in
  // Results View when we add the proper error-display system.
  errorKind?: LLMError['kind'];
  modelUsed?: string;
}

// Built-in service configuration
const BUILTIN_API_BASE_URL = 'https://openai.ruc.edu.kg';
const BUILTIN_FALLBACK_MODEL = 'gpt-4.1';

export class AIFilteringService {
  private configService: ConfigService;
  private aiPromptsService: AIPromptsService;
  private copilotService: CopilotService;
  private llm: LLMApiService;

  constructor(
    configService: ConfigService,
    aiPromptsService: AIPromptsService,
    llmApiService: LLMApiService
  ) {
    this.configService = configService;
    this.aiPromptsService = aiPromptsService;
    this.copilotService = new CopilotService();
    this.llm = llmApiService;
  }

  updateRateLimitConfig(): void {
    this.llm.updateRateLimitConfig();
  }

  getRateLimit(): number {
    return this.llm.getRateLimit();
  }

  /**
   * Resolve provider/URL/key/model-chain for the current service type.
   */
  private resolveRequestContext(): {
    providerId: LLMProviderId;
    baseUrl: string;
    models: string[];      // Model chain (primary first). Single-element for non-ModelScope.
    serviceType: 'builtin' | 'copilot' | 'custom';
  } {
    const config = this.configService.getAIFilteringConfig();

    if (config.serviceType === 'builtin') {
      return {
        providerId: 'builtin',
        baseUrl: BUILTIN_API_BASE_URL,
        models: [BUILTIN_FALLBACK_MODEL], // will be swapped per-call via modelOverride
        serviceType: 'builtin'
      };
    }

    if (config.serviceType === 'copilot') {
      return {
        providerId: 'copilot',
        baseUrl: 'https://api.githubcopilot.com',
        models: [config.copilotModelName || 'gpt-4.1'],
        serviceType: 'copilot'
      };
    }

    // Custom service
    const providerId: LLMProviderId = config.customProviderId;
    let models: string[];
    if (providerId === 'modelscope') {
      models = config.customModelChain.length > 0
        ? [...config.customModelChain]
        : (config.customModelName ? [config.customModelName] : []);
    } else {
      models = config.customModelName ? [config.customModelName] : [];
    }
    return { providerId, baseUrl: config.customApiBaseUrl, models, serviceType: 'custom' };
  }

  /**
   * Build the auth-resolved request headers, handling Copilot token exchange and
   * built-in User-Agent requirements.
   */
  private async buildRequestHeaders(
    providerId: LLMProviderId,
    baseUrl: string,
    token: string | undefined,
    hasImages: boolean
  ): Promise<{ headers: Record<string, string>; apiKey: string }> {
    const config = this.configService.getAIFilteringConfig();

    if (providerId === 'copilot') {
      const ghoToken = config.copilotGhoToken;
      if (!ghoToken) throw new Error('Copilot gho_ token not configured');
      const apiKey = await this.copilotService.getApiToken(ghoToken);
      return { headers: this.copilotService.buildCopilotHeaders(apiKey, hasImages), apiKey };
    }

    if (providerId === 'builtin') {
      const apiKey = token || '';
      return {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'User-Agent': `${app.getName()}/${app.getVersion()}`
        },
        apiKey
      };
    }

    // Custom (modelscope / lm_studio / other)
    const apiKey = config.customApiKey;
    return {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      apiKey
    };
  }

  /**
   * Fetch the model name for the built-in service
   */
  async getBuiltinModelName(token: string): Promise<string> {
    return this.llm.getBuiltinModelName(token);
  }

  private parseClassificationResult(content: string, allowEdit: boolean): ClassificationResult | null {
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        const raw = parsed.classification;
        if (raw === 'slide' || raw === 'not_slide') return { classification: raw };
        if (raw === 'may_be_slide_edit') {
          return { classification: allowEdit ? 'may_be_slide_edit' : 'not_slide' };
        }
      }
    } catch (error) {
      console.error('Failed to parse classification result:', error);
    }
    return null;
  }

  private parseBatchClassificationResult(content: string, allowEdit: boolean): BatchClassificationResult | null {
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        const result: BatchClassificationResult = {};
        for (const [key, value] of Object.entries(parsed)) {
          if (value === 'slide' || value === 'not_slide') {
            result[key] = value as ClassificationValue;
          } else if (value === 'may_be_slide_edit') {
            result[key] = allowEdit ? 'may_be_slide_edit' : 'not_slide';
          }
        }
        if (Object.keys(result).length > 0) return result;
      }
    } catch (error) {
      console.error('Failed to parse batch classification result:', error);
    }
    return null;
  }

  /**
   * Convert an LLMError to the legacy `{ success: false, error: string }` shape that
   * downstream renderer code parses. Keeps back-compat with the existing parseAIError()
   * regex matching while also exposing the typed `errorKind`.
   */
  private toFailureResult(error: LLMError): AIFilteringResult {
    const message = error.status
      ? `HTTP ${error.status}: ${error.rawProviderMessage || error.message}`
      : error.message;
    return { success: false, error: message, errorKind: error.kind };
  }

  async classifySingleImage(
    base64Image: string,
    type: AIPromptType,
    token?: string,
    modelOverride?: string
  ): Promise<AIFilteringResult> {
    debugLog('classifySingleImage called', { type, hasToken: !!token, modelOverride });

    try {
      const ctx = this.resolveRequestContext();
      const distinguish = this.configService.getDistinguishMaybeSlide();
      const variant = distinguish ? 'distinguish' : 'simple';
      const prompt = this.aiPromptsService.getPrompt(type, variant);

      const imageUrl = base64Image.startsWith('data:')
        ? base64Image
        : `data:image/png;base64,${base64Image}`;

      const messages: ChatMessage[] = [
        {
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            { type: 'image_url', image_url: { url: imageUrl, detail: 'low' } }
          ]
        }
      ];

      const { headers, apiKey } = await this.buildRequestHeaders(ctx.providerId, ctx.baseUrl, token, true);

      // modelOverride forces a specific model and bypasses the chain; otherwise use the
      // resolved chain (single-element for non-ModelScope providers, so no chain logic runs).
      const models = modelOverride ? [modelOverride] : ctx.models;
      if (models.length === 0) {
        return { success: false, error: 'No model configured', errorKind: 'unknown' };
      }

      const result: LLMResult<ChatCompletionResponse> = await this.llm.runWithModelChain(
        ctx.providerId,
        { baseUrl: ctx.baseUrl, apiKey, messages, headers },
        models
      );

      if (!result.ok) {
        debugError('classifySingleImage LLM error', result.error);
        return this.toFailureResult(result.error);
      }

      const responseContent = result.value.choices?.[0]?.message?.content || '';
      const parsed = this.parseClassificationResult(responseContent, distinguish);
      if (parsed) {
        return { success: true, result: parsed, modelUsed: result.modelUsed };
      }
      return {
        success: false,
        error: `Failed to parse AI response: ${responseContent}`,
        errorKind: 'parse_failed',
        modelUsed: result.modelUsed
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return { success: false, error: errorMessage, errorKind: 'unknown' };
    }
  }

  async classifyMultipleImages(
    base64Images: string[],
    type: AIPromptType,
    token?: string,
    modelOverride?: string
  ): Promise<AIFilteringResult> {
    debugLog('classifyMultipleImages called', {
      imageCount: base64Images.length, type, hasToken: !!token, modelOverride
    });

    try {
      const ctx = this.resolveRequestContext();
      const distinguish = this.configService.getDistinguishMaybeSlide();
      const variant = distinguish ? 'distinguish' : 'simple';
      const prompt = this.aiPromptsService.getPrompt(type, variant);

      const contentParts: ContentPart[] = [{ type: 'text', text: prompt }];
      for (const base64Image of base64Images) {
        const imageUrl = base64Image.startsWith('data:')
          ? base64Image
          : `data:image/png;base64,${base64Image}`;
        contentParts.push({ type: 'image_url', image_url: { url: imageUrl, detail: 'low' } });
      }
      const messages: ChatMessage[] = [{ role: 'user', content: contentParts }];

      const { headers, apiKey } = await this.buildRequestHeaders(ctx.providerId, ctx.baseUrl, token, true);

      const models = modelOverride ? [modelOverride] : ctx.models;
      if (models.length === 0) {
        return { success: false, error: 'No model configured', errorKind: 'unknown' };
      }

      const result: LLMResult<ChatCompletionResponse> = await this.llm.runWithModelChain(
        ctx.providerId,
        { baseUrl: ctx.baseUrl, apiKey, messages, headers },
        models
      );

      if (!result.ok) {
        debugError('classifyMultipleImages LLM error', result.error);
        return this.toFailureResult(result.error);
      }

      const responseContent = result.value.choices?.[0]?.message?.content || '';
      const parsed = this.parseBatchClassificationResult(responseContent, distinguish);
      if (parsed) {
        return { success: true, result: parsed, modelUsed: result.modelUsed };
      }
      return {
        success: false,
        error: `Failed to parse AI batch response: ${responseContent}`,
        errorKind: 'parse_failed',
        modelUsed: result.modelUsed
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return { success: false, error: errorMessage, errorKind: 'unknown' };
    }
  }

  isConfigured(token?: string): boolean {
    const config = this.configService.getAIFilteringConfig();

    if (config.serviceType === 'builtin') {
      return !!token && token.length > 0;
    }
    if (config.serviceType === 'copilot') {
      return !!config.copilotGhoToken;
    }
    const hasModel =
      (config.customModelChain && config.customModelChain.length > 0) ||
      !!config.customModelName;
    return !!(config.customApiBaseUrl && config.customApiKey && hasModel);
  }

  getServiceType(): 'builtin' | 'custom' | 'copilot' {
    return this.configService.getAIFilteringConfig().serviceType;
  }

  getCopilotService(): CopilotService {
    return this.copilotService;
  }

  /**
   * List models that have been marked exhausted (quota_exceeded) in this app session
   * for the given provider. Returns [] for non-ModelScope providers in practice since
   * only ModelScope surfaces per-model daily quotas.
   */
  getExhaustedModels(): string[] {
    const config = this.configService.getAIFilteringConfig();
    if (config.serviceType !== 'custom') return [];
    return this.llm.getExhaustedModels(config.customProviderId, config.customApiBaseUrl);
  }
}

// Silence unused-import warning for MODELSCOPE_API_BASE_URL — re-exported for callers.
export { MODELSCOPE_API_BASE_URL };
