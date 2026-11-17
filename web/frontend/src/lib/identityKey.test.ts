import { describe, expect, it } from "vitest";
import { identityKey } from "./identityKey";

describe("identityKey", () => {
  it("tells apart tokens that share a prefix", () => {
    const a = "0123456789abcdef0123456789abcdef";
    const b = "01234567ffffffffffffffffffffffff";
    expect(identityKey(a)).not.toBe(identityKey(b));
  });

  it("is stable for one token and never holds the token", () => {
    const token = "fedcba9876543210fedcba9876543210";
    expect(identityKey(token)).toBe(identityKey(token));
    expect(identityKey(token)).not.toContain(token.slice(0, 4));
  });

  it("is anon without a token", () => {
    expect(identityKey(null)).toBe("anon");
    expect(identityKey("")).toBe("anon");
  });
});
