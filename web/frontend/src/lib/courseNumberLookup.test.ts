import { describe, expect, it, vi } from "vitest";
import { createCourseNumberLookup } from "./courseNumberLookup";

function lookup(options: { rows?: unknown[]; fail?: boolean } = {}) {
  const listCourses = vi.fn(async () => {
    if (options.fail) throw new Error("no answer");
    return { data: (options.rows ?? [{ id: 80102, number: "K-0002" }, { id: 80101, number: "K-0001" }]) as never };
  });
  return { numberOf: createCourseNumberLookup(listCourses), listCourses };
}

describe("courseNumberLookup", () => {
  it("answers the row whose id is the course's, and asks once per course", async () => {
    const { numberOf, listCourses } = lookup();
    expect(await numberOf("80101", "t".repeat(32))).toBe("K-0001");
    expect(await numberOf("80101", "t".repeat(32))).toBe("K-0001");
    expect(listCourses).toHaveBeenCalledTimes(1);
  });

  it("answers null with no sign-in, a bad id, no such course or no answer, and does not keep a failure", async () => {
    const token = "t".repeat(32);
    expect(await lookup().numberOf("80101", null)).toBeNull();
    expect(await lookup().numberOf("live_1", token)).toBeNull();
    expect(await lookup({ rows: [] }).numberOf("80101", token)).toBeNull();
    const failing = lookup({ fail: true });
    expect(await failing.numberOf("80101", token)).toBeNull();
    expect(await failing.numberOf("80101", token)).toBeNull();
    expect(failing.listCourses).toHaveBeenCalledTimes(2);
  });
});
