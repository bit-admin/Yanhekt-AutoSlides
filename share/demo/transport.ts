/**
 * The demo's data layer: `window.fetch`, wrapped once.
 *
 * The viewer calls its API at absolute paths (`/v1/api/…`), so the wrapper
 * catches them regardless of the `/demo/v1/` base — which is the point: without
 * it, a request from the demo would reach the REAL Worker and the demo would
 * quietly show live data.
 *
 * Unmatched same-origin requests fall through to the real fetch so the demo's
 * own JS, CSS and favicons still load.
 */

import { FILES, fragmentFor, metaFor } from './demoData';

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

    if (url.origin === location.origin) {
      const answered = v1Routes(url.pathname, url.searchParams);
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
