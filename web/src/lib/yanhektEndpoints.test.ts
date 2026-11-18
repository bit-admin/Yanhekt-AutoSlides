import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { ENDPOINTS, endpointFor, omitsCredential } from "./yanhektEndpoints";

// The proxy's rules before the table (23.204), kept here verbatim as the
// reference: the table must decide every request the same way.
const LEGACY_ALLOWED: Record<string, string[]> = {
  GET: ["/v1/user", "/v1/cas/logout", "/v2/live/list", "/v1/live", "/v2/course/list", "/v2/course/private/list", "/v1/course", "/v2/course/session/list", "/v1/course/session/list", "/v1/tag/semester/default", "/v1/video", "/v1/note", "/v1/note/list", "/v1/note/group/list"],
  POST: ["/v1/note", "/v1/note/group", "/v1/minio/upload", "/v1/course/subscription"],
  PUT: ["/v1/note", "/v1/note/content", "/v1/course/session/user/progress"],
  DELETE: ["/v1/note", "/v1/note/group", "/v1/course/subscription"],
};
function legacyAllowed(method: string, path: string): boolean {
  const paths = LEGACY_ALLOWED[method];
  if (!paths) return false;
  if (method === "GET") return paths.some((p) => path === p || path.startsWith(`${p}/`));
  return paths.includes(path);
}
function legacyAnonymous(method: string, path: string, search: URLSearchParams): boolean {
  if (method !== "GET") return false;
  if (path === "/v1/tag/semester/default") return true;
  if (path === "/v2/course/list" || path.startsWith("/v2/course/list/")) return true;
  if (path === "/v1/course") return true;
  if (path === "/v1/video") return true;
  if (path === "/v1/live") return true;
  if (path === "/v2/live/list" || path.startsWith("/v2/live/list/")) return search.get("user_relationship_type") !== "1";
  return false;
}

const METHODS = ["GET", "POST", "PUT", "DELETE", "PATCH"];
const PATHS = [
  ...new Set([
    ...Object.values(LEGACY_ALLOWED).flat(),
    ...Object.values(LEGACY_ALLOWED).flat().map((p) => `${p}/x`),
    "/v1/course/session",
    "/v1/course/subscription/list",
    "/v1/live/mine",
    "/v1/videos",
    "/v1/tag/list",
    "/v2/course",
    "/",
    "/v1/user/../note",
  ]),
];
const SEARCHES = ["", "user_relationship_type=1", "user_relationship_type=2"];

describe("the endpoint table", () => {
  it("allows and refuses exactly what the proxy did", () => {
    for (const method of METHODS) {
      for (const path of PATHS) {
        expect(endpointFor(method, path) !== null, `${method} ${path}`).toBe(legacyAllowed(method, path));
      }
    }
  });

  it("leaves the Bearer off exactly where the proxy did", () => {
    for (const method of METHODS) {
      for (const path of PATHS) {
        for (const q of SEARCHES) {
          const search = new URLSearchParams(q);
          expect(omitsCredential(method, path, search), `${method} ${path}?${q}`).toBe(legacyAnonymous(method, path, search));
        }
      }
    }
  });

  it("keeps the Bearer on session detail, which carries user_progress", () => {
    expect(omitsCredential("GET", "/v1/course/session", new URLSearchParams("session_id=850101"))).toBe(false);
  });

  it("has one row per method and path", () => {
    const keys = ENDPOINTS.map((e) => `${e.method} ${e.path}`);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("covers every Yanhekt path the frontend names", () => {
    const sources = ["../../frontend/src/lib/api.ts", "../../frontend/src/lib/notes/notesClient.ts"].map((file) =>
      readFileSync(new URL(file, import.meta.url), "utf8")
        .split("\n")
        .filter((line) => !/^\s*(\*|\/\/)/.test(line))
        .join("\n"),
    );
    const named = new Set<string>();
    for (const text of sources) {
      for (const match of text.matchAll(/(?:["'`]|PROXY_BASE\})(\/v[12]\/[a-z_/]+)/g)) named.add(match[1].replace(/\/$/, ""));
    }
    expect(named.size).toBeGreaterThan(10);
    for (const path of named) {
      expect(ENDPOINTS.some((e) => endpointFor(e.method, path) !== null), path).toBe(true);
    }
  });
});
