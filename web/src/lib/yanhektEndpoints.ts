// Every Yanhekt endpoint the web app may reach through /api/yanhekt, in one
// table: method, how the path matches, and whether the user's Bearer goes
// upstream. The proxy reads its allowlist and its credential rule from here,
// and yanhektEndpoints.test.ts checks the table row by row and that every
// path the frontend names is in it, so a new client call fails a test until
// its row is added.
//
// Reads match by prefix (a path or anything below it: `/v1/course/<x>`),
// writes only exactly, so a read allowance never widens into a write.
//
// Credential: `forward` sends the caller's Bearer, `omit` never does (public
// catalogue reads; Yanhekt answers them anonymously, 2026-08-13 probes),
// `omit-unless-personal` omits it except for the personal live list
// (`user_relationship_type=1`). Keep in step with the Electron app's
// `allowAnonymous` opt-ins (autoslides/src/main/platform/apiClient.ts).
// `/v1/course/session` stays `forward`: its `user_progress` (the saved
// playhead the resume feature reads) only exists for the Bearer holder.

export type Credential = "forward" | "omit" | "omit-unless-personal";

export interface Endpoint {
  method: "GET" | "POST" | "PUT" | "DELETE";
  path: string;
  credential: Credential;
  /**
   * An `omit` rule covers the path itself only, unless this is set: then
   * paths below it are anonymous too. (Reads below any row are allowed
   * either way; this is only about the Bearer.)
   */
  omitBelow?: boolean;
  /** Why it is here, or what it is for. */
  note: string;
}

export const ENDPOINTS: readonly Endpoint[] = [
  { method: "GET", path: "/v1/user", credential: "forward", note: "the signed-in account" },
  { method: "GET", path: "/v1/cas/logout", credential: "forward", note: "sign-out" },
  { method: "GET", path: "/v2/live/list", credential: "omit-unless-personal", omitBelow: true, note: "live lists; user_relationship_type=1 is the account's own" },
  { method: "GET", path: "/v1/live", credential: "omit", note: "broadcast detail by id (exact: a /v1/live/<x> personal endpoint must not inherit the omit)" },
  { method: "GET", path: "/v2/course/list", credential: "omit", omitBelow: true, note: "course catalogue and search" },
  { method: "GET", path: "/v2/course/private/list", credential: "forward", note: "the account's courses" },
  { method: "GET", path: "/v1/course", credential: "omit", note: "course detail; below it (session detail with user_progress, subscriptions) the Bearer goes" },
  { method: "GET", path: "/v2/course/session/list", credential: "forward", note: "a course's sessions" },
  { method: "GET", path: "/v1/course/session/list", credential: "forward", note: "v1 twin, the fallback when v2 is empty (also under /v1/course)" },
  { method: "GET", path: "/v1/tag/semester/default", credential: "omit", note: "the current term" },
  { method: "GET", path: "/v1/video", credential: "omit", note: "a recording's streams" },
  { method: "GET", path: "/v1/note", credential: "forward", note: "a note" },
  { method: "GET", path: "/v1/note/list", credential: "forward", note: "notes" },
  { method: "GET", path: "/v1/note/group/list", credential: "forward", note: "note groups" },
  { method: "POST", path: "/v1/note", credential: "forward", note: "create a note" },
  { method: "POST", path: "/v1/note/group", credential: "forward", note: "create a group" },
  { method: "POST", path: "/v1/minio/upload", credential: "forward", note: "note image upload" },
  { method: "POST", path: "/v1/course/subscription", credential: "forward", note: "subscribe" },
  { method: "PUT", path: "/v1/note", credential: "forward", note: "rename / move a note" },
  { method: "PUT", path: "/v1/note/content", credential: "forward", note: "save a note" },
  { method: "PUT", path: "/v1/course/session/user/progress", credential: "forward", note: "watch position" },
  { method: "DELETE", path: "/v1/note", credential: "forward", note: "delete a note" },
  { method: "DELETE", path: "/v1/note/group", credential: "forward", note: "delete a group" },
  { method: "DELETE", path: "/v1/course/subscription", credential: "forward", note: "unsubscribe" },
];

/** The row a request falls under, or null when the proxy must refuse it. */
export function endpointFor(method: string, path: string): Endpoint | null {
  const rows = ENDPOINTS.filter((e) => e.method === method);
  if (method !== "GET") return rows.find((e) => e.path === path) ?? null;
  // The longest matching prefix, so a sub-path takes its own row when it has one.
  let best: Endpoint | null = null;
  for (const e of rows) {
    if (path === e.path || path.startsWith(`${e.path}/`)) {
      if (!best || e.path.length > best.path.length) best = e;
    }
  }
  return best;
}

/** Whether the Bearer is left off for this request. */
export function omitsCredential(method: string, path: string, search: URLSearchParams): boolean {
  if (method !== "GET") return false;
  const row = endpointFor(method, path);
  if (!row || row.credential === "forward") return false;
  if (path !== row.path && !row.omitBelow) return false;
  if (row.credential === "omit-unless-personal") return search.get("user_relationship_type") !== "1";
  return true;
}
