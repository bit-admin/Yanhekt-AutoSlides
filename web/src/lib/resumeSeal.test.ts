import { afterEach, describe, expect, it, vi } from "vitest";
import { RESUME_TTL_SECONDS, Sealer, randomNonce } from "./resumeSeal";

interface Bag {
  cookies: string[];
  execution: string;
}

const bag: Bag = { cookies: ["JSESSIONID=abc"], execution: "e1s2" };

describe("Sealer", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns null when no key is bound so callers can degrade", async () => {
    expect(await Sealer.from(undefined)).toBeNull();
    expect(await Sealer.from("")).toBeNull();
  });

  it("round-trips a payload under the same key and nonce", async () => {
    const sealer = (await Sealer.from("secret-1"))!;
    const nonce = randomNonce();
    const blob = await sealer.seal(bag, RESUME_TTL_SECONDS, nonce);
    expect(blob).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(await sealer.open<Bag>(blob, nonce)).toEqual(bag);
    // Nonce is only checked when the caller supplies one.
    expect(await sealer.open<Bag>(blob)).toEqual(bag);
  });

  it("rejects a mismatched nonce", async () => {
    const sealer = (await Sealer.from("secret-1"))!;
    const blob = await sealer.seal(bag, RESUME_TTL_SECONDS, randomNonce());
    expect(await sealer.open<Bag>(blob, randomNonce())).toBeNull();
  });

  it("rejects an expired envelope", async () => {
    const sealer = (await Sealer.from("secret-1"))!;
    const nonce = randomNonce();
    const blob = await sealer.seal(bag, 1, nonce);
    vi.useFakeTimers();
    vi.setSystemTime(Date.now() + 5_000);
    expect(await sealer.open<Bag>(blob, nonce)).toBeNull();
  });

  it("rejects a tampered blob and a different key", async () => {
    const sealer = (await Sealer.from("secret-1"))!;
    const other = (await Sealer.from("secret-2"))!;
    const nonce = randomNonce();
    const blob = await sealer.seal(bag, RESUME_TTL_SECONDS, nonce);
    const flipped = blob.slice(0, -2) + (blob.endsWith("AA") ? "BB" : "AA");
    expect(await sealer.open<Bag>(flipped, nonce)).toBeNull();
    expect(await other.open<Bag>(blob, nonce)).toBeNull();
    expect(await sealer.open<Bag>("not-base64url!!", nonce)).toBeNull();
  });

  it("produces distinct ciphertext for identical input (random IV)", async () => {
    const sealer = (await Sealer.from("secret-1"))!;
    const nonce = randomNonce();
    const a = await sealer.seal(bag, RESUME_TTL_SECONDS, nonce);
    const b = await sealer.seal(bag, RESUME_TTL_SECONDS, nonce);
    expect(a).not.toBe(b);
  });
});
