/**
 * Same-origin GitHub Copilot routes onto the sibling copilot-proxy Worker via
 * a service binding. The browser talks only to this host; neither this Worker
 * nor the SPA fetches the proxy's public hostname.
 *
 * Exact-match allowlist — only what the SPA's Copilot connect flow and AI
 * filtering call, never a prefix pass-through (the callee also serves its own
 * login console and a model list this app does not use):
 *
 *   POST /api/copilot/auth/device          → POST /api/auth/device
 *   POST /api/copilot/auth/poll            → POST /api/auth/poll
 *   GET  /api/copilot/auth/me              → GET  /api/auth/me
 *   POST /api/copilot/v1/chat/completions  → POST /v1/chat/completions
 *
 * Only `Authorization` (the user's gho_/ghu_ token) and `Content-Type` cross
 * the hop — no cookies or client-IP headers. The callee checks the token, so
 * this router does not. Unbound (no `services` COPILOT) → 503, in the OpenAI
 * error shape both frontend callers already read.
 */
import { Hono, type Context } from "hono";
import type { Env } from "../env";

export const copilotProxyRouter = new Hono<{ Bindings: Env }>();

const FORWARDED_HEADERS = ["authorization", "content-type"];

function unbound(): Response {
  return new Response(
    JSON.stringify({
      error: { message: "Copilot binding not configured", type: "service_unavailable", code: null, param: null },
    }),
    { status: 503, headers: { "Content-Type": "application/json; charset=utf-8" } },
  );
}

async function forward(c: Context<{ Bindings: Env }>, upstreamPath: string): Promise<Response> {
  if (!c.env.COPILOT) return unbound();

  const headers = new Headers();
  for (const name of FORWARDED_HEADERS) {
    const value = c.req.header(name);
    if (value) headers.set(name, value);
  }
  const method = c.req.method;
  const body = method === "GET" || method === "HEAD" ? undefined : await c.req.arrayBuffer();
  // A service binding ignores the hostname; only method, path and headers reach the callee.
  return c.env.COPILOT.fetch(new Request(`https://copilot.internal${upstreamPath}`, { method, headers, body }));
}

copilotProxyRouter.post("/auth/device", (c) => forward(c, "/api/auth/device"));
copilotProxyRouter.post("/auth/poll", (c) => forward(c, "/api/auth/poll"));
copilotProxyRouter.get("/auth/me", (c) => forward(c, "/api/auth/me"));
copilotProxyRouter.post("/v1/chat/completions", (c) => forward(c, "/v1/chat/completions"));
