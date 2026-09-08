/**
 * The demo's data layer: `window.fetch`, wrapped once.
 *
 * Both apps call their APIs at absolute paths (`/v2/api/…`, `/v1/api/…`), so
 * the wrapper catches them regardless of the `/demo/` base — which is the point:
 * without it, a request from `/demo/` would reach the REAL Worker and the demo
 * would quietly show live data.
 *
 * Unmatched same-origin requests fall through to the real fetch so the demo's
 * own JS, CSS and favicons still load.
 */

import {
  FILES,
  fragmentFor,
  lecturePayload,
  metaFor,
  searchPayload,
  statsPayload,
} from './demoData';

const REAL_FETCH = globalThis.fetch.bind(globalThis);

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

/** Everything answers a beat late, so loading states are reachable but not janky. */
function delay<T>(value: T, ms = 90): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms));
}

function semesterIdsOf(params: URLSearchParams): string[] {
  const raw = params.getAll('semesterIds').concat(params.getAll('semesterId'));
  return raw.flatMap((value) => value.split(',').map((v) => v.trim())).filter(Boolean);
}

function v2Routes(path: string, params: URLSearchParams, method: string, auth: string | null): Response | null {
  if (path === '/v2/api/stats') {
    return json({ ok: true, stats: statsPayload() });
  }
  if (path === '/v2/api/search') {
    const query = params.get('q') ?? '';
    return json({ ok: true, query, results: searchPayload(query, semesterIdsOf(params)) });
  }
  if (path === '/v2/api/lecture') {
    const found = lecturePayload(params.get('courseId') ?? '', params.get('sessionId') ?? '');
    return found ? json({ ok: true, ...found }) : json({ ok: false, error: 'not-found' }, 404);
  }
  if (path === '/v2/api/request-removal' && method === 'POST') {
    // The demo signs nobody in, so nothing here was uploaded by the caller.
    if (!auth) return json({ error: 'unauthorized' }, 401);
    return json({ ok: true, removed: 0, lectureRemoved: false });
  }
  return null;
}

function v1Routes(path: string, params: URLSearchParams): Response | null {
  if (path === '/v1/api/meta') {
    const meta = metaFor(
      params.get('courseId') ?? params.get('c') ?? '',
      params.get('sessionId') ?? params.get('s') ?? '',
    );
    return meta ? json({ ok: true, meta }) : json({ error: 'not-found' }, 404);
  }
  if (path === '/v1/api/get') {
    const file = FILES.find((f) => f.shareId === (params.get('id') ?? ''));
    if (!file) return json({ error: 'not-found' }, 404);
    return json({ fragment: fragmentFor(file.shareId), meta: metaFor(file.courseId, file.sessionId) });
  }
  return null;
}

export function installTransport(): void {
  const wrapped: typeof fetch = async (input, init) => {
    const request = input instanceof Request ? input : null;
    const raw = request ? request.url : String(input instanceof URL ? input.href : input);
    const url = new URL(raw, location.origin);
    const method = (init?.method ?? request?.method ?? 'GET').toUpperCase();
    const auth =
      (init?.headers ? new Headers(init.headers).get('Authorization') : null) ??
      request?.headers.get('Authorization') ??
      null;

    if (url.origin === location.origin) {
      const answered =
        v2Routes(url.pathname, url.searchParams, method, auth) ??
        v1Routes(url.pathname, url.searchParams);
      if (answered) return delay(answered);
      // The demo's own assets.
      return REAL_FETCH(input, init);
    }

    // Slide pixels come from `demoHooks.resolveImages`, so nothing should be
    // listing the public bucket. Answer rather than let a request escape.
    if (url.hostname.endsWith('yanhekt.cn')) return json({ error: 'offline in demo' }, 404);

    return json({ error: 'offline in demo' }, 503);
  };

  globalThis.fetch = wrapped;
}
