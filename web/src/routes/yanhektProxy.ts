/**
 * Authenticated pass-through proxy for the yanhekt.cn data API.
 *
 * cbiz.yanhekt.cn sends no CORS headers, so the browser frontend cannot call
 * it directly. This route forwards allowlisted requests upstream with the
 * required client-signature headers injected, re-attaching the caller's
 * Bearer token. The `{code, message, data}` envelope is returned untouched
 * and interpreted client-side.
 */
import { Hono } from "hono";
import type { Context } from "hono";
import type { Env } from "../env";
import { upstreamHeaders } from "../lib/yanhekt";

const UPSTREAM_BASE = "https://cbiz.yanhekt.cn";

/**
 * Only the endpoint+method pairs the frontend actually uses are forwarded —
 * this proxy must not be an open relay onto the yanhekt API. Write methods
 * are matched exactly per path (no prefix-widening a read allowance into a
 * write one).
 */
const ALLOWED_PATHS: Record<string, string[]> = {
  GET: [
    "/v1/user",
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
  POST: ["/v1/note", "/v1/note/group", "/v1/minio/upload"],
  PUT: ["/v1/note", "/v1/note/content"],
  DELETE: ["/v1/note", "/v1/note/group"],
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

export const yanhektProxyRouter = new Hono<{ Bindings: Env }>();

async function forward(c: Context<{ Bindings: Env }>): Promise<Response> {
  const method = c.req.method;
  const url = new URL(c.req.url);
  const upstreamPath = url.pathname.replace(/^\/api\/yanhekt/, "");

  if (!isAllowed(method, upstreamPath)) {
    return c.json({ success: false, error: "Not Found" }, 404);
  }

  const authHeader = c.req.header("Authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice("Bearer ".length) : null;

  const headers = upstreamHeaders(token);
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
