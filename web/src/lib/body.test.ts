import { describe, expect, it } from "vitest";
import { readRequestLimited, readTextLimited } from "./body";

const streamOf = (chunks: string[]) =>
  new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(new TextEncoder().encode(chunk));
      controller.close();
    },
  });

describe("bounded reads", () => {
  it("reads a body within the limit", async () => {
    const req = new Request("https://x/", { method: "POST", body: "hello" });
    expect(new TextDecoder().decode((await readRequestLimited(req, 5))!)).toBe("hello");
  });

  it("refuses a declared length over the limit without reading", async () => {
    const req = new Request("https://x/", { method: "POST", body: "hello", headers: { "Content-Length": "999" } });
    expect(await readRequestLimited(req, 10)).toBeNull();
  });

  it("stops a body with no length once it passes the limit", async () => {
    const res = new Response(streamOf(["abc", "def", "ghi"]));
    expect(await readTextLimited(res, 5)).toBeNull();
  });

  it("decodes text cut between chunks inside a character", async () => {
    const bytes = new TextEncoder().encode("课程");
    const res = new Response(
      new ReadableStream<Uint8Array>({
        start(c) {
          c.enqueue(bytes.slice(0, 2));
          c.enqueue(bytes.slice(2));
          c.close();
        },
      }),
    );
    expect(await readTextLimited(res, 100)).toBe("课程");
  });
});
