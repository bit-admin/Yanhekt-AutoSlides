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
import { cacheKey, isParamError, parseSearchParams, TERM_KEY } from './searchParams';
import { courseDetails, failureStatus, hasUnavailable, isFailure, sessionDetails } from './yanhekt';

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
/** `/api/courses/{id}/yanhekt` and `/api/courses/{id}/yanhekt/sessions`: live Yanhekt details (api/yanhekt.ts). */
const YANHEKT_PATH = /^\/api\/courses\/([^/]+)\/yanhekt(\/sessions)?$/;

/** Yanhekt details: the course for 6 hours, sessions for 30 minutes (a recording appears some hours after a lecture). */
const COURSE_EDGE_TTL = 6 * 3600;
const SESSIONS_EDGE_TTL = 30 * 60;

declare const caches: { default: Cache };

/** Edge cache for answers that are not keyed by data version alone. `store: false` answers without caching (a partial page). */
async function edge(
  key: string,
  ctx: ExecutionContext,
  ttl: number,
  produce: () => Promise<{ res: Response; store: boolean }>,
): Promise<Response> {
  const req = new Request(key, { method: 'GET' });
  const hit = await caches.default.match(req);
  if (hit) return hit;
  const { res, store } = await produce();
  if (!res.ok || !store) return res;
  const out = new Response(res.body, res);
  out.headers.set('Cache-Control', `public, max-age=${ttl}`);
  ctx.waitUntil(caches.default.put(req, out.clone()));
  return out;
}

async function yanhektRoute(env: Env, ctx: ExecutionContext, url: URL, rawId: string, sessions: boolean): Promise<Response> {
  if (!/^\d{1,12}$/.test(rawId)) {
    return json({ error: 'bad-param', message: 'the course id must be a number', param: 'id' }, 400);
  }
  const id = Number(rawId);
  let res: Response;
  try {
    if (!sessions) {
      res = await edge(`${url.origin}/api/courses/${id}/yanhekt`, ctx, COURSE_EDGE_TTL, async () => {
        const r = await courseDetails(env, id);
        return isFailure(r) ? { res: json(r, failureStatus(r)), store: false } : { res: json({ course: r }), store: true };
      });
    } else {
      const fromRaw = url.searchParams.get('from') ?? '0';
      if (!/^\d{1,4}$/.test(fromRaw)) {
        return json({ error: 'bad-param', message: 'from must be a whole number', param: 'from' }, 400);
      }
      const from = Number(fromRaw);
      const v = await dataVersion(env.YANHEKT_DB);
      const key = `${url.origin}/api/courses/${id}/yanhekt/sessions?from=${from}&v=${encodeURIComponent(v)}`;
      res = await edge(key, ctx, SESSIONS_EDGE_TTL, async () => {
        const r = await sessionDetails(env, id, from);
        return isFailure(r) ? { res: json(r, failureStatus(r)), store: false } : { res: json(r), store: !hasUnavailable(r) };
      });
    }
  } catch (err) {
    console.error('[api] yanhekt', err instanceof Error ? err.message : err);
    return internal();
  }
  if (!res.ok) return res;
  const out = new Response(res.body, res);
  out.headers.set('Cache-Control', `public, max-age=${BROWSER_TTL}`);
  return out;
}

/** `GET /api/terms`: the `INDEX_TERMS` variable (newest first) and the last upload time (the data version). No D1 query of its own. */
export function termList(env: Pick<Env, 'INDEX_TERMS'>, version: string): { updatedAt: number | null; terms: string[] } {
  const terms = [...new Set((env.INDEX_TERMS ?? '').split(',').map((t) => t.trim()))]
    .filter((t) => TERM_KEY.test(t))
    .sort()
    .reverse();
  const updated = Number(version);
  return { updatedAt: Number.isFinite(updated) && updated > 0 ? updated : null, terms };
}

/** Null for paths outside `/api/`. */
export async function routeApi(req: Request, env: Env, ctx: ExecutionContext, url: URL): Promise<Response | null> {
  const { pathname } = url;
  if (pathname !== '/api' && !pathname.startsWith('/api/')) return null;

  const sessions = SESSIONS_PATH.exec(pathname);
  const yanhekt = YANHEKT_PATH.exec(pathname);
  if (pathname !== '/api/search' && pathname !== '/api/terms' && !sessions && !yanhekt) {
    return json({ error: 'not-found', message: `no such endpoint: ${pathname}` }, 404);
  }
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return json({ error: 'method-not-allowed', message: 'use GET' }, 405);
  }

  if (pathname === '/api/terms') {
    let v: string;
    try {
      v = await dataVersion(env.YANHEKT_DB);
    } catch {
      v = '0';
    }
    const res = json(termList(env, v));
    res.headers.set('Cache-Control', `public, max-age=${BROWSER_TTL}`);
    return res;
  }

  if (yanhekt) return yanhektRoute(env, ctx, url, yanhekt[1], !!yanhekt[2]);

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
  // A term outside INDEX_TERMS is refused before D1 (not even the data version is read).
  if (parsed.term !== null && !termList(env, '0').terms.includes(parsed.term)) {
    return json({ error: 'term-not-indexed', message: `term ${parsed.term} is not in the index; see /api/terms`, param: 'term' }, 400);
  }
  return answer(env, ctx, (v) => cacheKey(url.origin, parsed, v), async () => json(await search(env.YANHEKT_DB, parsed)));
}
