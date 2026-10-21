/**
 * Cloudflare Worker for share.ruc.edu.kg: the slides share viewer (/v1) and the
 * Index API (/api).
 *
 * The viewer is emitted as real static assets (dist/v1/**) and served directly
 * by Cloudflare's asset layer WITHOUT invoking this Worker. The Worker runs only
 * for the dynamic paths:
 *
 *   v1 (short links + Yanhekt meta):
 *     POST /v1/api/shorten { fragment }  -> { id, url }
 *     GET  /v1/api/get?id=<id>           -> { fragment, meta }
 *     GET  /v1/api/meta?courseId&sessionId -> { meta }  (long-link SPA)
 *     GET  /v1/s/<id>                     -> the /v1 SPA shell
 *
 *   Index API (reads the `yanhekt-index` D1 database; see api/ and docs/api.md):
 *     GET  /api/search?q=…
 *
 *   Retired: the old AutoSlides Index. /v2/api/* answers 503, and / shows a
 *   placeholder until the new Index site exists.
 */

import { decodeSharePayload } from '../../autoslides/src/shared/shareLink';
import {
  CORS_HEADERS,
  MAX_FRAGMENT_BYTES,
  cached,
  ensureShortLink,
  json,
  type Env,
  type ExecutionContext,
} from './lib/runtime';
import { fetchLectureMeta } from './lib/yanhekt';
import { routeApi } from './api/router';

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

async function metaForFragment(fragment: string) {
  const payload = decodeSharePayload(fragment);
  if (!payload) return null;
  if (!payload.c && !payload.s) return null;
  return fetchLectureMeta(payload.c ?? '', payload.s);
}

async function handleGet(url: URL, env: Env): Promise<Response> {
  const id = url.searchParams.get('id');
  if (!id) return json({ error: 'missing-id' }, 400);
  const fragment = await env.SHARE_KV.get(id);
  if (fragment === null) return json({ error: 'not-found' }, 404);
  const meta = await metaForFragment(fragment);
  return json({ fragment, meta });
}

async function handleMeta(req: Request, url: URL, ctx: ExecutionContext): Promise<Response> {
  return cached(req, ctx, 3600, async () => {
    const courseId = url.searchParams.get('courseId') ?? url.searchParams.get('c') ?? '';
    const sessionId = url.searchParams.get('sessionId') ?? url.searchParams.get('s') ?? '';
    if (!courseId && !sessionId) return json({ error: 'missing-ids' }, 400);
    const meta = await fetchLectureMeta(courseId, sessionId || undefined);
    if (!meta) return json({ error: 'not-found' }, 404);
    return json({ ok: true, meta });
  });
}

const SHORT_LINK = /^\/v1\/s\/[A-Za-z0-9]+\/?$/;

const RETIRED_V2 = {
  error: 'retired',
  message: 'The old AutoSlides Index has been retired. A new Index is being built at /api.',
};

const PLACEHOLDER = `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>AutoSlides Index</title>
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
</head>
<body style="font:16px/1.6 -apple-system,BlinkMacSystemFont,'Segoe UI','PingFang SC',sans-serif;max-width:32rem;margin:20vh auto;padding:0 16px">
<p>公共索引正在重建，敬请期待。分享链接（/v1/）照常可用。</p>
<p>The Index is being rebuilt. Shared slide links (/v1/) still work.</p>
</body>
</html>
`;

export default {
  async fetch(req: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(req.url);
    const { pathname, origin } = url;

    if (req.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    const api = await routeApi(req, env, ctx, url);
    if (api) return api;

    if (pathname.startsWith('/v2/')) {
      return json(RETIRED_V2, 503);
    }
    if (pathname === '/' || pathname === '/index.html') {
      return new Response(PLACEHOLDER, {
        status: 503,
        headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
      });
    }

    if (pathname === '/v1/api/shorten' && req.method === 'POST') {
      return handleShorten(req, env, origin);
    }
    if (pathname === '/v1/api/get' && req.method === 'GET') {
      return handleGet(url, env);
    }
    if (pathname === '/v1/api/meta' && req.method === 'GET') {
      return handleMeta(req, url, ctx);
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
};
