/**
 * Built-in AI request + completion settings.
 *
 * AutoSlides 5.0.0+ (UA later than 4.4.1) receives these on GET /model.
 * Older workers / a legacy `{ model }` body fall back to the hardcoded
 * constants below. Clients lock both groups when serviceType === 'builtin'.
 */

export type BuiltinThinkingKey = 'enable_thinking' | 'thinking';

export interface AIRequestSettings {
  rateLimit: number;
  maxConcurrent: number;
  minTime: number;
  batchSize: number;
}

/** Mirrors `AIRequestBodySettings` — `null` means omit that key from the JSON. */
export interface BuiltinCompletionParams {
  maxTokens: number | null;
  temperature: number | null;
  topP: number | null;
  stream: boolean | null;
  enableThinking: boolean | null;
  thinkingKey: BuiltinThinkingKey;
}

export interface BuiltinModelInfo extends AIRequestSettings {
  model: string;
  requestBody: BuiltinCompletionParams;
}

export const BUILTIN_AI_REQUEST_SETTINGS: AIRequestSettings = {
  rateLimit: 10,
  maxConcurrent: 1,
  minTime: 6000,
  batchSize: 4
};

export const BUILTIN_AI_COMPLETION_PARAMS: BuiltinCompletionParams = {
  maxTokens: 100,
  temperature: 0,
  topP: null,
  stream: false,
  enableThinking: false,
  thinkingKey: 'enable_thinking'
};

function readField(obj: Record<string, unknown>, keys: string[]): unknown {
  for (const key of keys) {
    if (obj[key] !== undefined) return obj[key];
  }
  return undefined;
}

function parseBoundedInt(value: unknown, fallback: number, min: number, max: number): number {
  const n = typeof value === 'number' ? value : typeof value === 'string' ? Number(value.trim()) : NaN;
  if (!Number.isFinite(n)) return fallback;
  const rounded = Math.round(n);
  if (rounded < min || rounded > max) return fallback;
  return rounded;
}

function parseNullableNumber(
  value: unknown,
  fallback: number | null,
  min: number,
  max: number
): number | null {
  if (value === undefined) return fallback;
  if (value === null) return null;
  const n = typeof value === 'number' ? value : typeof value === 'string' ? Number(value.trim()) : NaN;
  if (!Number.isFinite(n)) return fallback;
  if (n < min || n > max) return fallback;
  return n;
}

function parseNullableBoolean(value: unknown, fallback: boolean | null): boolean | null {
  if (value === undefined) return fallback;
  if (value === null) return null;
  if (typeof value === 'boolean') return value;
  return fallback;
}

function parseThinkingKey(value: unknown, fallback: BuiltinThinkingKey): BuiltinThinkingKey {
  return value === 'thinking' || value === 'enable_thinking' ? value : fallback;
}

export function parseBuiltinCompletionParams(data: unknown): BuiltinCompletionParams {
  const obj = data && typeof data === 'object' && !Array.isArray(data)
    ? (data as Record<string, unknown>)
    : {};
  const fb = BUILTIN_AI_COMPLETION_PARAMS;
  return {
    maxTokens: parseNullableNumber(
      readField(obj, ['maxTokens', 'max_tokens']),
      fb.maxTokens,
      1,
      8192
    ),
    temperature: parseNullableNumber(
      readField(obj, ['temperature']),
      fb.temperature,
      0,
      2
    ),
    topP: parseNullableNumber(readField(obj, ['topP', 'top_p']), fb.topP, 0, 1),
    stream: parseNullableBoolean(readField(obj, ['stream']), fb.stream),
    enableThinking: parseNullableBoolean(
      readField(obj, ['enableThinking', 'enable_thinking']),
      fb.enableThinking
    ),
    thinkingKey: parseThinkingKey(readField(obj, ['thinkingKey', 'thinking_key']), fb.thinkingKey)
  };
}

/** Parse GET /model JSON. Extra/missing fields are ignored. */
export function parseBuiltinModelResponse(data: unknown, fallbackModel: string): BuiltinModelInfo {
  const obj = data && typeof data === 'object' && !Array.isArray(data)
    ? (data as Record<string, unknown>)
    : {};
  const rawModel = obj.model;
  const model = typeof rawModel === 'string' && rawModel.trim() ? rawModel.trim() : fallbackModel;
  const rawBody = obj.requestBody ?? obj.request_body;
  return {
    model,
    rateLimit: parseBoundedInt(
      readField(obj, ['rateLimit', 'rate_limit']),
      BUILTIN_AI_REQUEST_SETTINGS.rateLimit,
      1,
      60
    ),
    maxConcurrent: parseBoundedInt(
      readField(obj, ['maxConcurrent', 'max_concurrent']),
      BUILTIN_AI_REQUEST_SETTINGS.maxConcurrent,
      1,
      10
    ),
    minTime: parseBoundedInt(
      readField(obj, ['minTime', 'min_time']),
      BUILTIN_AI_REQUEST_SETTINGS.minTime,
      0,
      60_000
    ),
    batchSize: parseBoundedInt(
      readField(obj, ['batchSize', 'batch_size']),
      BUILTIN_AI_REQUEST_SETTINGS.batchSize,
      1,
      10
    ),
    requestBody: parseBuiltinCompletionParams(rawBody)
  };
}

export function toAIRequestSettings(info: AIRequestSettings): AIRequestSettings {
  return {
    rateLimit: info.rateLimit,
    maxConcurrent: info.maxConcurrent,
    minTime: info.minTime,
    batchSize: info.batchSize
  };
}

export function toBuiltinCompletionParams(info: BuiltinCompletionParams): BuiltinCompletionParams {
  return {
    maxTokens: info.maxTokens,
    temperature: info.temperature,
    topP: info.topP,
    stream: info.stream,
    enableThinking: info.enableThinking,
    thinkingKey: info.thinkingKey
  };
}

/**
 * Effective knobs for the current service. Built-in always uses the
 * last remote advertisement (or the hardcoded fallback) — never the
 * user-persisted custom/copilot values.
 */
export function resolveEffectiveAIRequestSettings(
  serviceType: string | undefined,
  stored: Partial<AIRequestSettings> | null | undefined,
  remote: AIRequestSettings | null | undefined
): AIRequestSettings {
  if (serviceType === 'builtin') {
    return remote ? toAIRequestSettings(remote) : { ...BUILTIN_AI_REQUEST_SETTINGS };
  }
  return {
    rateLimit: stored?.rateLimit || 10,
    maxConcurrent: stored?.maxConcurrent || 1,
    minTime: stored?.minTime ?? 6000,
    batchSize: stored?.batchSize || BUILTIN_AI_REQUEST_SETTINGS.batchSize
  };
}

export function resolveEffectiveAICompletionParams(
  serviceType: string | undefined,
  stored: BuiltinCompletionParams | null | undefined,
  remote: BuiltinCompletionParams | null | undefined
): BuiltinCompletionParams {
  if (serviceType === 'builtin') {
    return remote ? toBuiltinCompletionParams(remote) : { ...BUILTIN_AI_COMPLETION_PARAMS };
  }
  return stored ? toBuiltinCompletionParams(stored) : { ...BUILTIN_AI_COMPLETION_PARAMS };
}
