import { describe, expect, it, vi } from "vitest";
import { createApp } from "../app";
import type { Env } from "../env";

const PLAYLIST = "/playlist?u=https%3A%2F%2Fcvideo.yanhekt.cn%2Fx%2Findex.m3u8&t=0123456789abcdef0123456789abcdef";
const SEGMENT = "/segment?u=https%3A%2F%2Fcvideo.yanhekt.cn%2Fx%2F1.ts&t=0123456789abcdef0123456789abcdef";

/** Stub RELAY binding answering with a playlist that names an absolute origin. */
function relayStub() {
  return vi.fn(
    async () =>
      new Response("#EXTM3U\nhttps://relay.example.com/segment?u=a&t=b\n", {
        headers: { "Content-Type": "application/vnd.apple.mpegurl" },
      }),
  );
}

function env(extra: Partial<Env> = {}): Env {
  return {
    ASSETS: { fetch: async () => new Response("asset") } as unknown as Fetcher,
    ...extra,
  };
}

describe("recorded-HLS relay routes", () => {
  const app = createApp();

  it("proxies over the binding when off-campus relaying is allowed", async () => {
    const fetchStub = relayStub();
    const res = await app.request(
      PLAYLIST,
      {},
      env({
        RELAY: { fetch: fetchStub } as unknown as Fetcher,
        ALLOW_OFFCAMPUS_RELAY: "true",
        RELAY_PUBLIC_ORIGIN: "https://relay.example.com",
      }),
    );

    expect(res.status).toBe(200);
    expect(fetchStub).toHaveBeenCalledTimes(1);
    // Absolute proxy URLs are rewritten root-relative so they stay on this origin.
    expect(await res.text()).toContain("\n/segment?u=a&t=b");
  });

  it("403s both routes without touching the binding when a public origin is set", async () => {
    const fetchStub = relayStub();
    const bindings = env({
      RELAY: { fetch: fetchStub } as unknown as Fetcher,
      RELAY_PUBLIC_ORIGIN: "https://relay.example.com/",
    });

    const playlist = await app.request(PLAYLIST, {}, bindings);
    const segment = await app.request(SEGMENT, {}, bindings);

    expect(playlist.status).toBe(403);
    expect(segment.status).toBe(403);
    expect(await playlist.text()).toContain("https://relay.example.com");
    expect(fetchStub).not.toHaveBeenCalled();
  });

  it("keeps using the binding when no public origin is configured", async () => {
    const fetchStub = relayStub();
    const res = await app.request(PLAYLIST, {}, env({ RELAY: { fetch: fetchStub } as unknown as Fetcher }));

    expect(res.status).toBe(200);
    expect(fetchStub).toHaveBeenCalledTimes(1);
  });

  it("503s an unbound relay", async () => {
    const res = await app.request(PLAYLIST, {}, env());
    expect(res.status).toBe(503);
  });
});

describe("GET /api/config", () => {
  const app = createApp();

  it("reports direct mode with the public origin", async () => {
    const res = await app.request(
      "/api/config",
      {},
      env({ RELAY_PUBLIC_ORIGIN: "https://relay.example.com/some/path" }),
    );

    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    expect(await res.json()).toEqual({
      relay: { mode: "direct", origin: "https://relay.example.com" },
      network: { onAllowlist: false },
    });
  });

  it("reports binding mode when off-campus relaying is allowed", async () => {
    const res = await app.request(
      "/api/config",
      {},
      env({ ALLOW_OFFCAMPUS_RELAY: "true", RELAY_PUBLIC_ORIGIN: "https://relay.example.com" }),
    );

    expect(await res.json()).toEqual({ relay: { mode: "binding" }, network: { onAllowlist: false } });
  });

  it("ignores an unusable public origin", async () => {
    const res = await app.request("/api/config", {}, env({ RELAY_PUBLIC_ORIGIN: "not a url" }));
    expect(await res.json()).toEqual({ relay: { mode: "binding" }, network: { onAllowlist: false } });
  });
});
