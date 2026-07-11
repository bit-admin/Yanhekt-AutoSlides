/**
 * Authenticated pass-through proxy for the yanhekt.cn data API.
 *
 * cbiz.yanhekt.cn sends no CORS headers, so the browser frontend cannot call
 * it directly. This route forwards allowlisted GET requests upstream with the
 * required client-signature headers injected, re-attaching the caller's
 * Bearer token. The `{code, message, data}` envelope is returned untouched
 * and interpreted client-side.
 */
import { Hono } from "hono";
import type { Env } from "../env";
import { upstreamHeaders } from "../lib/yanhekt";

const UPSTREAM_BASE = "https://cbiz.yanhekt.cn";

/**
 * Only the endpoints the frontend actually uses are forwarded — this proxy
 * must not be an open relay onto the yanhekt API.
 */
const ALLOWED_PATH_PREFIXES = [
  "/v1/user",
  "/v2/live/list",
  "/v2/course/list",
  "/v2/course/private/list",
  "/v1/course",
  "/v2/course/session/list",
  "/v1/tag/list",
];

export const yanhektProxyRouter = new Hono<{ Bindings: Env }>();

yanhektProxyRouter.get("/*", async (c) => {
  const url = new URL(c.req.url);
  const upstreamPath = url.pathname.replace(/^\/api\/yanhekt/, "");

  const allowed = ALLOWED_PATH_PREFIXES.some(
    (prefix) => upstreamPath === prefix || upstreamPath.startsWith(`${prefix}/`),
  );
  if (!allowed) {
    return c.json({ success: false, error: "Not Found" }, 404);
  }

  const authHeader = c.req.header("Authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice("Bearer ".length) : null;

  // Forward url.search verbatim — query keys like `semesters[]=` must reach
  // the upstream unre-serialized.
  const upstreamResponse = await fetch(`${UPSTREAM_BASE}${upstreamPath}${url.search}`, {
    headers: upstreamHeaders(token),
  });

  return new Response(upstreamResponse.body, {
    status: upstreamResponse.status,
    headers: {
      "Content-Type": upstreamResponse.headers.get("Content-Type") ?? "application/json",
      "Cache-Control": "no-store",
    },
  });
});

yanhektProxyRouter.all("/*", (c) => c.json({ success: false, error: "Method not allowed" }, 405));
