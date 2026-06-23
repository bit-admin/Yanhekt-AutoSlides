/**
 * Cloudflare Worker for the AutoSlides share viewer.
 *
 * The viewer and the apex landing are emitted as real static assets (dist/v1/**
 * and dist/index.html) and served directly by Cloudflare's asset layer WITHOUT
 * invoking this Worker. So the Worker runs only for the genuinely dynamic paths,
 * to keep Worker request usage near zero for ordinary viewing:
 *
 *   POST /v1/api/shorten { fragment }  -> { id, url }   (idempotent, KV write)
 *   GET  /v1/api/get?id=<id>           -> { fragment }   (KV read)
 *   GET  /v1/s/<id>                     -> the /v1 SPA shell (the page then calls
 *                                          api/get to resolve the id)
 *
 * Long-link views (/v1/#<payload>), the apex landing (/), and every static asset
 * are served by the asset layer with no Worker invocation at all.
 *
 * Short ids are content-addressed (base62 of SHA-256 of the fragment), so the
 * same payload always maps to one KV entry.
 */

import { decodeSharePayload } from '../../autoslides/src/shared/shareLink';

interface KVNamespace {
  get(key: string): Promise<string | null>;
  put(key: string, value: string): Promise<void>;
}

interface Env {
  ASSETS: { fetch(req: Request): Promise<Response> };
  SHARE_KV: KVNamespace;
}

const MAX_FRAGMENT_BYTES = 8192;
const ID_LENGTH = 10;
const B62 = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function json(body: unknown, status = 200): Response {
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

async function shortId(fragment: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(fragment));
  return base62(new Uint8Array(digest)).slice(0, ID_LENGTH);
}

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
  const id = await shortId(fragment);
  if ((await env.SHARE_KV.get(id)) === null) {
    await env.SHARE_KV.put(id, fragment);
  }
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
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    const { pathname, origin } = url;

    if (req.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

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
};
