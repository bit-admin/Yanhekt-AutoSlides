/**
 * Same-origin short-link resolve onto the sibling share Worker via a service
 * binding. The browser talks only to this host; we never fetch
 * share.ruc.edu.kg from here (or from the SPA).
 *
 * GET /api/share/get?id=<shortId> → SHARE.fetch GET /v1/api/get?id=<shortId>
 * Unbound (no `services` SHARE) → 503.
 */
import { Hono } from "hono";
import type { Env } from "../env";

export const shareProxyRouter = new Hono<{ Bindings: Env }>();

const SHORT_ID = /^[A-Za-z0-9]{1,64}$/;

function unbound(): Response {
  return new Response(JSON.stringify({ error: "share-binding-not-configured" }), {
    status: 503,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}

shareProxyRouter.get("/get", async (c) => {
  if (!c.env.SHARE) return unbound();
  const id = (c.req.query("id") ?? "").trim();
  if (!SHORT_ID.test(id)) {
    return c.json({ error: "missing-id" }, 400);
  }
  const url = new URL("https://share.internal/v1/api/get");
  url.searchParams.set("id", id);
  return c.env.SHARE.fetch(new Request(url.toString(), { method: "GET" }));
});
