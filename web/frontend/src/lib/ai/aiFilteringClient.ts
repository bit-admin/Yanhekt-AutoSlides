// AI-filtering provider resolution + response parsing.
// Web analogue of autoslides/src/main/ai/aiFilteringService.ts, LLM-only and
// single-image-only. Three service types:
//  - builtin: the hosted proxy at openai.ruc.edu.kg, keyed by the user's own
//    login token (same gate as desktop: configured iff signed in);
//  - copilot: GitHub Copilot through the copilot-proxy Worker's /v1 endpoints,
//    keyed by the gho_/ghu_ token from the device flow;
//  - custom: any OpenAI-compatible endpoint (must allow browser CORS).

import { configStore } from '../../stores/configStore';
import { authStore } from '../../stores/authStore';
import type { ClassificationValue, ClassifierCallbacks, SingleClassificationResult } from '../postProcessing/types';
import { DISTINGUISH_LIVE_PROMPT } from './prompt';
import { chatCompletionWithImage, getBuiltinModel, BUILTIN_API_BASE_URL } from './llmClient';
import { COPILOT_PROXY_BASE_URL } from './copilotAuth';
import { createLogger } from '../logger';

const log = createLogger('AIFiltering');

export const DEFAULT_COPILOT_MODEL = 'gpt-4.1';

/** Whether the selected service type has the credentials it needs. */
export function isAIFilteringConfigured(): boolean {
  switch (configStore.aiServiceType) {
    case 'builtin':
      return !!authStore.token.value;
    case 'copilot':
      return !!configStore.aiCopilotToken;
    case 'custom':
      return !!configStore.aiCustomBaseUrl && !!configStore.aiCustomApiKey && !!configStore.aiCustomModel;
    default:
      return false;
  }
}

/** Enabled in settings AND usable — the runner's phase-3 gate. */
export function isAIFilteringActive(): boolean {
  return configStore.aiFilteringEnabled && isAIFilteringConfigured();
}

const VALID_CLASSIFICATIONS: ClassificationValue[] = ['slide', 'not_slide', 'may_be_slide_edit'];

/**
 * Extract `{"classification": ...}` from the model output. Tolerates prose
 * around the JSON (regex grabs the first {...} block, desktop parity).
 */
export function parseClassificationResult(content: string): ClassificationValue | null {
  const match = content.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    const parsed = JSON.parse(match[0]) as { classification?: string };
    const value = parsed.classification as ClassificationValue | undefined;
    return value && VALID_CLASSIFICATIONS.includes(value) ? value : null;
  } catch {
    return null;
  }
}

interface RequestContext {
  baseUrl: string;
  apiKey: string;
  model: string;
}

async function resolveRequestContext(token: string | undefined): Promise<RequestContext> {
  switch (configStore.aiServiceType) {
    case 'builtin': {
      if (!token) throw new Error('Builtin AI service requires a signed-in user token');
      return { baseUrl: BUILTIN_API_BASE_URL, apiKey: token, model: await getBuiltinModel(token) };
    }
    case 'copilot':
      return {
        baseUrl: `${COPILOT_PROXY_BASE_URL}/v1`,
        apiKey: configStore.aiCopilotToken,
        model: configStore.aiCopilotModel || DEFAULT_COPILOT_MODEL,
      };
    case 'custom':
      return {
        baseUrl: configStore.aiCustomBaseUrl.replace(/\/+$/, ''),
        apiKey: configStore.aiCustomApiKey,
        model: configStore.aiCustomModel,
      };
    default:
      throw new Error(`Unknown AI service type: ${String(configStore.aiServiceType)}`);
  }
}

/**
 * Build the classifier injected into the post-processing pipeline. Provider
 * settings are re-read per call, so a settings change applies to the next
 * classification without restarting the pass.
 */
export function createClassifier(): ClassifierCallbacks {
  return {
    async classifySingleImage(base64Image, token): Promise<SingleClassificationResult> {
      let ctx: RequestContext;
      try {
        ctx = await resolveRequestContext(token);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        const unavailable = message.toLowerCase().includes('unavailable');
        return { success: false, error: message, errorKind: unavailable ? 'service_unavailable' : 'unknown' };
      }

      const result = await chatCompletionWithImage({
        baseUrl: ctx.baseUrl,
        apiKey: ctx.apiKey,
        model: ctx.model,
        prompt: DISTINGUISH_LIVE_PROMPT,
        base64Image,
      });
      if (!result.ok) {
        return { success: false, error: result.error.message, errorKind: result.error.kind };
      }

      const classification = parseClassificationResult(result.content);
      if (!classification) {
        log.warn('Failed to parse classification from response:', result.content.slice(0, 200));
        return {
          success: false,
          error: `Could not parse classification from response: ${result.content.slice(0, 120)}`,
          errorKind: 'parse_failed',
        };
      }
      return { success: true, result: { classification } };
    },
  };
}
