/**
 * yanhekt-proxy — a standalone Cloudflare Worker that proxies yanhekt RECORDED
 * videos through their signed-URL anti-hotlink scheme, so any HLS player can
 * stream them. Ported from AutoSlides' local Node proxy (videoProxyService).
 *
 * Routes:
 *   GET /                            static asset (public/index.html), no Worker cost
 *   GET /cf.txt                      static asset (connection-details header beacon)
 *   GET /playlist?u=<m3u8>&t=<token> fetch+sign m3u8, rewrite segment lines
 *   GET /segment?u=<url>&t=<token>   fetch+sign a media segment, stream it back
 *
 * Playlist and segment routes accept &nocache=1 to bypass the shared VOD
 * cache (read AND write); /playlist propagates the flag into the segment
 * URLs it emits.
 *
 * Optional &sid=<session id> opts into watch-progress reporting: /playlist
 * carries it into the segment URLs it emits, and each /segment request then
 * reports the playhead the caller put in &p= to Yanhekt in the background.
 * See "Watch progress" below for why this rides an existing request.
 *
 * Caching (Cache API): one shared video TOKEN (anonymous mint, ~its real
 * lifetime), plus raw VOD m3u8 bodies and full 200 segment bodies keyed by
 * upstream URL alone — recorded content is immutable and byte-identical for
 * every viewer, so the cache is deliberately shared across login tokens.
 * Client `t=` is still required (32-hex 403) so cache hits are not free.
 */
import { md5 } from './md5';
import { getClientSignature, signMediaUrl } from './yanhekt';
interface Env {}

const TOKEN_ENDPOINT = 'https://cbiz.yanhekt.cn/v1/auth/video/token?id=0';
const PROGRESS_ENDPOINT = 'https://cbiz.yanhekt.cn/v1/course/session/user/progress';
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.3';

/** Headers sent to cvideo.yanhekt.cn when fetching media. */
const MEDIA_HEADERS: Record<string, string> = {
  Origin: 'https://www.yanhekt.cn',
  Referer: 'https://www.yanhekt.cn/',
  'User-Agent': USER_AGENT,
};

/** Headers sent to cbiz.yanhekt.cn when minting the video token (no user Bearer). */
function tokenHeaders(): Record<string, string> {
  return {
    ...MEDIA_HEADERS,
    'xdomain-client': 'web_user',
    'Xdomain-Client': 'web_user',
    'Xclient-Version': 'v1',
    'Xclient-Signature': getClientSignature(),
    'Xclient-Timestamp': Math.floor(Date.now() / 1000).toString(),
  };
}

// Yanhekt login tokens are always 32 hex chars (md5-shaped). Since cache hits
// never touch upstream (which is what would reject a bad token), reject
// malformed tokens up front so junk requests can't be served shared cached
// media for free. NOTE: this is a format check only — a well-formed but
// expired/revoked token still gets cache hits until the entry expires.
export const LOGIN_TOKEN_RE = /^[0-9a-f]{32}$/i;

// Optional watch-progress params. Both are caller-supplied and reach Yanhekt,
// so they are validated as strict integers rather than passed through.
const SESSION_ID_RE = /^[0-9]{1,12}$/;
const SECONDS_RE = /^[0-9]{1,7}$/;

/** `sid=` if it is a plausible session id, else null (absent = feature off). */
export function parseSessionId(raw: string | null): string | null {
  return raw && SESSION_ID_RE.test(raw) ? raw : null;
}

/** `p=` if it is a plausible playhead in seconds, else null. */
export function parseSeconds(raw: string | null): number | null {
  if (!raw || !SECONDS_RE.test(raw)) return null;
  const seconds = Number(raw);
  return seconds > 0 ? seconds : null;
}

// The relay signs and fetches whatever `u` points at, so restrict it to
// Yanhekt hosts — otherwise any token holder can use the relay as an open
// fetch proxy. Recorded media lives on cvideo.yanhekt.cn.
export function isAllowedUpstream(rawUrl: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return false;
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return false;
  const host = parsed.hostname.toLowerCase();
  return host === 'yanhekt.cn' || host.endsWith('.yanhekt.cn');
}

const CORS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,OPTIONS',
  'Access-Control-Allow-Headers': 'Range,Content-Type',
  'Access-Control-Expose-Headers': 'Content-Length,Content-Range,Accept-Ranges',
};

// ---- Video token: Cache API + in-isolate coalescing -----------------------

const inflight = new Map<string, Promise<string>>();

function tokenCacheKey(): { url: string; req: Request } {
  // Shared: Yanhekt mints Xvideo_Token without a login Bearer, so one cache
  // entry serves every viewer. `t=` is only the relay access gate.
  const url = 'https://yanhekt-proxy.cache/token/anon';
  return { url, req: new Request(url) };
}

async function getVideoToken(ctx: ExecutionContext): Promise<string> {
  const { url, req } = tokenCacheKey();
  const cache = caches.default;

  const cached = await cache.match(req);
  if (cached) {
    const { token } = (await cached.json()) as { token?: string };
    if (token) return token;
  }

  const existing = inflight.get(url);
  if (existing) return existing;

  const p = (async () => {
    const res = await fetch(TOKEN_ENDPOINT, { headers: tokenHeaders() });
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

function invalidateToken(ctx: ExecutionContext): void {
  const { url, req } = tokenCacheKey();
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
  ctx: ExecutionContext,
  noCache: boolean
): Promise<{ status: number; body: string }> {
  if (noCache) {
    const res = await fetchSignedMedia(rawUrl, ctx, null);
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
    const res = await fetchSignedMedia(rawUrl, ctx, null);
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
  ctx: ExecutionContext,
  range: string | null,
  noCache: boolean
): Promise<Response> {
  const cache = caches.default;

  if (!noCache) {
    const cached = await cache.match(segmentCacheKey(rawUrl, range));
    if (cached) return cached;
  }

  const res = await fetchSignedMedia(rawUrl, ctx, range);
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

export async function fetchSignedMedia(
  rawUrl: string,
  ctx: ExecutionContext,
  range: string | null
): Promise<Response> {
  const maxAttempts = 3;
  let token = await getVideoToken(ctx);
  let last: Response | null = null;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    if (attempt > 0) {
      // Previous attempt was a 403: re-mint a fresh token, then re-sign.
      invalidateToken(ctx);
      token = await getVideoToken(ctx);
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

// ---- Watch progress -------------------------------------------------------
// Yanhekt keeps a per-account playhead for each recorded session and the
// official player PUTs it every 5 seconds while playing. Doing that from the
// browser would cost one Worker request per heartbeat — ~1000 for a 90-minute
// lecture, four times what the segments themselves cost. But the browser is
// already asking us for a segment every ~20s, and a fetch *inside* a Worker is
// a subrequest, which is not billed as a request. So the heartbeat rides along:
// the player appends its true playhead as `p=` to each segment URL (the relay
// cannot infer it — hls.js fetches up to a full buffer ahead of the playhead)
// and we forward it in the background while the segment streams.
//
// This is the one place the relay forwards `t=` to Yanhekt, as the Bearer the
// progress API requires. It only ever happens when the caller opts in by
// sending `sid=`, so a deployment whose player never sends it behaves exactly
// as before.

// Collapses the burst of fragment fetches hls.js issues at one playhead on
// open into a single PUT. Per-isolate and therefore best-effort; the cost of
// missing is one redundant PUT, so it is deliberately not made durable.
const lastProgress = new Map<string, number>();

async function reportProgress(
  sessionId: string,
  seconds: number,
  loginToken: string
): Promise<void> {
  const key = `${loginToken}:${sessionId}`;
  if (lastProgress.get(key) === seconds) return;
  // Unbounded growth would outlive any usefulness; the map is a dedupe hint.
  if (lastProgress.size > 500) lastProgress.clear();
  lastProgress.set(key, seconds);

  try {
    await fetch(PROGRESS_ENDPOINT, {
      method: 'PUT',
      headers: {
        ...tokenHeaders(),
        Authorization: `Bearer ${loginToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ session_id: sessionId, seconds }),
    });
  } catch {
    // A dropped heartbeat costs nothing — the next segment is ~20s away.
  }
}

// ---- m3u8 rewriting -------------------------------------------------------

export function rewriteM3u8(
  content: string,
  baseUrl: string,
  origin: string,
  t: string,
  noCache: boolean,
  sid: string | null = null
): string {
  const tEnc = encodeURIComponent(t);
  // `sid` rides into every child URL (nested variant playlists included) so the
  // segment requests that follow can report progress. Safe to bake in: only the
  // RAW upstream m3u8 is cached — this rewrite happens per request.
  const suffix = `${noCache ? '&nocache=1' : ''}${sid ? `&sid=${sid}` : ''}`;
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
        if (!isAllowedUpstream(u)) return text('Upstream host not allowed', 403);
        const noCache = url.searchParams.get('nocache') === '1';
        // Optional, and never fatal: bad values just mean "don't report".
        const sid = parseSessionId(url.searchParams.get('sid'));

        if (url.pathname === '/playlist') {
          const raw = await getRawPlaylist(u, ctx, noCache);
          if (raw.status !== 200) {
            return text(`Upstream playlist request failed with status ${raw.status}`, raw.status === 403 ? 403 : 502);
          }
          const rewritten = rewriteM3u8(raw.body, u, origin, t, noCache, sid);
          return text(rewritten, 200, 'application/vnd.apple.mpegurl');
        }

        const res = await getSegment(u, ctx, request.headers.get('Range'), noCache);
        const seconds = parseSeconds(url.searchParams.get('p'));
        // Only for media that actually reached the viewer, and in the background
        // so the segment is never held up by the heartbeat.
        if (sid && seconds !== null && res.status < 400) {
          ctx.waitUntil(reportProgress(sid, seconds, t));
        }
        return streamMedia(res);
      }

      return text('Not found', 404);
    } catch (err) {
      return text(`Proxy error: ${err instanceof Error ? err.message : String(err)}`, 502);
    }
  },
} satisfies ExportedHandler<Env>;
