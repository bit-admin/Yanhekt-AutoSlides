/**
 * English titles for live broadcasts (web).
 *
 * Live-list rows carry no `name_en` — their nested `course` object has neither
 * an English name nor even an `id` — so a live card in an English UI falls back
 * to the Chinese broadcast title. The row does carry the real course id on
 * `session.course_id`, and `GET /v1/course?id=` answers with `name_en`
 * anonymously (the Worker strips the Bearer on that path).
 *
 * Scope here is narrower than the desktop app's: only the **player** resolves a
 * title, never the Live grid, so this costs at most one request per stream
 * opened — and nothing at all on a cold deep link, where `PlayerRoute` already
 * has the `/v1/live?id=` payload and reads `course.name_en` straight off it.
 *
 * Keyed by course, so the same course's later broadcasts are free. Negative
 * results are cached too. Best-effort: a failure keeps the Chinese title.
 */

import { getCourseNames } from "../lib/api";
import { usableEnglishTitle } from "../i18n/displayNames";
// getCurrentLocale comes from the i18n entry, not displayNames — that file is
// a drift copy of the desktop one and must not grow a web-only re-export.
import { getCurrentLocale } from "../i18n";
import { createLogger } from "../lib/logger";

const log = createLogger("LiveCourseTitles");

/** courseId → usable English title, or null for "asked, none available". */
const cache = new Map<string, string | null>();
const inflight = new Map<string, Promise<string | null>>();

/**
 * The English title for a course id, or null. Resolves from cache without a
 * request once a course has been seen. Never throws.
 */
export function liveCourseTitleEn(courseId: string, token: string): Promise<string | null> {
  const id = String(courseId || "").trim();
  if (!id || !token) return Promise.resolve(null);

  const known = cache.get(id);
  if (known !== undefined) return Promise.resolve(known);

  const existing = inflight.get(id);
  if (existing) return existing;

  const run = getCourseNames(id, token)
    // usableEnglishTitle decodes HTML entities and rejects anything holding a
    // CJK ideograph, so 待完善 and name_en-repeats-name_zh both land as null.
    .then((names) => usableEnglishTitle(names?.nameEn) ?? null)
    .catch((error: unknown) => {
      log.debug("course name lookup failed:", error);
      return null;
    })
    .then((value) => {
      cache.set(id, value);
      return value;
    })
    .finally(() => {
      inflight.delete(id);
    });

  inflight.set(id, run);
  return run;
}

/** Record a title we already have (the deep-link payload carries one for free). */
export function rememberLiveCourseTitleEn(courseId: string, titleEn?: string | null): void {
  const id = String(courseId || "").trim();
  if (!id) return;
  cache.set(id, usableEnglishTitle(titleEn) ?? null);
}

/** Only worth asking when the UI is in English; zh keeps the Chinese name. */
export function wantsEnglishTitle(): boolean {
  return getCurrentLocale() === "en";
}

/** Sign-out / test seam. */
export function clearLiveTitleCache(): void {
  cache.clear();
  inflight.clear();
}
