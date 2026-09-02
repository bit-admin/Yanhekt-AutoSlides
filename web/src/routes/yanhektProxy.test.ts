import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../app";
import type { Env } from "../env";

const TOKEN = "0123456789abcdef0123456789abcdef";

const fetchSpy = vi.fn(async () => new Response('{"code":0,"data":[]}', { headers: { "Content-Type": "application/json" } }));

function env(): Env {
  return { ASSETS: { fetch: async () => new Response("asset") } as unknown as Fetcher };
}

function upstreamCall(index = 0): { url: string; headers: Record<string, string>; method: string } {
  const call = fetchSpy.mock.calls[index] as unknown as [string, RequestInit];
  return { url: call[0], headers: call[1].headers as Record<string, string>, method: call[1].method as string };
}

describe("/api/yanhekt proxy", () => {
  const app = createApp();

  beforeEach(() => {
    fetchSpy.mockClear();
    vi.stubGlobal("fetch", fetchSpy);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("403s without a Bearer before any upstream fetch", async () => {
    const res = await app.request("/api/yanhekt/v2/course/list", {}, env());
    expect(res.status).toBe(403);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("403s a malformed Bearer before any upstream fetch", async () => {
    const res = await app.request(
      "/api/yanhekt/v2/course/list",
      { headers: { Authorization: "Bearer not-a-token" } },
      env(),
    );
    expect(res.status).toBe(403);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("404s paths outside the allowlist", async () => {
    const res = await app.request(
      "/api/yanhekt/v1/auth/video/token?id=0",
      { headers: { Authorization: `Bearer ${TOKEN}` } },
      env(),
    );
    expect(res.status).toBe(404);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("strips the user Bearer on anonymous-safe catalog reads and keeps the query verbatim", async () => {
    const res = await app.request(
      "/api/yanhekt/v2/course/list?semesters[]=1&keyword=x",
      { headers: { Authorization: `Bearer ${TOKEN}` } },
      env(),
    );
    expect(res.status).toBe(200);
    const call = upstreamCall();
    expect(call.url).toBe("https://cbiz.yanhekt.cn/v2/course/list?semesters[]=1&keyword=x");
    expect(call.headers.Authorization).toBeUndefined();
    expect(call.headers["Xclient-Signature"]).toBe("72b77856f6df3f563ab6e658631cac3d");
  });

  it("keeps the Bearer for the personal live list", async () => {
    await app.request(
      "/api/yanhekt/v2/live/list?user_relationship_type=1",
      { headers: { Authorization: `Bearer ${TOKEN}` } },
      env(),
    );
    expect(upstreamCall().headers.Authorization).toBe(`Bearer ${TOKEN}`);
  });

  it("strips the Bearer for the public live list", async () => {
    await app.request("/api/yanhekt/v2/live/list?page=1", { headers: { Authorization: `Bearer ${TOKEN}` } }, env());
    expect(upstreamCall().headers.Authorization).toBeUndefined();
  });

  it("keeps the Bearer for the session list, /v1/user and note writes", async () => {
    await app.request(
      "/api/yanhekt/v2/course/session/list?course_id=1",
      { headers: { Authorization: `Bearer ${TOKEN}` } },
      env(),
    );
    await app.request("/api/yanhekt/v1/user", { headers: { Authorization: `Bearer ${TOKEN}` } }, env());
    await app.request(
      "/api/yanhekt/v1/note",
      { method: "POST", headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" }, body: "{}" },
      env(),
    );
    expect(upstreamCall(0).headers.Authorization).toBe(`Bearer ${TOKEN}`);
    expect(upstreamCall(1).headers.Authorization).toBe(`Bearer ${TOKEN}`);
    expect(upstreamCall(2).headers.Authorization).toBe(`Bearer ${TOKEN}`);
    expect(upstreamCall(2).method).toBe("POST");
    expect(upstreamCall(2).headers["Content-Type"]).toBe("application/json");
  });

  it("does not widen a GET prefix allowance into a write", async () => {
    const res = await app.request(
      "/api/yanhekt/v1/course/123",
      { method: "DELETE", headers: { Authorization: `Bearer ${TOKEN}` } },
      env(),
    );
    expect(res.status).toBe(404);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
