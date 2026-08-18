import { describe, it, expect } from 'vitest';
import {
  BUILTIN_AI_COMPLETION_PARAMS,
  BUILTIN_AI_REQUEST_SETTINGS,
  parseBuiltinModelResponse,
  resolveEffectiveAICompletionParams,
  resolveEffectiveAIRequestSettings
} from './aiRequestSettings';

describe('parseBuiltinModelResponse', () => {
  it('reads camelCase fields from GET /model', () => {
    expect(parseBuiltinModelResponse({
      model: 'claude-sonnet-5',
      rateLimit: 10,
      maxConcurrent: 1,
      minTime: 6000,
      batchSize: 4,
      requestBody: {
        maxTokens: 100,
        temperature: 0,
        topP: null,
        stream: false,
        enableThinking: false,
        thinkingKey: 'enable_thinking'
      }
    }, 'fallback')).toEqual({
      model: 'claude-sonnet-5',
      rateLimit: 10,
      maxConcurrent: 1,
      minTime: 6000,
      batchSize: 4,
      requestBody: BUILTIN_AI_COMPLETION_PARAMS
    });
  });

  it('accepts a legacy { model } body and fills hardcoded defaults', () => {
    expect(parseBuiltinModelResponse({ model: 'agnes-2.0-flash' }, 'fallback')).toEqual({
      model: 'agnes-2.0-flash',
      ...BUILTIN_AI_REQUEST_SETTINGS,
      requestBody: BUILTIN_AI_COMPLETION_PARAMS
    });
  });

  it('accepts snake_case aliases', () => {
    const parsed = parseBuiltinModelResponse({
      model: 'x',
      rate_limit: 8,
      max_concurrent: 2,
      min_time: 3000,
      batch_size: 3,
      request_body: {
        max_tokens: 50,
        top_p: 0.9,
        enable_thinking: true,
        thinking_key: 'thinking'
      }
    }, 'fallback');
    expect(parsed.rateLimit).toBe(8);
    expect(parsed.maxConcurrent).toBe(2);
    expect(parsed.minTime).toBe(3000);
    expect(parsed.batchSize).toBe(3);
    expect(parsed.requestBody.maxTokens).toBe(50);
    expect(parsed.requestBody.topP).toBe(0.9);
    expect(parsed.requestBody.enableThinking).toBe(true);
    expect(parsed.requestBody.thinkingKey).toBe('thinking');
    expect(parsed.requestBody.temperature).toBe(0);
    expect(parsed.requestBody.stream).toBe(false);
  });

  it('falls back per-field when a value is missing or out of range', () => {
    const parsed = parseBuiltinModelResponse({
      model: 'x',
      rateLimit: 0,
      maxConcurrent: 'nope',
      batchSize: 99,
      requestBody: { maxTokens: 0, temperature: 9 }
    }, 'fallback');
    expect(parsed.rateLimit).toBe(BUILTIN_AI_REQUEST_SETTINGS.rateLimit);
    expect(parsed.maxConcurrent).toBe(BUILTIN_AI_REQUEST_SETTINGS.maxConcurrent);
    expect(parsed.minTime).toBe(BUILTIN_AI_REQUEST_SETTINGS.minTime);
    expect(parsed.batchSize).toBe(BUILTIN_AI_REQUEST_SETTINGS.batchSize);
    expect(parsed.requestBody.maxTokens).toBe(BUILTIN_AI_COMPLETION_PARAMS.maxTokens);
    expect(parsed.requestBody.temperature).toBe(BUILTIN_AI_COMPLETION_PARAMS.temperature);
  });

  it('preserves explicit nulls on completion params (omit the key)', () => {
    const parsed = parseBuiltinModelResponse({
      model: 'x',
      requestBody: { maxTokens: null, temperature: null, enableThinking: null }
    }, 'fallback');
    expect(parsed.requestBody.maxTokens).toBeNull();
    expect(parsed.requestBody.temperature).toBeNull();
    expect(parsed.requestBody.enableThinking).toBeNull();
  });

  it('uses fallbackModel when model is absent', () => {
    expect(parseBuiltinModelResponse({}, 'agnes-2.0-flash').model).toBe('agnes-2.0-flash');
  });
});

describe('resolveEffectiveAIRequestSettings', () => {
  it('locks builtin to remote or hardcoded, ignoring stored', () => {
    const stored = { rateLimit: 20, maxConcurrent: 3, minTime: 1000, batchSize: 8 };
    expect(resolveEffectiveAIRequestSettings('builtin', stored, null)).toEqual(BUILTIN_AI_REQUEST_SETTINGS);
    expect(resolveEffectiveAIRequestSettings('builtin', stored, {
      rateLimit: 9, maxConcurrent: 1, minTime: 6000, batchSize: 4
    })).toEqual({ rateLimit: 9, maxConcurrent: 1, minTime: 6000, batchSize: 4 });
  });

  it('uses stored values for custom/copilot', () => {
    const stored = { rateLimit: 20, maxConcurrent: 3, minTime: 1000, batchSize: 8 };
    expect(resolveEffectiveAIRequestSettings('custom', stored, BUILTIN_AI_REQUEST_SETTINGS)).toEqual(stored);
    expect(resolveEffectiveAIRequestSettings('copilot', stored, null)).toEqual(stored);
  });
});

describe('resolveEffectiveAICompletionParams', () => {
  it('locks builtin to remote or hardcoded', () => {
    const stored = { ...BUILTIN_AI_COMPLETION_PARAMS, maxTokens: 200, enableThinking: true };
    expect(resolveEffectiveAICompletionParams('builtin', stored, null)).toEqual(BUILTIN_AI_COMPLETION_PARAMS);
    const remote = { ...BUILTIN_AI_COMPLETION_PARAMS, maxTokens: 80 };
    expect(resolveEffectiveAICompletionParams('builtin', stored, remote)).toEqual(remote);
  });

  it('uses stored values for custom', () => {
    const stored = { ...BUILTIN_AI_COMPLETION_PARAMS, maxTokens: 200 };
    expect(resolveEffectiveAICompletionParams('custom', stored, BUILTIN_AI_COMPLETION_PARAMS)).toEqual(stored);
  });
});
