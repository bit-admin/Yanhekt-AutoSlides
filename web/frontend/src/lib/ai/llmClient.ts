// Fetch-based LLM chat-completions transport for AI filtering.
// Ported from autoslides/src/main/ai/llmApiService.ts, simplified for the web:
// single-image requests only, one provider request shape (OpenAI-compatible),
// no model-chain fallback and no Bottleneck — a module-level promise chain
// serializes requests with a fixed spacing instead.
//
// Retry contract (kept from desktop): 429/502 are retried here with exponential
// backoff honoring Retry-After; the pipeline above must NOT re-retry those. An
// empty-choices 2xx gets one retry. 503 and other statuses fail fast.

import { createLogger } from '../logger';

const log = createLogger('LLMClient');

export type AIErrorKind =
  | 'rate_limited'
  | 'upstream_rate_limited'
  | 'auth_failed'
  | 'cloudflare_blocked'
  | 'timeout'
  | 'network'
  | 'service_unavailable'
  | 'server_error'
  | 'bad_request'
  | 'parse_failed'
  | 'unknown';

export interface LLMError {
  kind: AIErrorKind;
  status?: number;
  message: string;
  /** Parsed Retry-After delay (ms), when the provider sent one on a 429/502. */
  retryAfterMs?: number;
}

export type LLMResult = { ok: true; content: string } | { ok: false; error: LLMError };

export interface ChatImageRequest {
  /** Provider base URL without trailing slash; '/chat/completions' is appended. */
  baseUrl: string;
  apiKey: string;
  model: string;
  prompt: string;
  /** Raw base64 PNG (no data: prefix). */
  base64Image: string;
  /** Extra headers merged over the defaults (e.g. builtin User-Agent). */
  extraHeaders?: Record<string, string>;
}

const REQUEST_TIMEOUT_MS = 60_000;
/** Minimum gap between request starts (desktop `minTime` default). */
const MIN_REQUEST_SPACING_MS = 6_000;
const MAX_TRANSPORT_RETRIES = 4;
const BACKOFF_BASE_MS = 2_000;
const BACKOFF_MAX_MS = 30_000;

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

// --- Sequential queue with spacing ---

let queueTail: Promise<void> = Promise.resolve();
let lastRequestStart = 0;

function enqueue<T>(task: () => Promise<T>): Promise<T> {
  const run = queueTail.then(async () => {
    const wait = lastRequestStart + MIN_REQUEST_SPACING_MS - Date.now();
    if (wait > 0) await sleep(wait);
    lastRequestStart = Date.now();
    return task();
  });
  queueTail = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

// --- Error helpers ---

function looksLikeCloudflareChallenge(body: string): boolean {
  const lower = body.slice(0, 2000).toLowerCase();
  return (
    lower.includes('<!doctype') ||
    lower.includes('<html') ||
    lower.includes('just a moment') ||
    lower.includes('cf-mitigated')
  );
}

function classifyHttpError(status: number, body: string): LLMError {
  const message = `HTTP ${status}: ${body.slice(0, 300)}`;
  if (status === 429) return { kind: 'rate_limited', status, message };
  if (status === 502) return { kind: 'upstream_rate_limited', status, message };
  if (status === 401) return { kind: 'auth_failed', status, message };
  if (status === 403) {
    return looksLikeCloudflareChallenge(body)
      ? { kind: 'cloudflare_blocked', status, message: 'Blocked by Cloudflare challenge' }
      : { kind: 'auth_failed', status, message };
  }
  if (status === 503) return { kind: 'service_unavailable', status, message };
  if (status >= 500) return { kind: 'server_error', status, message };
  return { kind: 'bad_request', status, message };
}

function parseRetryAfter(header: string | null): number | null {
  if (!header) return null;
  const seconds = Number(header);
  if (Number.isFinite(seconds) && seconds >= 0) return seconds * 1000;
  const date = Date.parse(header);
  if (!Number.isNaN(date)) return Math.max(0, date - Date.now());
  return null;
}

function backoffDelay(attempt: number, retryAfterMs: number | null): number {
  if (retryAfterMs !== null) return Math.min(retryAfterMs, BACKOFF_MAX_MS);
  const base = Math.min(BACKOFF_BASE_MS * 2 ** attempt, BACKOFF_MAX_MS);
  return base + Math.random() * 500;
}

// --- Chat completions ---

interface ChatCompletionResponse {
  choices?: Array<{ message?: { content?: string } }> | null;
  error?: { message?: string };
}

async function attemptChatCompletion(req: ChatImageRequest): Promise<LLMResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  let response: Response;
  try {
    response = await fetch(`${req.baseUrl}/chat/completions`, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${req.apiKey}`,
        ...req.extraHeaders,
      },
      body: JSON.stringify({
        model: req.model,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: req.prompt },
              {
                type: 'image_url',
                image_url: { url: `data:image/png;base64,${req.base64Image}`, detail: 'low' },
              },
            ],
          },
        ],
        max_tokens: 100,
        temperature: 0,
      }),
    });
  } catch (error) {
    const aborted = controller.signal.aborted;
    return {
      ok: false,
      error: {
        kind: aborted ? 'timeout' : 'network',
        message: aborted
          ? `Request timed out after ${REQUEST_TIMEOUT_MS}ms`
          : error instanceof Error
            ? error.message
            : String(error),
      },
    };
  } finally {
    clearTimeout(timer);
  }

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    const error = classifyHttpError(response.status, body);
    const retryAfterMs = parseRetryAfter(response.headers.get('Retry-After'));
    return { ok: false, error: retryAfterMs !== null ? { ...error, retryAfterMs } : error };
  }

  let data: ChatCompletionResponse;
  try {
    data = (await response.json()) as ChatCompletionResponse;
  } catch {
    return { ok: false, error: { kind: 'parse_failed', message: 'Provider returned non-JSON response' } };
  }
  if (data.error?.message) {
    return { ok: false, error: { kind: 'parse_failed', message: data.error.message } };
  }
  const content = data.choices?.[0]?.message?.content;
  if (typeof content !== 'string' || content.length === 0) {
    // Signalled distinctly so the retry loop can give empty responses one more try.
    return { ok: false, error: { kind: 'parse_failed', message: 'EMPTY_CHOICES' } };
  }
  return { ok: true, content };
}

/**
 * One classification request. Queued (sequential, spaced) and transparently
 * retried on 429/502 and on a single empty-choices response.
 */
export function chatCompletionWithImage(req: ChatImageRequest): Promise<LLMResult> {
  return enqueue(async () => {
    let emptyRetried = false;
    let attempt = 0;
    for (;;) {
      const result = await attemptChatCompletion(req);
      if (result.ok) return result;

      const { kind, message } = result.error;
      if ((kind === 'rate_limited' || kind === 'upstream_rate_limited') && attempt < MAX_TRANSPORT_RETRIES) {
        const delay = backoffDelay(attempt, result.error.retryAfterMs ?? null);
        log.warn(`${kind} (attempt ${attempt + 1}/${MAX_TRANSPORT_RETRIES}), retrying in ${Math.round(delay)}ms`);
        await sleep(delay);
        attempt += 1;
        continue;
      }
      if (kind === 'parse_failed' && message === 'EMPTY_CHOICES' && !emptyRetried) {
        emptyRetried = true;
        log.warn('Empty choices in response, retrying once');
        await sleep(1000);
        continue;
      }
      return result;
    }
  });
}

// --- Builtin model discovery ---

export const BUILTIN_API_BASE_URL = 'https://openai.ruc.edu.kg';
const BUILTIN_FALLBACK_MODEL = 'agnes-2.0-flash';
const BUILTIN_MODEL_UNAVAILABLE = 'TEMP_UNAVAILABLE';

let builtinModelCache: { token: string; model: string } | null = null;

/**
 * Resolve the builtin service's current model (server-driven). Cached per token
 * for the session. Throws on the explicit unavailable sentinel / 503 so the
 * caller surfaces `service_unavailable`; transient fetch failures fall back to
 * the default model without caching.
 */
export async function getBuiltinModel(token: string): Promise<string> {
  if (builtinModelCache && builtinModelCache.token === token) {
    return builtinModelCache.model;
  }
  let response: Response;
  try {
    response = await fetch(`${BUILTIN_API_BASE_URL}/model`, {
      headers: { Authorization: `Bearer ${token}` },
    });
  } catch (error) {
    log.warn('Builtin model discovery failed, using fallback:', error);
    return BUILTIN_FALLBACK_MODEL;
  }
  if (response.status === 503) {
    throw new Error('Builtin AI service temporarily unavailable (503)');
  }
  if (!response.ok) {
    log.warn(`Builtin model discovery returned HTTP ${response.status}, using fallback`);
    return BUILTIN_FALLBACK_MODEL;
  }
  let model: string | undefined;
  try {
    model = ((await response.json()) as { model?: string }).model;
  } catch {
    return BUILTIN_FALLBACK_MODEL;
  }
  if (!model) return BUILTIN_FALLBACK_MODEL;
  if (model === BUILTIN_MODEL_UNAVAILABLE) {
    throw new Error('Builtin AI service temporarily unavailable');
  }
  builtinModelCache = { token, model };
  return model;
}
