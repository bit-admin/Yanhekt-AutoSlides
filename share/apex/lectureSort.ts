/**
 * Natural ordering + course grouping for search results.
 *
 * DUPLICATE BY DEPLOY BOUNDARY: the canonical in-app copy is
 * `autoslides/src/renderer/features/cloudNotes/lectureSort.ts` — keep the two
 * in sync when changing ordering semantics (the worker site can't import from
 * the app tree).
 *
 * Mirrors the ordering semantics of the Electron app's recorded-folder sort
 * (`autoslides/src/renderer/shared/utils/toolWindowFolders.ts`: week/weekday/period
 * as a numeric tuple, not lexicographic), extended with a school-year/semester tier
 * so the same course shown across multiple terms lists the latest term first.
 */

interface SortableLecture {
  courseId: string;
  courseTitle?: string;
  sessionTitle?: string;
  semester?: string;
  schoolYear?: string;
  weekNumber?: number;
  day?: number;
}

const UNKNOWN = Number.MAX_SAFE_INTEGER;

/** Extracts the trailing "第N大节" period number from a session title. */
export function parsePeriod(sessionTitle?: string): number {
  const match = sessionTitle?.match(/第(\d+)大节/);
  return match ? parseInt(match[1], 10) : UNKNOWN;
}

/** '1' (Fall) / '2' (Spring) → numeric rank; missing sorts last. */
export function semesterRank(semester?: string): number {
  const n = semester ? parseInt(semester, 10) : NaN;
  return Number.isFinite(n) ? n : -1;
}

/** "2025-2026" → 2025; missing sorts last. */
export function schoolYearRank(schoolYear?: string): number {
  const n = schoolYear ? parseInt(schoolYear, 10) : NaN;
  return Number.isFinite(n) ? n : -1;
}

/**
 * Orders lectures latest-term-first, then in natural chronological order within
 * a term (week asc, weekday asc, period asc), falling back to a locale string
 * compare when the structured fields don't fully disambiguate.
 */
export function compareLectures(a: SortableLecture, b: SortableLecture): number {
  const yearDiff = schoolYearRank(b.schoolYear) - schoolYearRank(a.schoolYear);
  if (yearDiff !== 0) return yearDiff;

  const semesterDiff = semesterRank(b.semester) - semesterRank(a.semester);
  if (semesterDiff !== 0) return semesterDiff;

  const weekA = a.weekNumber ?? UNKNOWN;
  const weekB = b.weekNumber ?? UNKNOWN;
  if (weekA !== weekB) return weekA - weekB;

  const dayA = a.day ?? UNKNOWN;
  const dayB = b.day ?? UNKNOWN;
  if (dayA !== dayB) return dayA - dayB;

  const periodDiff = parsePeriod(a.sessionTitle) - parsePeriod(b.sessionTitle);
  if (periodDiff !== 0) return periodDiff;

  return (a.sessionTitle ?? '').localeCompare(b.sessionTitle ?? '', 'zh');
}

export interface LectureGroup<T extends SortableLecture> {
  courseId: string;
  courseTitle: string;
  items: T[];
}

/**
 * Groups lectures by courseId, orders sessions within each group via
 * compareLectures, and orders the groups themselves by their latest
 * (already-sorted-to-front) session's school year/semester, descending.
 */
export function groupLectures<T extends SortableLecture>(lectures: T[]): LectureGroup<T>[] {
  const byCourse = new Map<string, T[]>();
  for (const lecture of lectures) {
    const bucket = byCourse.get(lecture.courseId);
    if (bucket) bucket.push(lecture);
    else byCourse.set(lecture.courseId, [lecture]);
  }

  const groups: LectureGroup<T>[] = Array.from(byCourse.entries()).map(([courseId, items]) => {
    const sorted = [...items].sort(compareLectures);
    return { courseId, courseTitle: sorted[0]?.courseTitle || 'Untitled course', items: sorted };
  });

  groups.sort((a, b) => {
    const latestA = a.items[0];
    const latestB = b.items[0];
    const yearDiff = schoolYearRank(latestB.schoolYear) - schoolYearRank(latestA.schoolYear);
    if (yearDiff !== 0) return yearDiff;
    const semesterDiff = semesterRank(latestB.semester) - semesterRank(latestA.semester);
    if (semesterDiff !== 0) return semesterDiff;
    return a.courseTitle.localeCompare(b.courseTitle, 'zh');
  });

  return groups;
}
