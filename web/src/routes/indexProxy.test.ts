import { describe, expect, it, vi } from "vitest";
import { createApp, finalizeApp } from "../app";
import type { Env } from "../env";

function env(extra: Partial<Env> = {}): Env {
  return {
    ASSETS: { fetch: async () => new Response("asset") } as unknown as Fetcher,
    ...extra,
  };
}

function shareStub() {
  return vi.fn(async (_request: Request) => new Response(JSON.stringify({ ok: true }), { headers: { "Content-Type": "application/json" } }));
}

describe("Index proxy routes", () => {
  const app = finalizeApp(createApp());

  it("forwards search with its query string onto the share Worker's /api path", async () => {
    const stub = shareStub();
    const res = await app.request("/api/index/search?q=%E6%B3%9B%E5%87%BD&term=2025-2026-1", {}, env({ SHARE: { fetch: stub } as unknown as Fetcher }));
    expect(res.status).toBe(200);
    const forwarded = new URL(stub.mock.calls[0][0].url);
    expect(forwarded.pathname).toBe("/api/search");
    expect(forwarded.searchParams.get("q")).toBe("泛函");
    expect(forwarded.searchParams.get("term")).toBe("2025-2026-1");
  });

  it("forwards a course's session ids and the term list", async () => {
    const stub = shareStub();
    const e = env({ SHARE: { fetch: stub } as unknown as Fetcher });
    await app.request("/api/index/courses/70101/sessions", {}, e);
    await app.request("/api/index/terms", {}, e);
    expect(stub.mock.calls.map(([r]) => new URL(r.url).pathname)).toEqual(["/api/courses/70101/sessions", "/api/terms"]);
  });

  it("refuses a non-numeric course id without calling the binding", async () => {
    const stub = shareStub();
    const res = await app.request("/api/index/courses/abc/sessions", {}, env({ SHARE: { fetch: stub } as unknown as Fetcher }));
    expect(res.status).toBe(400);
    expect(stub).not.toHaveBeenCalled();
  });

  it("answers 503 when the binding is missing", async () => {
    const res = await app.request("/api/index/search?q=x", {}, env());
    expect(res.status).toBe(503);
    expect(await res.json()).toMatchObject({ error: "index-binding-not-configured" });
  });
});
