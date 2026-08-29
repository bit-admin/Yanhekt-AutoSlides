/**
 * Same-origin `/api/ai/*` pass-through onto `AI_ORIGIN` (wrangler vars).
 * The browser talks only to this host. `/api/ai` is stripped so the callee
 * sees `/model` and `/chat/completions`. Auth is the caller's Bearer — this
 * router does not re-check it.
 *
 * Outbound `User-Agent` is `AutoSlides/web` — same prefix the desktop app
 * sends to first-party hosts; not a product semver, so the builtin origin
 * keeps the legacy completion rewrite (correct for the web SPA).
 *
 * Unset / empty / unparseable → 503.
 */
import { Hono } from "hono";
import type { Env } from "../env";

export const aiProxyRouter = new Hono<{ Bindings: Env }>();

const PREFIX = "/api/ai";

/** Same `AutoSlides/` prefix as Electron `appUserAgent()`; not a 5.x version. */
const OUTBOUND_UA = "AutoSlides/web";

function unbound(): Response {
  return new Response(JSON.stringify({ success: false, error: "AI origin not configured" }), {
    status: 503,
    headers: { "Content-Type": "application/json" },
  });
}

function resolveOrigin(raw: string | undefined): string | null {
  const trimmed = (raw ?? "").trim();
  if (!trimmed) return null;
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return null;
    return parsed.origin;
  } catch {
    return null;
  }
}

function targetUrl(origin: string, incoming: URL): string {
  let path = incoming.pathname;
  if (path === PREFIX || path === `${PREFIX}/`) path = "/";
  else if (path.startsWith(`${PREFIX}/`)) path = path.slice(PREFIX.length);
  return `${origin}${path}${incoming.search}`;
}

aiProxyRouter.all("/*", async (c) => {
  const origin = resolveOrigin(c.env.AI_ORIGIN);
  if (!origin) return unbound();

  const headers = new Headers(c.req.raw.headers);
  for (const name of [
    "host",
    "cookie",
    "cf-connecting-ip",
    "cf-ipcountry",
    "cf-ray",
    "cf-visitor",
    "cdn-loop",
    "x-forwarded-for",
    "x-real-ip",
  ]) {
    headers.delete(name);
  }
  headers.set("User-Agent", OUTBOUND_UA);

  const method = c.req.method;
  const body = method === "GET" || method === "HEAD" ? undefined : await c.req.arrayBuffer();
  return fetch(targetUrl(origin, new URL(c.req.url)), { method, headers, body });
});
