/**
 * Cross-cutting Worker runtime: minimal Cloudflare type shims (we hand-roll the
 * few interfaces we use instead of pulling in @cloudflare/workers-types), plus
 * the shared HTTP + short-link + crypto helpers used by both the v1 and v2
 * handlers.
 */

// Cloudflare exposes a default edge cache at `caches.default`, which the DOM
// `CacheStorage` lib type doesn't model. Shadow it module-locally.
declare const caches: { default: Cache };

export interface KVNamespace {
  get(key: string): Promise<string | null>;
  put(key: string, value: string): Promise<void>;
}

export interface D1Result<T = Record<string, unknown>> {
  results: T[];
  success: boolean;
}

export interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  first<T = Record<string, unknown>>(): Promise<T | null>;
  run(): Promise<D1Result>;
  all<T = Record<string, unknown>>(): Promise<D1Result<T>>;
}

export interface D1Database {
  prepare(query: string): D1PreparedStatement;
}

export interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
}

export interface Env {
  ASSETS: { fetch(req: Request): Promise<Response> };
  SHARE_KV: KVNamespace;
  INDEX_DB: D1Database;
}

export const MAX_FRAGMENT_BYTES = 8192;
export const ID_LENGTH = 10;
const B62 = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';

export const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
  });
}

function base62(bytes: Uint8Array): string {
  let num = 0n;
  for (const b of bytes) num = (num << 8n) | BigInt(b);
  let s = '';
  while (num > 0n) {
    s = B62[Number(num % 62n)] + s;
    num /= 62n;
  }
  return s || '0';
}

export async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Content-addressed short id: base62 of SHA-256 of the fragment, first 10 chars. */
export async function shortId(fragment: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(fragment));
  return base62(new Uint8Array(digest)).slice(0, ID_LENGTH);
}

/**
 * Ensure a v1 short link exists for `fragment` and return its id. Idempotent:
 * the KV write only happens for a fresh id (so re-publishing the same slides
 * costs zero KV writes).
 */
export async function ensureShortLink(env: Env, fragment: string): Promise<string> {
  const id = await shortId(fragment);
  if ((await env.SHARE_KV.get(id)) === null) {
    await env.SHARE_KV.put(id, fragment);
  }
  return id;
}

/**
 * Edge-cache a GET response via the Cache API so repeat reads never re-run the
 * handler (and never re-hit D1). Keyed by the full request URL.
 */
export async function cached(
  req: Request,
  ctx: ExecutionContext,
  ttlSeconds: number,
  produce: () => Promise<Response>,
): Promise<Response> {
  const cache = caches.default;
  const hit = await cache.match(req);
  if (hit) return hit;
  const res = await produce();
  // Only cache successful responses; clone so the body is still readable.
  if (res.ok) {
    const toCache = new Response(res.body, res);
    toCache.headers.set('Cache-Control', `public, max-age=${ttlSeconds}`);
    ctx.waitUntil(cache.put(req, toCache.clone()));
    return toCache;
  }
  return res;
}
