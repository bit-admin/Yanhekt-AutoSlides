/**
 * The Index API: `/api/*`. Read-only, no auth (the zone's WAF limits who can
 * reach it). Contract: docs/api.md.
 *
 * Caching: answers only change when an upload changes D1, and every upload
 * writes a new data version (`meta.data`). Edge cache keys carry that version,
 * so a cached answer is served until the next upload, then never again. The
 * version itself is re-read at most once a minute per Worker instance.
 */

import { cached, json, type D1Database, type Env, type ExecutionContext } from '../lib/runtime';
import { courseSessions, search } from './search';
import { cacheKey, isParamError, parseSearchParams } from './searchParams';

/** Edge: until the next upload (keys change then); a week bounds orphaned entries. */
const EDGE_TTL = 7 * 24 * 3600;
const BROWSER_TTL = 300;
const VERSION_TTL_MS = 60_000;

let version: { value: string; at: number } | null = null;

/** The current data version (`meta.data`), cached in this instance for a minute. */
export async function dataVersion(db: D1Database, now = Date.now()): Promise<string> {
  if (version && now - version.at < VERSION_TTL_MS) return version.value;
  const row = await db.prepare("SELECT value FROM meta WHERE key = 'data'").first<{ value: string }>();
  version = { value: row?.value ?? '0', at: now };
  return version.value;
}

/** Test hook. */
export function forgetDataVersion(): void {
  version = null;
}

const internal = () => json({ error: 'internal', message: 'the index is unavailable; try again later' }, 500);

async function answer(
  env: Env,
  ctx: ExecutionContext,
  key: (version: string) => string,
  produce: () => Promise<Response>,
): Promise<Response> {
  let res: Response;
  try {
    const v = await dataVersion(env.YANHEKT_DB);
    res = await cached(new Request(key(v), { method: 'GET' }), ctx, EDGE_TTL, async () => {
      try {
        return await produce();
      } catch (err) {
        console.error('[api]', err instanceof Error ? err.message : err);
        return internal();
      }
    });
  } catch (err) {
    console.error('[api] data version', err instanceof Error ? err.message : err);
    return internal();
  }
  if (!res.ok) return res;
  const out = new Response(res.body, res);
  out.headers.set('Cache-Control', `public, max-age=${BROWSER_TTL}`);
  return out;
}

const SESSIONS_PATH = /^\/api\/courses\/([^/]+)\/sessions$/;

/** Null for paths outside `/api/`. */
export async function routeApi(req: Request, env: Env, ctx: ExecutionContext, url: URL): Promise<Response | null> {
  const { pathname } = url;
  if (pathname !== '/api' && !pathname.startsWith('/api/')) return null;

  const sessions = SESSIONS_PATH.exec(pathname);
  if (pathname !== '/api/search' && !sessions) {
    return json({ error: 'not-found', message: `no such endpoint: ${pathname}` }, 404);
  }
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return json({ error: 'method-not-allowed', message: 'use GET' }, 405);
  }

  if (sessions) {
    if (!/^\d{1,12}$/.test(sessions[1])) {
      return json({ error: 'bad-param', message: 'the course id must be a number', param: 'id' }, 400);
    }
    const id = Number(sessions[1]);
    return answer(env, ctx, (v) => `${url.origin}/api/courses/${id}/sessions?v=${encodeURIComponent(v)}`, async () => {
      const found = await courseSessions(env.YANHEKT_DB, id);
      return found ? json(found) : json({ error: 'not-found', message: `no course ${id} in the index` }, 404);
    });
  }

  const parsed = parseSearchParams(url.searchParams);
  if (isParamError(parsed)) return json(parsed, 400);
  return answer(env, ctx, (v) => cacheKey(url.origin, parsed, v), async () => json(await search(env.YANHEKT_DB, parsed)));
}
