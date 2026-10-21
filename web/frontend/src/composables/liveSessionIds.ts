/**
 * Session ids behind live broadcasts, so a live lecture can be named
 * `c<course>s<session>l<live>` instead of `c<course>l<live>`. Port of the
 * desktop `features/course/liveSessionIds.ts`.
 *
 * Live-list rows carry no session id, but `GET /v1/live?id=` detail does, and
 * the session exists before the class starts. One lookup per broadcast, cached
 * for the life of the page. A failure is not cached; until a lookup succeeds
 * the name keeps the live id only.
 */

import { getLiveById } from "../lib/api";
import { authStore } from "../stores/authStore";

const known = new Map<string, string>();
const inflight = new Map<string, Promise<string | undefined>>();

/** How long naming waits for the lookup before going ahead without it. */
const LOOKUP_TIMEOUT_MS = 5000;

const keyOf = (liveId: string | number | null | undefined): string =>
  liveId == null ? "" : String(liveId).trim();

/** Record a session id that arrived on a payload (e.g. `/v1/live?id=` detail). */
export function rememberLiveSessionId(
  liveId: string | number | null | undefined,
  sessionId: string | number | null | undefined,
): void {
  const key = keyOf(liveId);
  const value = sessionId == null ? "" : String(sessionId).trim();
  if (key && /^\d+$/.test(value)) known.set(key, value);
}

/**
 * The session id for a broadcast, looked up once. Resolves undefined when the
 * lookup fails or takes longer than {@link LOOKUP_TIMEOUT_MS}; never rejects.
 */
export function resolveLiveSessionId(
  liveId: string | number | null | undefined,
): Promise<string | undefined> {
  const key = keyOf(liveId);
  if (!key) return Promise.resolve(undefined);
  const hit = known.get(key);
  if (hit) return Promise.resolve(hit);

  let lookup = inflight.get(key);
  if (!lookup) {
    lookup = (async (): Promise<string | undefined> => {
      const token = authStore.token.value;
      if (!token) return undefined;
      try {
        const detail = await getLiveById(key, token);
        rememberLiveSessionId(key, detail.session?.id);
      } catch {
        // Best-effort: the live-id name is the fallback.
      }
      return known.get(key);
    })().finally(() => inflight.delete(key));
    inflight.set(key, lookup);
  }

  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<undefined>((resolve) => {
    timer = setTimeout(() => resolve(undefined), LOOKUP_TIMEOUT_MS);
  });
  return Promise.race([lookup, timeout]).finally(() => clearTimeout(timer));
}
