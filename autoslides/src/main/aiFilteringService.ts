import axios, { AxiosError } from 'axios';
import { ConfigService } from './configService';
import { AIPromptsService, AIPromptType } from './aiPromptsService';

// Debug logging flag - set to true for detailed logging
const DEBUG = false;

const debugLog = (...args: unknown[]) => {
  if (DEBUG) {
    console.log('[AI:DEBUG]', ...args);
  }
};

const debugError = (...args: unknown[]) => {
  if (DEBUG) {
    console.error('[AI:DEBUG:ERROR]', ...args);
  }
};

export interface ClassificationResult {
  classification: 'slide' | 'not_slide';
}

export interface BatchClassificationResult {
  [key: string]: 'slide' | 'not_slide';
}

export interface AIFilteringResult {
  success: boolean;
  result?: ClassificationResult | BatchClassificationResult;
  error?: string;
}

// OpenAI-compatible message format
interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string | ContentPart[];
}

interface ContentPart {
  type: 'text' | 'image_url';
  text?: string;
  image_url?: {
    url: string;
    detail?: 'low' | 'high' | 'auto';
  };
}

interface ChatCompletionResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: {
    index: number;
    message: {
      role: string;
      content: string;
    };
    finish_reason: string;
  }[];
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

// Built-in service configuration
const BUILTIN_API_BASE_URL = 'https://openai.ruc.edu.kg';
const BUILTIN_FALLBACK_MODEL = 'gpt-4.1';

export class AIFilteringService {
  private configService: ConfigService;
  private aiPromptsService: AIPromptsService;
  private requestTimestamps: number[] = []; // timestamps of recent requests
  private rateLimitLock: Promise<void> = Promise.resolve(); // mutex for rate limiting

  constructor(configService: ConfigService, aiPromptsService: AIPromptsService) {
    this.configService = configService;
    this.aiPromptsService = aiPromptsService;
  }

  /**
   * Check if rate limit allows a new request, and wait if necessary
   * Uses a promise chain to serialize concurrent requests and prevent race conditions
   */
  private async enforceRateLimit(): Promise<void> {
    // Chain this request to prevent race conditions
    // Each call waits for previous calls to complete before checking/updating timestamps
    const previousLock = this.rateLimitLock;

    // Create a new promise that we'll resolve when this request is done
    let resolveCurrentLock: () => void;
    const currentLock = new Promise<void>(resolve => {
      resolveCurrentLock = resolve;
    });
    this.rateLimitLock = currentLock;

    // Wait for previous requests to complete their rate limit check
    await previousLock;

    try {
      const config = this.configService.getAIFilteringConfig();
      const rateLimit = config.rateLimit || 10;
      const now = Date.now();
      const oneMinuteAgo = now - 60000;

      // Clean up old timestamps
      this.requestTimestamps = this.requestTimestamps.filter(ts => ts > oneMinuteAgo);

      // Check if we're at the limit
      if (this.requestTimestamps.length >= rateLimit) {
        // Calculate wait time until the oldest request expires
        const oldestTimestamp = this.requestTimestamps[0];
        const waitTime = oldestTimestamp + 60000 - now + 100; // Add 100ms buffer
        if (waitTime > 0) {
          console.log(`[AI] Rate limit reached (${rateLimit}/min), waiting ${waitTime}ms`);
          await new Promise(resolve => setTimeout(resolve, waitTime));
          // Clean up again after waiting
          this.requestTimestamps = this.requestTimestamps.filter(ts => ts > Date.now() - 60000);
        }
      }

      // Record this request
      this.requestTimestamps.push(Date.now());
    } finally {
      // Release the lock so next request can proceed
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      resolveCurrentLock!();
    }
  }

  /**
   * Get the current rate limit
   */
  getRateLimit(): number {
    const config = this.configService.getAIFilteringConfig();
    return config.rateLimit || 10;
  }

  /**
   * Get the API configuration based on service type (built-in or custom)
   */
  private getApiConfig(token?: string): { baseUrl: string; apiKey: string; model: string } {
    const config = this.configService.getAIFilteringConfig();

    if (config.serviceType === 'builtin') {
      return {
        baseUrl: BUILTIN_API_BASE_URL,
        apiKey: token || '',
        model: BUILTIN_FALLBACK_MODEL // Will be overridden by getBuiltinModelName() call
      };
    } else {
      return {
        baseUrl: config.customApiBaseUrl,
        apiKey: config.customApiKey,
        model: config.customModelName
      };
    }
  }

  /**
   * Check if response data contains Cloudflare challenge page
   */
  private isCloudflareBlocked(data: unknown): boolean {
    const dataStr = typeof data === 'string' ? data : JSON.stringify(data);
    return dataStr.includes('<!DOCTYPE') ||
           dataStr.includes('<html') ||
           dataStr.includes('Just a moment') ||
           dataStr.includes('cf-mitigated');
  }

  /**
   * Fetch the model name for the built-in service
   * @throws Error with specific message for cloudflare blocks or fetch failures
   */
  async getBuiltinModelName(token: string): Promise<string> {
    try {
      const response = await axios.get(`${BUILTIN_API_BASE_URL}/model`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        timeout: 10000
      });

      // Check for Cloudflare challenge page in response
      if (this.isCloudflareBlocked(response.data)) {
        console.error('Received Cloudflare challenge page, likely blocked by proxy/VPN');
        throw new Error('cloudflareBlocked');
      }

      // API returns: {"model":"gpt-4.1"}
      if (response.data && response.data.model) {
        return response.data.model;
      }

      return BUILTIN_FALLBACK_MODEL;
    } catch (error) {
      // Re-throw cloudflare error
      if (error instanceof Error && error.message === 'cloudflareBlocked') {
        throw error;
      }

      // Check if axios error response contains Cloudflare block (403 with HTML)
      if (error instanceof AxiosError && error.response) {
        if (this.isCloudflareBlocked(error.response.data)) {
          console.error('Received Cloudflare challenge page (403), likely blocked by proxy/VPN');
          throw new Error('cloudflareBlocked');
        }
      }

      console.error('Failed to fetch built-in model name:', error);
      throw new Error('fetchFailed');
    }
  }

  /**
   * Build request headers, handling special cases like GitHub Copilot API
   */
  private buildHeaders(baseUrl: string, apiKey: string, hasImages: boolean): Record<string, string> {
    const headers: Record<string, string> = {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    };

    // Handle Copilot-Vision-Request header for GitHub Copilot API
    if (baseUrl === 'https://api.githubcopilot.com' && hasImages) {
      headers['Copilot-Vision-Request'] = 'true';
    }

    return headers;
  }

  /**
   * Make OpenAI-compatible chat completion request
   */
  private async makeChatCompletionRequest(
    baseUrl: string,
    apiKey: string,
    model: string,
    messages: ChatMessage[]
  ): Promise<ChatCompletionResponse> {
    const hasImages = messages.some(msg =>
      Array.isArray(msg.content) &&
      msg.content.some(item => item.type === 'image_url')
    );

    const headers = this.buildHeaders(baseUrl, apiKey, hasImages);

    // Calculate payload size for debugging
    const requestBody = {
      model,
      messages,
      max_tokens: 100,
      temperature: 0
    };
    const payloadSize = JSON.stringify(requestBody).length;

    debugLog('Making chat completion request', {
      url: `${baseUrl}/chat/completions`,
      model,
      hasImages,
      messageCount: messages.length,
      payloadSizeBytes: payloadSize,
      payloadSizeMB: (payloadSize / 1024 / 1024).toFixed(2)
    });

    // Log image sizes if present
    if (hasImages) {
      messages.forEach((msg, idx) => {
        if (Array.isArray(msg.content)) {
          msg.content.forEach((part, partIdx) => {
            if (part.type === 'image_url' && part.image_url) {
              const urlLength = part.image_url.url.length;
              debugLog(`Message[${idx}] Part[${partIdx}] image size`, {
                urlLength,
                estimatedBase64SizeKB: (urlLength * 0.75 / 1024).toFixed(2)
              });
            }
          });
        }
      });
    }

    const startTime = Date.now();

    try {
      const response = await axios.post<ChatCompletionResponse>(
        `${baseUrl}/chat/completions`,
        requestBody,
        {
          headers,
          timeout: 30000 // 30 seconds for vision requests
        }
      );

      const endTime = Date.now();
      debugLog('Chat completion response received', {
        duration: `${endTime - startTime}ms`,
        status: response.status,
        model: response.data.model,
        finishReason: response.data.choices[0]?.finish_reason,
        usage: response.data.usage,
        responseContent: response.data.choices[0]?.message?.content
      });

      return response.data;
    } catch (error) {
      const endTime = Date.now();
      if (error instanceof AxiosError) {
        debugError('Chat completion request failed', {
          duration: `${endTime - startTime}ms`,
          status: error.response?.status,
          statusText: error.response?.statusText,
          errorCode: error.code,
          errorMessage: error.message,
          responseData: error.response?.data
        });
      } else {
        debugError('Chat completion request failed (non-axios)', {
          duration: `${endTime - startTime}ms`,
          error
        });
      }
      throw error;
    }
  }

  /**
   * Parse classification result from AI response
   */
  private parseClassificationResult(content: string): ClassificationResult | null {
    try {
      // Try to extract JSON from the response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        if (parsed.classification === 'slide' || parsed.classification === 'not_slide') {
          return { classification: parsed.classification };
        }
      }
    } catch (error) {
      console.error('Failed to parse classification result:', error);
    }
    return null;
  }

  /**
   * Parse batch classification result from AI response
   */
  private parseBatchClassificationResult(content: string): BatchClassificationResult | null {
    try {
      // Try to extract JSON from the response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        const result: BatchClassificationResult = {};

        for (const [key, value] of Object.entries(parsed)) {
          if (value === 'slide' || value === 'not_slide') {
            result[key] = value as 'slide' | 'not_slide';
          }
        }

        if (Object.keys(result).length > 0) {
          return result;
        }
      }
    } catch (error) {
      console.error('Failed to parse batch classification result:', error);
    }
    return null;
  }

  /**
   * Classify a single image (used for Live mode)
   */
  async classifySingleImage(
    base64Image: string,
    type: AIPromptType,
    token?: string,
    modelOverride?: string
  ): Promise<AIFilteringResult> {
    debugLog('classifySingleImage called', {
      type,
      hasToken: !!token,
      modelOverride,
      imageSize: base64Image.length,
      imageSizeKB: (base64Image.length / 1024).toFixed(2)
    });

    try {
      // Enforce rate limit before making request
      await this.enforceRateLimit();
      debugLog('Rate limit passed');

      const apiConfig = this.getApiConfig(token);
      const prompt = this.aiPromptsService.getPrompt(type);
      const model = modelOverride || apiConfig.model;

      debugLog('API config retrieved', {
        baseUrl: apiConfig.baseUrl,
        model,
        promptLength: prompt.length
      });

      // Ensure base64 image has proper data URL prefix
      const imageUrl = base64Image.startsWith('data:')
        ? base64Image
        : `data:image/png;base64,${base64Image}`;

      const messages: ChatMessage[] = [
        {
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            {
              type: 'image_url',
              image_url: {
                url: imageUrl,
                detail: 'low' // Use low detail for faster processing
              }
            }
          ]
        }
      ];

      const response = await this.makeChatCompletionRequest(
        apiConfig.baseUrl,
        apiConfig.apiKey,
        model,
        messages
      );

      const responseContent = response.choices[0]?.message?.content || '';
      debugLog('Parsing single classification result', { responseContent });

      const result = this.parseClassificationResult(responseContent);

      if (result) {
        debugLog('Classification successful', result);
        return { success: true, result };
      } else {
        debugError('Failed to parse classification result', { responseContent });
        return {
          success: false,
          error: `Failed to parse AI response: ${responseContent}`
        };
      }
    } catch (error) {
      const errorMessage = error instanceof AxiosError
        ? `HTTP ${error.response?.status}: ${error.response?.data?.error?.message || error.message}`
        : error instanceof Error
          ? error.message
          : 'Unknown error';

      debugError('classifySingleImage failed', {
        errorMessage,
        isAxiosError: error instanceof AxiosError,
        status: error instanceof AxiosError ? error.response?.status : undefined,
        responseData: error instanceof AxiosError ? error.response?.data : undefined
      });

      return { success: false, error: errorMessage };
    }
  }

  /**
   * Classify multiple images in a single request (used for Recorded mode batch processing)
   */
  async classifyMultipleImages(
    base64Images: string[],
    type: AIPromptType,
    token?: string,
    modelOverride?: string
  ): Promise<AIFilteringResult> {
    debugLog('classifyMultipleImages called', {
      imageCount: base64Images.length,
      type,
      hasToken: !!token,
      modelOverride,
      imageSizes: base64Images.map(img => img.length),
      totalSizeKB: (base64Images.reduce((acc, img) => acc + img.length, 0) / 1024).toFixed(2)
    });

    try {
      // Enforce rate limit before making request
      await this.enforceRateLimit();
      debugLog('Rate limit passed');

      const apiConfig = this.getApiConfig(token);
      const prompt = this.aiPromptsService.getPrompt(type);
      const model = modelOverride || apiConfig.model;

      debugLog('API config retrieved', {
        baseUrl: apiConfig.baseUrl,
        model,
        promptLength: prompt.length
      });

      // Build content array with prompt and all images
      const contentParts: ContentPart[] = [
        { type: 'text', text: prompt }
      ];

      for (let i = 0; i < base64Images.length; i++) {
        const base64Image = base64Images[i];
        const imageUrl = base64Image.startsWith('data:')
          ? base64Image
          : `data:image/png;base64,${base64Image}`;

        contentParts.push({
          type: 'image_url',
          image_url: {
            url: imageUrl,
            detail: 'low'
          }
        });
        debugLog(`Added image ${i + 1}/${base64Images.length}`, {
          sizeKB: (base64Image.length / 1024).toFixed(2)
        });
      }

      const messages: ChatMessage[] = [
        {
          role: 'user',
          content: contentParts
        }
      ];

      const response = await this.makeChatCompletionRequest(
        apiConfig.baseUrl,
        apiConfig.apiKey,
        model,
        messages
      );

      const responseContent = response.choices[0]?.message?.content || '';
      debugLog('Parsing batch classification result', { responseContent });

      const result = this.parseBatchClassificationResult(responseContent);

      if (result) {
        debugLog('Batch classification successful', result);
        return { success: true, result };
      } else {
        debugError('Failed to parse batch classification result', { responseContent });
        return {
          success: false,
          error: `Failed to parse AI batch response: ${responseContent}`
        };
      }
    } catch (error) {
      const errorMessage = error instanceof AxiosError
        ? `HTTP ${error.response?.status}: ${error.response?.data?.error?.message || error.message}`
        : error instanceof Error
          ? error.message
          : 'Unknown error';

      debugError('classifyMultipleImages failed', {
        errorMessage,
        isAxiosError: error instanceof AxiosError,
        status: error instanceof AxiosError ? error.response?.status : undefined,
        responseData: error instanceof AxiosError ? error.response?.data : undefined
      });

      return { success: false, error: errorMessage };
    }
  }

  /**
   * Check if AI filtering is properly configured
   */
  isConfigured(token?: string): boolean {
    const config = this.configService.getAIFilteringConfig();

    if (config.serviceType === 'builtin') {
      // Built-in requires a valid token
      return !!token && token.length > 0;
    } else {
      // Custom requires all fields to be filled
      return !!(
        config.customApiBaseUrl &&
        config.customApiKey &&
        config.customModelName
      );
    }
  }

  /**
   * Get current service type
   */
  getServiceType(): 'builtin' | 'custom' {
    return this.configService.getAIFilteringConfig().serviceType;
  }
}
