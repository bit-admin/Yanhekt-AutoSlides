/**
 * Authenticated pass-through proxy for the yanhekt.cn data API.
 *
 * cbiz.yanhekt.cn sends no CORS headers, so the browser frontend cannot call
 * it directly. Every `/api/yanhekt/*` request from the SPA must carry a
 * 32-hex login token (same early-403 gate as relay/`t=`); missing/malformed
 * tokens are rejected before any upstream work. When forwarding to Yanhekt,
 * Authorization is omitted on endpoints that work anonymously (catalog,
 * public live, course detail, tag list) and kept on personal/session-list/
 * notes/account calls. The `{code, message, data}` envelope is returned
 * untouched and interpreted client-side.
 */
import { Hono } from "hono";
import type { Context } from "hono";
import type { Env } from "../env";
import { upstreamHeaders } from "../lib/yanhekt";
import { BODY_LIMITS, readRequestLimited, tooLarge } from "../lib/body";
import { UPSTREAM_TIMEOUTS_MS, fetchUpstream, isUpstreamFailure } from "../lib/upstream";
import { endpointFor, omitsCredential } from "../lib/yanhektEndpoints";

const UPSTREAM_BASE = "https://cbiz.yanhekt.cn";

/** Same check as relay/src/index.ts — reject before any cache/upstream hop. */
const LOGIN_TOKEN_RE = /^[0-9a-f]{32}$/i;

/**
 * Only the endpoint+method pairs the frontend actually uses are forwarded —
 * this proxy must not be an open relay onto the yanhekt API. The pairs, and
 * which of them go without the user's Bearer, are the table in
 * lib/yanhektEndpoints.ts.
 */
const isAllowed = (method: string, upstreamPath: string): boolean => endpointFor(method, upstreamPath) !== null;

function parseLoginToken(authHeader: string | undefined): string | null {
  if (!authHeader?.startsWith("Bearer ")) return null;
  const token = authHeader.slice("Bearer ".length).trim();
  return token.length > 0 ? token : null;
}

export const yanhektProxyRouter = new Hono<{ Bindings: Env }>();

async function forward(c: Context<{ Bindings: Env }>): Promise<Response> {
  const method = c.req.method;
  const url = new URL(c.req.url);
  const upstreamPath = url.pathname.replace(/^\/api\/yanhekt/, "");

  if (!isAllowed(method, upstreamPath)) {
    return c.json({ success: false, error: "Not Found" }, 404);
  }

  // Gate first — same idea as relay's `t=` 32-hex 403 before cache/upstream.
  const token = parseLoginToken(c.req.header("Authorization"));
  if (!token || !LOGIN_TOKEN_RE.test(token)) {
    return c.json({ success: false, error: "Invalid login token" }, 403);
  }

  const headers = upstreamHeaders(
    omitsCredential(method, upstreamPath, url.searchParams) ? null : token,
  );
  let body: Uint8Array | undefined;
  if (method !== "GET") {
    // Forward the caller's body bytes and Content-Type verbatim — for
    // multipart uploads the incoming header carries the form boundary.
    const read = await readRequestLimited(c.req.raw, BODY_LIMITS.yanhekt);
    if (read === null) return tooLarge(BODY_LIMITS.yanhekt);
    body = read;
    const contentType = c.req.header("Content-Type");
    if (contentType) {
      headers["Content-Type"] = contentType;
    }
  }

  // Forward url.search verbatim — query keys like `semesters[]=` must reach
  // the upstream unre-serialized.
  const upstreamResponse = await fetchUpstream(
    (signal) => fetch(`${UPSTREAM_BASE}${upstreamPath}${url.search}`, { method, headers, body, signal }),
    { caller: c.req.raw.signal, timeoutMs: UPSTREAM_TIMEOUTS_MS.yanhekt },
  );
  // No answer from Yanhekt: fetchUpstream's own 502/504, passed on as is.
  if (isUpstreamFailure(upstreamResponse)) return upstreamResponse;

  return new Response(upstreamResponse.body, {
    status: upstreamResponse.status,
    headers: {
      "Content-Type": upstreamResponse.headers.get("Content-Type") ?? "application/json",
      "Cache-Control": "no-store",
    },
  });
}

yanhektProxyRouter.get("/*", forward);
yanhektProxyRouter.post("/*", forward);
yanhektProxyRouter.put("/*", forward);
yanhektProxyRouter.delete("/*", forward);

yanhektProxyRouter.all("/*", (c) => c.json({ success: false, error: "Method not allowed" }, 405));
