/**
 * Session ids behind live broadcasts, so a live lecture can be named
 * `c<course>s<session>l<live>` instead of `c<course>l<live>`, and their
 * course's registrar number, which metadata.json keeps (live-list rows carry
 * neither; the same detail request answers both).
 *
 * Live-list rows carry no session id, but `GET /v1/live?id=` detail does, and
 * the session exists before the class starts. One lookup per broadcast, cached
 * for the life of the renderer (the mapping never changes). A failure is not
 * cached, so the next extraction asks again; until then the name keeps the
 * live id only.
 *
 * Extraction awaits `resolveLiveSessionId` before it builds the folder name.
 * The watch note is created after extraction starts and reads
 * `knownLiveSessionId`, which returns what that naming used (even if a
 * timed-out lookup finished later), so the folder and the note always agree.
 */

import { ApiClient } from '@shared/services/apiClient'
import { tokenManager } from '@shared/services/authService'

const apiClient = new ApiClient()
const known = new Map<string, string>()
/** Registrar number of each broadcast's course, from the same detail. */
const numbers = new Map<string, string>()
/** Broadcasts whose detail was read: asked once, even when a row already gave the session id. */
const read = new Set<string>()
/** What the last `resolveLiveSessionId` call handed to naming, per broadcast. */
const used = new Map<string, string | undefined>()
const inflight = new Map<string, Promise<string | undefined>>()

/** How long naming waits for the lookup before going ahead without it. */
const LOOKUP_TIMEOUT_MS = 5000

const keyOf = (liveId: string | number | null | undefined): string =>
  liveId == null ? '' : String(liveId).trim()

/** Record a session id that arrived on a payload (e.g. `/v1/live?id=` detail). */
export function rememberLiveSessionId(
  liveId: string | number | null | undefined,
  sessionId: string | number | null | undefined,
): void {
  const key = keyOf(liveId)
  const value = sessionId == null ? '' : String(sessionId).trim()
  if (key && /^\d+$/.test(value)) known.set(key, value)
}

/**
 * The session id naming should use now, without a request: what the last
 * `resolveLiveSessionId` returned for this broadcast, else any known id.
 */
export function knownLiveSessionId(liveId: string | number | null | undefined): string | undefined {
  const key = keyOf(liveId)
  return used.has(key) ? used.get(key) : known.get(key)
}

/**
 * The session id for a broadcast, looked up once. Resolves undefined when the
 * lookup fails or takes longer than {@link LOOKUP_TIMEOUT_MS}; never rejects.
 */
export function resolveLiveSessionId(liveId: string | number | null | undefined): Promise<string | undefined> {
  const key = keyOf(liveId)
  if (!key) return Promise.resolve(undefined)
  const settle = (value: string | undefined): string | undefined => {
    used.set(key, value)
    return value
  }
  // A session id from the row is good for naming, but only the detail has the
  // course number, so it is read once per broadcast either way.
  const hit = known.get(key)
  if (hit && read.has(key)) return Promise.resolve(settle(hit))

  let lookup = inflight.get(key)
  if (!lookup) {
    lookup = (async (): Promise<string | undefined> => {
      const token = tokenManager.getToken() ?? ''
      const detail = await apiClient.getLiveDetail(key, token)
      if (detail) read.add(key)
      rememberLiveSessionId(key, detail?.sessionId)
      if (detail?.courseNumber) numbers.set(key, detail.courseNumber)
      return known.get(key)
    })().finally(() => inflight.delete(key))
    inflight.set(key, lookup)
  }

  let timer: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<undefined>((resolve) => {
    timer = setTimeout(() => resolve(undefined), LOOKUP_TIMEOUT_MS)
  })
  // A slow or failed detail still names with the id the row gave, if any.
  return Promise.race([lookup, timeout])
    .then((value) => settle(value ?? known.get(key)))
    .finally(() => clearTimeout(timer))
}

/** The registrar number of a broadcast's course, once its detail was read; no request. */
export function knownLiveCourseNumber(liveId: string | number | null | undefined): string | undefined {
  return numbers.get(keyOf(liveId))
}

/** Test seam. */
export function clearLiveSessionIds(): void {
  known.clear()
  numbers.clear()
  read.clear()
  used.clear()
  inflight.clear()
}
