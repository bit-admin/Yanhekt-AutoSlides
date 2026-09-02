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

const UPSTREAM_BASE = "https://cbiz.yanhekt.cn";

/** Same check as relay/src/index.ts — reject before any cache/upstream hop. */
const LOGIN_TOKEN_RE = /^[0-9a-f]{32}$/i;

/**
 * Only the endpoint+method pairs the frontend actually uses are forwarded —
 * this proxy must not be an open relay onto the yanhekt API. Write methods
 * are matched exactly per path (no prefix-widening a read allowance into a
 * write one).
 */
const ALLOWED_PATHS: Record<string, string[]> = {
  GET: [
    "/v1/user",
    "/v1/cas/logout",
    "/v2/live/list",
    "/v2/course/list",
    "/v2/course/private/list",
    "/v1/course",
    "/v2/course/session/list",
    "/v1/tag/list",
    "/v1/note",
    "/v1/note/list",
    "/v1/note/group/list",
  ],
  POST: ["/v1/note", "/v1/note/group", "/v1/minio/upload", "/v1/course/subscription"],
  PUT: ["/v1/note", "/v1/note/content"],
  DELETE: ["/v1/note", "/v1/note/group", "/v1/course/subscription"],
};

function isAllowed(method: string, upstreamPath: string): boolean {
  const paths = ALLOWED_PATHS[method];
  if (!paths) return false;
  if (method === "GET") {
    // Reads keep the historical prefix semantics (e.g. /v1/course/<id>).
    return paths.some((prefix) => upstreamPath === prefix || upstreamPath.startsWith(`${prefix}/`));
  }
  return paths.includes(upstreamPath);
}

function parseLoginToken(authHeader: string | undefined): string | null {
  if (!authHeader?.startsWith("Bearer ")) return null;
  const token = authHeader.slice("Bearer ".length).trim();
  return token.length > 0 ? token : null;
}

/**
 * Paths Yanhekt serves without a user Bearer (2026-08-13 probes). Personal
 * live (`user_relationship_type=1`), session list, subscriptions, notes,
 * and /v1/user still need the token forwarded.
 *
 * Keep in step with the Electron `allowAnonymous` opt-ins in
 * autoslides/src/main/platform/apiClient.ts (`preferAnonymousApiRequests`):
 *   anonymous-ok : getCourseList (/v2/course/list), getCourseInfo first hop
 *                  (/v1/course), public getLiveList / searchLiveList
 *                  (/v2/live/list, user_relationship_type !== 1),
 *                  getTagList (/v1/tag/list, always), getVideoToken
 *   never        : session list, personal live/course, subscriptions,
 *                  /v1/user, logout, notes, MinIO
 * yanhektProxy.test.ts asserts this table.
 */
function isAnonymousUpstream(method: string, path: string, search: URLSearchParams): boolean {
  if (method !== "GET") return false;
  if (path === "/v1/tag/list" || path.startsWith("/v1/tag/list/")) return true;
  if (path === "/v2/course/list" || path.startsWith("/v2/course/list/")) return true;
  if (path === "/v1/course") return true;
  if (path === "/v1/course/session") return true;
  if (path === "/v2/live/list" || path.startsWith("/v2/live/list/")) {
    return search.get("user_relationship_type") !== "1";
  }
  return false;
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
    isAnonymousUpstream(method, upstreamPath, url.searchParams) ? null : token,
  );
  let body: ArrayBuffer | undefined;
  if (method !== "GET") {
    // Forward the caller's body bytes and Content-Type verbatim — for
    // multipart uploads the incoming header carries the form boundary.
    body = await c.req.arrayBuffer();
    const contentType = c.req.header("Content-Type");
    if (contentType) {
      headers["Content-Type"] = contentType;
    }
  }

  // Forward url.search verbatim — query keys like `semesters[]=` must reach
  // the upstream unre-serialized.
  const upstreamResponse = await fetch(`${UPSTREAM_BASE}${upstreamPath}${url.search}`, {
    method,
    headers,
    body,
  });

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
