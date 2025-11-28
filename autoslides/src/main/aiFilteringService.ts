import axios, { AxiosError } from 'axios';
import { ConfigService } from './configService';
import { AIPromptsService, AIPromptType } from './aiPromptsService';

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

    const response = await axios.post<ChatCompletionResponse>(
      `${baseUrl}/chat/completions`,
      {
        model,
        messages,
        max_tokens: 100,
        temperature: 0
      },
      {
        headers,
        timeout: 30000 // 30 seconds for vision requests
      }
    );

    return response.data;
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
    try {
      // Enforce rate limit before making request
      await this.enforceRateLimit();

      const apiConfig = this.getApiConfig(token);
      const prompt = this.aiPromptsService.getPrompt(type);
      const model = modelOverride || apiConfig.model;

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
      const result = this.parseClassificationResult(responseContent);

      if (result) {
        return { success: true, result };
      } else {
        return {
          success: false,
          error: `Failed to parse AI response: ${responseContent}`
        };
      }
    } catch (error) {
      const errorMessage = error instanceof AxiosError
        ? error.response?.data?.error?.message || error.message
        : error instanceof Error
          ? error.message
          : 'Unknown error';

      console.error('AI classification error:', errorMessage);
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
    try {
      // Enforce rate limit before making request
      await this.enforceRateLimit();

      const apiConfig = this.getApiConfig(token);
      const prompt = this.aiPromptsService.getPrompt(type);
      const model = modelOverride || apiConfig.model;

      // Build content array with prompt and all images
      const contentParts: ContentPart[] = [
        { type: 'text', text: prompt }
      ];

      for (const base64Image of base64Images) {
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
      const result = this.parseBatchClassificationResult(responseContent);

      if (result) {
        return { success: true, result };
      } else {
        return {
          success: false,
          error: `Failed to parse AI batch response: ${responseContent}`
        };
      }
    } catch (error) {
      const errorMessage = error instanceof AxiosError
        ? error.response?.data?.error?.message || error.message
        : error instanceof Error
          ? error.message
          : 'Unknown error';

      console.error('AI batch classification error:', errorMessage);
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
