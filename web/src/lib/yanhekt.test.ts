import { describe, expect, it } from "vitest";
import { upstreamHeaders } from "./yanhekt";

// Golden vectors shared with autoslides/src/shared/crypto.test.ts,
// relay/src/yanhekt.test.ts and share/src/lib/yanhekt.ts (hardcoded hex).
const CLIENT_SIGNATURE_HEX = "72b77856f6df3f563ab6e658631cac3d";

describe("upstreamHeaders", () => {
  it("computes the same constant client signature as the desktop app", () => {
    const headers = upstreamHeaders("a".repeat(32));
    expect(headers["Xclient-Signature"]).toBe(CLIENT_SIGNATURE_HEX);
    expect(headers["Xclient-Timestamp"]).toMatch(/^\d{10}$/);
    expect(headers["Xclient-Version"]).toBe("v1");
    expect(headers.Authorization).toBe(`Bearer ${"a".repeat(32)}`);
  });

  it("omits Authorization for anonymous requests", () => {
    expect(upstreamHeaders(null).Authorization).toBeUndefined();
  });
});
