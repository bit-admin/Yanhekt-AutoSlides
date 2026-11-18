import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchUpstream } from "./upstream";

afterEach(() => {
  vi.useRealTimers();
});

const hanging = (signal: AbortSignal) =>
  new Promise<Response>((_resolve, reject) => {
    signal.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
  });

describe("fetchUpstream", () => {
  it("passes a response through", async () => {
    const res = await fetchUpstream(async () => new Response("ok"), { timeoutMs: 1000 });
    expect(await res.text()).toBe("ok");
  });

  it("answers 504 and cancels the upstream when it does not start in time", async () => {
    vi.useFakeTimers();
    let upstream: AbortSignal | undefined;
    const pending = fetchUpstream((signal) => ((upstream = signal), hanging(signal)), { timeoutMs: 1000 });
    await vi.advanceTimersByTimeAsync(1000);
    const res = await pending;
    expect(res.status).toBe(504);
    expect(upstream?.aborted).toBe(true);
  });

  it("cancels the upstream when the caller hangs up", async () => {
    const caller = new AbortController();
    let upstream: AbortSignal | undefined;
    const pending = fetchUpstream((signal) => ((upstream = signal), hanging(signal)), { caller: caller.signal, timeoutMs: 10_000 });
    caller.abort();
    const res = await pending;
    expect(res.status).toBe(499);
    expect(upstream?.aborted).toBe(true);
  });

  it("answers 502 when the upstream cannot be reached", async () => {
    const res = await fetchUpstream(async () => {
      throw new TypeError("fetch failed");
    }, { timeoutMs: 1000 });
    expect(res.status).toBe(502);
    expect(await res.json()).toMatchObject({ success: false, reason: "unreachable" });
  });

  it("does not time out a body that streams after the headers", async () => {
    vi.useFakeTimers();
    let upstream: AbortSignal | undefined;
    const res = await fetchUpstream(async (signal) => ((upstream = signal), new Response("streaming")), { timeoutMs: 1000 });
    await vi.advanceTimersByTimeAsync(5000);
    expect(upstream?.aborted).toBe(false);
    expect(res.status).toBe(200);
  });
});
