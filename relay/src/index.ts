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
 * Both routes accept &nocache=1 to bypass the shared VOD cache (read AND
 * write); /playlist propagates the flag into the segment URLs it emits.
 *
 * Caching (Cache API): the video TOKEN (~its real lifetime), plus raw VOD
 * m3u8 bodies and full 200 segment bodies keyed by upstream URL alone —
 * recorded content is immutable and byte-identical for every viewer, so the
 * cache is deliberately shared across login tokens.
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

// Yanhekt login tokens are always 32 hex chars (md5-shaped). Since cache hits
// never touch upstream (which is what would reject a bad token), reject
// malformed tokens up front so junk requests can't be served shared cached
// media for free. NOTE: this is a format check only — a well-formed but
// expired/revoked token still gets cache hits until the entry expires.
const LOGIN_TOKEN_RE = /^[0-9a-f]{32}$/i;

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

// ---- Raw m3u8 cache -------------------------------------------------------
// Recorded (VOD) playlists are immutable, and the raw upstream body is
// identical regardless of which login token requested it (segment lines are
// relative + token-independent; signing happens per segment fetch). So we
// cache the RAW m3u8 keyed by its url alone — shared across every viewer —
// and rewrite per-request with the caller's token. This keeps the slow,
// tail-spiky "mint token + round-trip to China for the m3u8" work off all
// but the first playlist request per video per PoP.
const VOD_TTL = 21600; // 6h — recorded lectures never change once processed

const inflightM3u8 = new Map<string, Promise<string>>();

function m3u8CacheKey(rawUrl: string): { url: string; req: Request } {
  const url = `https://yanhekt-proxy.cache/m3u8/${md5(rawUrl)}`;
  return { url, req: new Request(url) };
}

async function getRawPlaylist(
  rawUrl: string,
  loginToken: string,
  ctx: ExecutionContext,
  noCache: boolean
): Promise<{ status: number; body: string }> {
  if (noCache) {
    const res = await fetchSignedMedia(rawUrl, loginToken, ctx, null);
    return { status: res.status, body: await res.text() };
  }

  const { url, req } = m3u8CacheKey(rawUrl);
  const cache = caches.default;

  const cached = await cache.match(req);
  if (cached) return { status: 200, body: await cached.text() };

  // Coalesce concurrent cold fetches for the same playlist within this isolate
  // so a burst of viewers triggers a single mint+upstream round-trip.
  const existing = inflightM3u8.get(url);
  if (existing) return { status: 200, body: await existing };

  const p = (async () => {
    const res = await fetchSignedMedia(rawUrl, loginToken, ctx, null);
    const body = await res.text();
    if (res.status !== 200) {
      // Surface upstream failures without caching them or joining coalesced waiters.
      throw { status: res.status, body } as { status: number; body: string };
    }
    ctx.waitUntil(
      cache.put(
        req,
        new Response(body, {
          headers: {
            'Cache-Control': `max-age=${VOD_TTL}`,
            'Content-Type': 'application/vnd.apple.mpegurl',
          },
        })
      )
    );
    return body;
  })().finally(() => inflightM3u8.delete(url));

  inflightM3u8.set(url, p);
  // A cold open can outlast the player's manifest-load timeout; if the client
  // aborts and retries, we must still finish the mint+fetch+cache in the
  // background so the retry (and every later viewer) hits a warm cache instead
  // of re-triggering the slow upstream round-trip.
  ctx.waitUntil(p.catch(() => {}));
  try {
    return { status: 200, body: await p };
  } catch (err) {
    if (err && typeof err === 'object' && 'status' in err) {
      return err as { status: number; body: string };
    }
    throw err;
  }
}

// ---- Segment cache --------------------------------------------------------
// Same sharing argument as the m3u8 cache: VOD segment bytes are immutable
// and token-independent, so full 200 bodies are cached keyed by upstream URL
// alone. A warm hit serves from the PoP instead of a ~2s round-trip to
// cvideo. Range requests are served from a cached full body by the Cache API
// itself (match returns 206); a ranged cold miss just streams through
// uncached (cache.put rejects partial responses). Note the cache is per-PoP
// and free-plan eviction is aggressive — this is best-effort, not storage.

function segmentCacheKey(rawUrl: string, range: string | null): Request {
  const url = `https://yanhekt-proxy.cache/seg/${md5(rawUrl)}`;
  return new Request(url, range ? { headers: { Range: range } } : undefined);
}

async function getSegment(
  rawUrl: string,
  loginToken: string,
  ctx: ExecutionContext,
  range: string | null,
  noCache: boolean
): Promise<Response> {
  const cache = caches.default;

  if (!noCache) {
    const cached = await cache.match(segmentCacheKey(rawUrl, range));
    if (cached) return cached;
  }

  const res = await fetchSignedMedia(rawUrl, loginToken, ctx, range);
  if (noCache || res.status !== 200 || !res.body) return res;

  // Stream to the client and the cache simultaneously; put() finishes in the
  // background even if the client disconnects mid-segment.
  const [toClient, toCache] = res.body.tee();
  const cacheHeaders = new Headers({ 'Cache-Control': `max-age=${VOD_TTL}` });
  for (const h of ['Content-Type', 'Content-Length']) {
    const v = res.headers.get(h);
    if (v) cacheHeaders.set(h, v);
  }
  ctx.waitUntil(
    cache
      .put(segmentCacheKey(rawUrl, null), new Response(toCache, { headers: cacheHeaders }))
      .catch(() => {})
  );
  return new Response(toClient, { status: res.status, headers: res.headers });
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

function rewriteM3u8(
  content: string,
  baseUrl: string,
  origin: string,
  t: string,
  noCache: boolean
): string {
  const tEnc = encodeURIComponent(t);
  const suffix = noCache ? '&nocache=1' : '';
  const proxify = (abs: string): string => {
    const route = abs.split('?')[0].toLowerCase().endsWith('.m3u8') ? 'playlist' : 'segment';
    return `${origin}/${route}?u=${encodeURIComponent(abs)}&t=${tEnc}${suffix}`;
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
      if (url.pathname === '/playlist' || url.pathname === '/segment') {
        const u = url.searchParams.get('u');
        const t = url.searchParams.get('t');
        if (!u || !t) return text('Missing required params: u (media url) and t (login token)', 400);
        if (!LOGIN_TOKEN_RE.test(t)) return text('Invalid login token', 403);
        const noCache = url.searchParams.get('nocache') === '1';

        if (url.pathname === '/playlist') {
          const raw = await getRawPlaylist(u, t, ctx, noCache);
          if (raw.status !== 200) {
            return text(`Upstream playlist request failed with status ${raw.status}`, raw.status === 403 ? 403 : 502);
          }
          const rewritten = rewriteM3u8(raw.body, u, origin, t, noCache);
          return text(rewritten, 200, 'application/vnd.apple.mpegurl');
        }

        const res = await getSegment(u, t, ctx, request.headers.get('Range'), noCache);
        return streamMedia(res);
      }

      return text('Not found', 404);
    } catch (err) {
      return text(`Proxy error: ${err instanceof Error ? err.message : String(err)}`, 502);
    }
  },
} satisfies ExportedHandler<Env>;
