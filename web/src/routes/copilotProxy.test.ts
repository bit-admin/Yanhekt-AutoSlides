import { describe, expect, it, vi } from "vitest";
import { createApp, finalizeApp } from "../app";
import type { Env } from "../env";

const GHO = "gho_0123456789abcdef";

/** Stub COPILOT binding that records the Request it was handed. */
function copilotStub() {
  return vi.fn(
    async (_request: Request) =>
      new Response(JSON.stringify({ ok: true }), { headers: { "Content-Type": "application/json" } }),
  );
}

function env(extra: Partial<Env> = {}): Env {
  return {
    ASSETS: { fetch: async () => new Response("asset") } as unknown as Fetcher,
    ...extra,
  };
}

describe("Copilot proxy routes", () => {
  const app = finalizeApp(createApp());

  it("maps the device-flow poll onto the callee's /api/auth path, dropping browser headers", async () => {
    const fetchStub = copilotStub();
    const res = await app.request(
      "/api/copilot/auth/poll",
      {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: "a=b", "CF-Connecting-IP": "203.0.113.7" },
        body: JSON.stringify({ device_code: "abc" }),
      },
      env({ COPILOT: { fetch: fetchStub } as unknown as Fetcher }),
    );

    expect(res.status).toBe(200);
    expect(fetchStub).toHaveBeenCalledTimes(1);
    const forwarded = fetchStub.mock.calls[0][0];
    expect(forwarded.method).toBe("POST");
    expect(new URL(forwarded.url).pathname).toBe("/api/auth/poll");
    expect(await forwarded.json()).toEqual({ device_code: "abc" });
    expect(forwarded.headers.get("content-type")).toBe("application/json");
    expect(forwarded.headers.get("cookie")).toBeNull();
    expect(forwarded.headers.get("cf-connecting-ip")).toBeNull();
  });

  it("carries the Bearer on identity and chat completions", async () => {
    const fetchStub = copilotStub();
    const bindings = env({ COPILOT: { fetch: fetchStub } as unknown as Fetcher });

    await app.request("/api/copilot/auth/me", { headers: { Authorization: `Bearer ${GHO}` } }, bindings);
    await app.request(
      "/api/copilot/v1/chat/completions",
      { method: "POST", headers: { Authorization: `Bearer ${GHO}` }, body: "{}" },
      bindings,
    );

    const [me, chat] = fetchStub.mock.calls.map(([request]) => request);
    expect(new URL(me.url).pathname).toBe("/api/auth/me");
    expect(me.headers.get("authorization")).toBe(`Bearer ${GHO}`);
    expect(new URL(chat.url).pathname).toBe("/v1/chat/completions");
    expect(chat.headers.get("authorization")).toBe(`Bearer ${GHO}`);
  });

  it("404s anything outside the allowlist without touching the binding", async () => {
    const fetchStub = copilotStub();
    const bindings = env({ COPILOT: { fetch: fetchStub } as unknown as Fetcher });

    const responses = await Promise.all([
      app.request("/api/copilot/v1/models", {}, bindings),
      app.request("/api/copilot/v1/chat/completions", {}, bindings),
      app.request("/api/copilot/api/auth/device", { method: "POST" }, bindings),
      app.request("/api/copilot/", {}, bindings),
    ]);

    expect(responses.map((r) => r.status)).toEqual([404, 404, 404, 404]);
    expect(fetchStub).not.toHaveBeenCalled();
  });

  it("503s an unbound proxy", async () => {
    const res = await app.request("/api/copilot/auth/device", { method: "POST" }, env());
    expect(res.status).toBe(503);
    expect(await res.json()).toMatchObject({ error: { message: "Copilot binding not configured" } });
  });
});
