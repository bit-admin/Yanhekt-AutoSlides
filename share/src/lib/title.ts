export interface ParsedTitle {
  course: string;
  session: string;
}

/**
 * AutoSlides embeds an id block in folder and note names, because course titles
 * are not unique: `__c<courseId>[s<sessionId>][l<liveId>]` — e.g.
 * `__c62313s751843` for a recorded lecture, `__c71736l761952` for a live
 * broadcast. The app strips it before a title reaches a share payload, but
 * strip it here too so a raw name can never render with the id visible. Kept as
 * a local copy — this Worker is a separate deployable and cannot import the
 * app's `@common/lectureNaming`.
 */
const LECTURE_ID_SUFFIX = /__(?:c\d+)?(?:s\d+)?(?:l\d+)?$/;

/**
 * Split a managed-note display name into a course title and a human-readable
 * session line. Mirrors the folder-naming scheme used by AutoSlides:
 *   - Chinese: "<course>_第N周_星期X_第N大节"
 *   - English: "<course> - Lecture N"
 * Falls back to the raw name (underscores → spaces) when no pattern matches.
 */
export function parseTitle(rawWithIds: string): ParsedTitle {
  const raw = rawWithIds.replace(LECTURE_ID_SUFFIX, '');
  const zh = raw.match(/^(.+)_第(\d+)周_星期([一二三四五六日])_第(\d+)大节$/);
  if (zh) {
    return { course: zh[1], session: `第${zh[2]}周 · 星期${zh[3]} · 第${zh[4]}大节` };
  }

  const en = raw.match(/^(.+) - Lecture (\d+)$/);
  if (en) {
    return { course: en[1], session: `Lecture ${en[2]}` };
  }

  return { course: raw.replace(/_/g, ' '), session: '' };
}
