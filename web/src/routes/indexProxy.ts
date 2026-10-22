/**
 * Same-origin Index API (course search over past terms, a course's session ids)
 * onto the sibling share Worker via the SHARE service binding. The browser
 * talks only to this host.
 *
 *   GET /api/index/search?q=&term=           → GET /api/search?q=&term=
 *   GET /api/index/courses/<id>/sessions      → GET /api/courses/<id>/sessions
 *   GET /api/index/terms                      → GET /api/terms
 *
 * Exact paths only. The query string is passed through as-is; the callee
 * validates it and answers its own JSON errors. Unbound (no `services` SHARE)
 * → 503.
 */
import { Hono, type Context } from "hono";
import type { Env } from "../env";

export const indexProxyRouter = new Hono<{ Bindings: Env }>();

function unbound(): Response {
  return new Response(
    JSON.stringify({ error: "index-binding-not-configured", message: "the Index is not configured on this deployment" }),
    { status: 503, headers: { "Content-Type": "application/json; charset=utf-8" } },
  );
}

function forward(c: Context<{ Bindings: Env }>, upstreamPath: string): Promise<Response> | Response {
  if (!c.env.SHARE) return unbound();
  const search = new URL(c.req.url).search;
  // A service binding ignores the hostname; only the path and query reach the callee.
  return c.env.SHARE.fetch(new Request(`https://share.internal${upstreamPath}${search}`, { method: "GET" }));
}

indexProxyRouter.get("/search", (c) => forward(c, "/api/search"));
indexProxyRouter.get("/terms", (c) => forward(c, "/api/terms"));
indexProxyRouter.get("/courses/:id/sessions", (c) => {
  const id = c.req.param("id");
  if (!/^\d{1,12}$/.test(id)) {
    return c.json({ error: "bad-param", message: "the course id must be a number", param: "id" }, 400);
  }
  return forward(c, `/api/courses/${id}/sessions`);
});
