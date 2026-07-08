/**
 * yanhekt-proxy — a standalone Cloudflare Worker that proxies yanhekt RECORDED
 * videos through their signed-URL anti-hotlink scheme, so any HLS player can
 * stream them. Ported from AutoSlides' local Node proxy (videoProxyService).
 *
 * Routes:
 *   GET /                            static asset (public/index.html), no Worker cost
 *   GET /playlist?u=<m3u8>&t=<token> fetch+sign m3u8, rewrite segment lines
 *   GET /segment?u=<url>&t=<token>   fetch+sign a media segment, stream it back
 *
 * Caching (Cache API): the video TOKEN only (~its real lifetime), not media.
 */
import { md5 } from './md5';
import { getClientSignature, signMediaUrl } from './yanhekt';
interface Env {}

const TOKEN_ENDPOINT = 'https://cbiz.yanhekt.cn/v1/auth/video/token?id=0';
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.3';

/** Headers sent to cvideo.yanhekt.cn when fetching media. */
const MEDIA_HEADERS: Record<string, string> = {
  Origin: 'https://www.yanhekt.cn',
  Referer: 'https://www.yanhekt.cn/',
  'User-Agent': USER_AGENT,
};

/** Headers sent to cbiz.yanhekt.cn when minting the video token. */
function tokenHeaders(loginToken: string): Record<string, string> {
  return {
    ...MEDIA_HEADERS,
    'xdomain-client': 'web_user',
    'Xdomain-Client': 'web_user',
    'Xclient-Version': 'v1',
    'Xclient-Signature': getClientSignature(),
    'Xclient-Timestamp': Math.floor(Date.now() / 1000).toString(),
    Authorization: `Bearer ${loginToken}`,
  };
}

const CORS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,OPTIONS',
  'Access-Control-Allow-Headers': 'Range,Content-Type',
  'Access-Control-Expose-Headers': 'Content-Length,Content-Range,Accept-Ranges',
};

// ---- Video token: Cache API + in-isolate coalescing -----------------------

const inflight = new Map<string, Promise<string>>();

function tokenCacheKey(loginToken: string): { url: string; req: Request } {
  const url = `https://yanhekt-proxy.cache/token/${md5(loginToken)}`;
  return { url, req: new Request(url) };
}

async function getVideoToken(loginToken: string, ctx: ExecutionContext): Promise<string> {
  const { url, req } = tokenCacheKey(loginToken);
  const cache = caches.default;

  const cached = await cache.match(req);
  if (cached) {
    const { token } = (await cached.json()) as { token?: string };
    if (token) return token;
  }

  const existing = inflight.get(url);
  if (existing) return existing;

  const p = (async () => {
    const res = await fetch(TOKEN_ENDPOINT, { headers: tokenHeaders(loginToken) });
    const data = (await res.json()) as {
      code: number | string;
      message?: string;
      data?: { token: string; expired_at?: number; now?: number };
    };
    if ((data.code !== 0 && data.code !== '0') || !data.data?.token) {
      throw new Error(`token mint failed: ${data.message ?? 'unknown'} (code ${data.code})`);
    }
    const token = data.data.token;
    const now = data.data.now ?? Math.floor(Date.now() / 1000);
    const expiredAt = data.data.expired_at ?? now + 600;
    const ttl = Math.max(60, expiredAt - now - 30); // honor server expiry, 30s safety
    ctx.waitUntil(
      cache.put(
        req,
        new Response(JSON.stringify({ token }), {
          headers: { 'Cache-Control': `max-age=${ttl}`, 'Content-Type': 'application/json' },
        })
      )
    );
    return token;
  })().finally(() => inflight.delete(url));

  inflight.set(url, p);
  return p;
}

function invalidateToken(loginToken: string, ctx: ExecutionContext): void {
  const { url, req } = tokenCacheKey(loginToken);
  inflight.delete(url);
  ctx.waitUntil(caches.default.delete(req));
}

// ---- Signed media fetch with 403 re-sign / re-mint retry ------------------

async function fetchSignedMedia(
  rawUrl: string,
  loginToken: string,
  ctx: ExecutionContext,
  range: string | null
): Promise<Response> {
  const maxAttempts = 3;
  let token = await getVideoToken(loginToken, ctx);
  let last: Response | null = null;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    if (attempt > 0) {
      // Previous attempt was a 403: re-mint a fresh token, then re-sign.
      invalidateToken(loginToken, ctx);
      token = await getVideoToken(loginToken, ctx);
    }
    const signed = signMediaUrl(rawUrl, token); // fresh timestamp+signature each call
    const headers: Record<string, string> = { ...MEDIA_HEADERS };
    if (range) headers['Range'] = range;

    const res = await fetch(signed, { headers, redirect: 'follow' });
    if (res.status !== 403) return res;
    last = res;
  }
  return last as Response; // exhausted — surface the final 403
}

// ---- m3u8 rewriting -------------------------------------------------------

function rewriteM3u8(content: string, baseUrl: string, origin: string, t: string): string {
  const tEnc = encodeURIComponent(t);
  const proxify = (abs: string): string => {
    const route = abs.split('?')[0].toLowerCase().endsWith('.m3u8') ? 'playlist' : 'segment';
    return `${origin}/${route}?u=${encodeURIComponent(abs)}&t=${tEnc}`;
  };

  return content
    .split('\n')
    .map((line) => {
      if (line.startsWith('#')) {
        // Rewrite AES key URIs so they route through the proxy too (defensive).
        if (line.startsWith('#EXT-X-KEY') && line.includes('URI="')) {
          return line.replace(/URI="([^"]+)"/, (_m, uri) => {
            const abs = new URL(uri, baseUrl).toString();
            return `URI="${proxify(abs)}"`;
          });
        }
        return line;
      }
      if (line.trim() === '') return line;
      const abs = new URL(line.trim(), baseUrl).toString();
      return proxify(abs);
    })
    .join('\n');
}

// ---- Response helpers -----------------------------------------------------

function streamMedia(res: Response): Response {
  const headers = new Headers(CORS);
  for (const h of ['Content-Type', 'Content-Length', 'Content-Range', 'Accept-Ranges']) {
    const v = res.headers.get(h);
    if (v) headers.set(h, v);
  }
  if (!headers.has('Accept-Ranges')) headers.set('Accept-Ranges', 'bytes');
  return new Response(res.body, { status: res.status, headers });
}

function text(body: string, status: number, type = 'text/plain; charset=utf-8'): Response {
  return new Response(body, { status, headers: { ...CORS, 'Content-Type': type } });
}

// ---- Worker entry ---------------------------------------------------------

export default {
  async fetch(request: Request, _env: Env, ctx: ExecutionContext): Promise<Response> {
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
    if (request.method !== 'GET') return text('Method not allowed', 405);

    const url = new URL(request.url);
    const origin = url.origin;

    try {
      if (url.pathname === '/playlist') {
        const u = url.searchParams.get('u');
        const t = url.searchParams.get('t');
        if (!u || !t) return text('Missing required params: u (m3u8 url) and t (login token)', 400);

        const res = await fetchSignedMedia(u, t, ctx, null);
        if (res.status !== 200) {
          return text(`Upstream playlist request failed with status ${res.status}`, res.status === 403 ? 403 : 502);
        }
        const rewritten = rewriteM3u8(await res.text(), u, origin, t);
        return text(rewritten, 200, 'application/vnd.apple.mpegurl');
      }

      if (url.pathname === '/segment') {
        const u = url.searchParams.get('u');
        const t = url.searchParams.get('t');
        if (!u || !t) return text('Missing required params: u (media url) and t (login token)', 400);

        const res = await fetchSignedMedia(u, t, ctx, request.headers.get('Range'));
        return streamMedia(res);
      }

      return text('Not found', 404);
    } catch (err) {
      return text(`Proxy error: ${err instanceof Error ? err.message : String(err)}`, 502);
    }
  },
} satisfies ExportedHandler<Env>;
