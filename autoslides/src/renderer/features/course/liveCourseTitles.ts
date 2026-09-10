/**
 * English titles for live broadcasts.
 *
 * Yanhekt ships `name_en` on `/v2/course/list`, `/v1/course` and subscription
 * rows — but **not** on live-list rows, whose nested `course` object carries
 * neither `name_en` nor even an `id`. So a live card in an English UI showed the
 * Chinese broadcast title, the one gap 22.45 could not close.
 *
 * A live row does carry the real course id on `session.course_id`, and
 * `GET /v1/course?id=` answers with `name_en` anonymously. This module turns
 * that into a per-course cache:
 *
 * - Keyed by **course**, not broadcast, so a course that streams weekly costs
 *   one request for all of its rows, and the Live grid warms the Home row, the
 *   search results and the player.
 * - Only ever runs when the UI locale is `en`. zh/ja/ko keep the Chinese name by
 *   owner ruling, so they pay nothing.
 * - Negative results are cached too — a course whose `name_en` is missing or a
 *   placeholder must not be re-fetched on every render.
 * - Best-effort throughout: a failure leaves the Chinese title in place.
 *
 * `titleEn` is display-only. `Course.title` stays the canonical Chinese name
 * that folder names, download filenames and note titles derive from — see
 * `@shared/i18n/displayNames`.
 */

import { tokenManager } from '@shared/services/authService'
import { getCurrentLocale } from '@shared/i18n'
import { usableEnglishTitle } from '@shared/i18n/displayNames'
import { createLogger } from '@shared/utils/logger'
import type { Course } from './useCourseList'

const log = createLogger('LiveCourseTitles')

/** courseId → usable English title, or null for "asked, none available". */
const cache = new Map<string, string | null>()
const inflight = new Map<string, Promise<string | null>>()

/** How many course lookups run at once, so a 16-row page does not burst. */
const CONCURRENCY = 4

function fetchTitleEn(courseId: string): Promise<string | null> {
  const existing = inflight.get(courseId)
  if (existing) return existing

  const run = (async (): Promise<string | null> => {
    const token = tokenManager.getToken()
    if (!token) return null
    const names = await window.electronAPI.api.getCourseNames(courseId, token)
    // usableEnglishTitle decodes HTML entities and rejects anything holding a
    // CJK ideograph, so 待完善 and name_en-repeats-name_zh both land as null.
    return usableEnglishTitle(names?.nameEn) ?? null
  })()
    .catch((error: unknown) => {
      log.debug('course name lookup failed:', error)
      return null
    })
    .then((value) => {
      cache.set(courseId, value)
      return value
    })
    .finally(() => {
      inflight.delete(courseId)
    })

  inflight.set(courseId, run)
  return run
}

/**
 * Fill `titleEn` on live rows that lack one, in place.
 *
 * Rows are reactive proxies off the caller's `ref`, so assigning `titleEn`
 * re-renders the card. Resolves once every lookup has settled; callers
 * fire-and-forget it after a list load — the grid must never wait on this.
 */
export async function hydrateLiveTitles(courses: Course[]): Promise<void> {
  if (getCurrentLocale() !== 'en') return

  // One entry per course id; several broadcasts of the same course share a row
  // list, and all of them get patched when that id resolves.
  const pending = new Map<string, Course[]>()
  for (const course of courses) {
    const id = course.courseId
    if (!id || course.titleEn) continue
    const known = cache.get(id)
    if (known !== undefined) {
      // Already resolved earlier — patch synchronously, no request.
      if (known) course.titleEn = known
      continue
    }
    const group = pending.get(id)
    if (group) group.push(course)
    else pending.set(id, [course])
  }
  if (pending.size === 0) return

  const ids = [...pending.keys()]
  let next = 0
  const worker = async (): Promise<void> => {
    while (next < ids.length) {
      const id = ids[next++]
      const titleEn = await fetchTitleEn(id)
      if (!titleEn) continue
      for (const course of pending.get(id) ?? []) course.titleEn = titleEn
    }
  }
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, ids.length) }, worker))
}

/** Test seam / sign-out: drop everything learned so far. */
export function clearLiveTitleCache(): void {
  cache.clear()
  inflight.clear()
}
