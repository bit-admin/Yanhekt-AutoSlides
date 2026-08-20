/**
 * Search query helpers for GET /v2/api/search.
 *
 * Yanhekt `/v2/course/list` is queried first; unique course ids from that page
 * are then checked against D1. The page size is the number of courses we can
 * join, and it grows when the semester filter is wider:
 *   1 semester → 32,  2+ semesters → 48,  all semesters → 64.
 */

export const COURSE_CHECK_ONE = 32;
export const COURSE_CHECK_MULTI = 48;
export const COURSE_CHECK_ALL = 64;

/** Unique non-empty ids, first-seen order. Splits comma-separated tokens. */
export function splitSemesterIds(values: Iterable<string>): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const value of values) {
    for (const part of value.split(',')) {
      const id = part.trim();
      if (!id || seen.has(id)) continue;
      seen.add(id);
      out.push(id);
    }
  }
  return out;
}

/**
 * Parse the search API's semester filter. Empty array = all semesters.
 * Prefers `semesterIds` (comma-separated and/or repeated) over legacy `semesterId`.
 */
export function parseSearchSemesterIds(searchParams: URLSearchParams): string[] {
  if (searchParams.has('semesterIds')) {
    return splitSemesterIds(searchParams.getAll('semesterIds'));
  }
  if (searchParams.has('semesterId')) {
    return splitSemesterIds([searchParams.get('semesterId') ?? '']);
  }
  return [];
}

/**
 * Page-URL equivalent of {@link parseSearchSemesterIds}.
 * `null` means the URL did not specify a filter (caller should default to the
 * latest semester); an empty array is an explicit "all semesters".
 */
export function readPageSemesterIds(searchParams: URLSearchParams): string[] | null {
  if (searchParams.has('semesterIds') || searchParams.has('semesterId')) {
    return parseSearchSemesterIds(searchParams);
  }
  return null;
}

/** How many Yanhekt courses to fetch (and then check in D1). */
export function courseCheckPageSize(semesterCount: number): number {
  if (semesterCount <= 0) return COURSE_CHECK_ALL;
  if (semesterCount === 1) return COURSE_CHECK_ONE;
  return COURSE_CHECK_MULTI;
}
