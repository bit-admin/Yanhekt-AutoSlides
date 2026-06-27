/**
 * Cloudflare Worker for the AutoSlides share viewer + AutoSlides Index.
 *
 * The viewer and the apex site are emitted as real static assets (dist/v1/** and
 * dist/index.html) and served directly by Cloudflare's asset layer WITHOUT
 * invoking this Worker. So the Worker runs only for the genuinely dynamic paths,
 * to keep Worker usage near zero for ordinary viewing:
 *
 *   v1 (unchanged — short links):
 *     POST /v1/api/shorten { fragment }  -> { id, url }   (idempotent, KV write)
 *     GET  /v1/api/get?id=<id>           -> { fragment }   (KV read)
 *     GET  /v1/s/<id>                     -> the /v1 SPA shell
 *
 *   v2 (AutoSlides Index — see v2.ts):
 *     POST /v2/api/publish               -> verify token, upsert lecture+version
 *     GET  /v2/api/search?q=             -> lecture search (Cache-API wrapped)
 *     GET  /v2/api/lecture?courseId&...  -> lecture + its versions
 *     GET  /v2/api/stats                 -> homepage aggregates (KV, cron-built)
 *
 *   scheduled (cron): recompute /v2 homepage aggregates into KV.
 *
 * Long-link views (/v1/#<payload>), the apex site (/), and every static asset are
 * served by the asset layer with no Worker invocation at all.
 */

import { decodeSharePayload } from '../../autoslides/src/shared/shareLink';
import {
  CORS_HEADERS,
  MAX_FRAGMENT_BYTES,
  ensureShortLink,
  json,
  type Env,
  type ExecutionContext,
} from './lib/runtime';
import { refreshStats, routeV2 } from './v2';

async function handleShorten(req: Request, env: Env, origin: string): Promise<Response> {
  let body: { fragment?: unknown };
  try {
    body = (await req.json()) as { fragment?: unknown };
  } catch {
    return json({ error: 'bad-json' }, 400);
  }
  const fragment = body.fragment;
  if (typeof fragment !== 'string' || fragment.length === 0) {
    return json({ error: 'missing-fragment' }, 400);
  }
  if (new TextEncoder().encode(fragment).length > MAX_FRAGMENT_BYTES) {
    return json({ error: 'too-large' }, 413);
  }
  if (!decodeSharePayload(fragment)) {
    return json({ error: 'invalid-payload' }, 400);
  }
  const id = await ensureShortLink(env, fragment);
  return json({ id, url: `${origin}/v1/s/${id}` });
}

async function handleGet(url: URL, env: Env): Promise<Response> {
  const id = url.searchParams.get('id');
  if (!id) return json({ error: 'missing-id' }, 400);
  const fragment = await env.SHARE_KV.get(id);
  if (fragment === null) return json({ error: 'not-found' }, 404);
  return json({ fragment });
}

const SHORT_LINK = /^\/v1\/s\/[A-Za-z0-9]+\/?$/;

export default {
  async fetch(req: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(req.url);
    const { pathname, origin } = url;

    if (req.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    // v2 — AutoSlides Index API. Returns null for non-v2 paths.
    const v2 = await routeV2(req, env, ctx, url, origin);
    if (v2) return v2;

    if (pathname === '/v1/api/shorten' && req.method === 'POST') {
      return handleShorten(req, env, origin);
    }
    if (pathname === '/v1/api/get' && req.method === 'GET') {
      return handleGet(url, env);
    }

    // Short-link view: serve the versioned SPA shell (a real static asset); the
    // page reads its /v1/s/<id> path and calls api/get to resolve the fragment.
    // Fetch the clean directory URL — requesting /v1/index.html explicitly gets a
    // 307 canonicalization redirect to /v1/.
    if (SHORT_LINK.test(pathname)) {
      return env.ASSETS.fetch(new Request(`${origin}/v1/`, req));
    }

    // Any other non-asset path (the Worker is only invoked when no static asset
    // matched) — let the asset layer return its 404.
    return env.ASSETS.fetch(req);
  },

  async scheduled(_event: unknown, env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(refreshStats(env));
  },
};
