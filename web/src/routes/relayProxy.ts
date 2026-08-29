/**
 * Same-origin recorded-HLS pass-through onto the sibling relay Worker via a
 * service binding. The browser talks only to this host; we never fetch the
 * relay's public URL from here.
 *
 * Paths stay `/playlist` and `/segment` at this origin: the relay Worker
 * exact-matches those pathnames. Forward `c.req.raw` so Range / query string
 * pass through. After a playlist fetch, rewrite absolute `/playlist|/segment`
 * prefixes to root-relative paths — the bound Worker may emit a different
 * origin than the browser used (local `wrangler dev` vs the deployed host).
 *
 * Unbound (no `services` in wrangler) → 503.
 */
import { Hono } from "hono";
import type { Env } from "../env";

export const relayProxyRouter = new Hono<{ Bindings: Env }>();

function unbound(): Response {
  return new Response("RELAY binding not configured", {
    status: 503,
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}

/** Absolute proxy URLs → `/playlist?` / `/segment?` (does not touch encoded `u=`). */
function relativizeProxyUrls(body: string): string {
  return body.replace(/https?:\/\/[^/\s"']+\/(playlist|segment)\?/g, "/$1?");
}

relayProxyRouter.all("/playlist", async (c) => {
  if (!c.env.RELAY) return unbound();
  const res = await c.env.RELAY.fetch(c.req.raw);
  const type = (res.headers.get("Content-Type") || "").toLowerCase();
  if (res.status !== 200 || (!type.includes("mpegurl") && !type.includes("m3u8"))) {
    return res;
  }
  const body = relativizeProxyUrls(await res.text());
  const headers = new Headers(res.headers);
  headers.delete("Content-Length");
  return new Response(body, { status: res.status, headers });
});

relayProxyRouter.all("/segment", (c) => {
  if (!c.env.RELAY) return unbound();
  return c.env.RELAY.fetch(c.req.raw);
});
