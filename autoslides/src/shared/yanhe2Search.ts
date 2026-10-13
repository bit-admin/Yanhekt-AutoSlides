/**
 * Yanhe 2.0 course search — the plain rows both processes agree on: the terms
 * aita knows, and one page of the catalogue matching a keyword.
 *
 * Same rule as the Calendar: main reads aita with the stored JWT and hands the
 * renderer only what is below.
 */
import type { Yanhe2Course } from './yanhe2Curriculum';

/** Rows per page, the Search page's 4 × 4 grid. Fixed in main, not taken from the renderer. */
export const YANHE2_SEARCH_PAGE_SIZE = 16;

export interface Yanhe2Term {
  /** The bare id the search's `term` filter takes (`42`, not the `_42_` stored on a course row). */
  id: number;
  /** aita's own name, e.g. `2026-2027-1`. */
  name: string;
  /** First year of the school year (`2026` for `2026-2027`). */
  schoolYear: number;
  /** 1 = fall, 2 = spring. aita's trial term (`2021-2022试用`) is neither and is not listed. */
  semester: 1 | 2;
  /** The term aita marks as the running one. */
  current: boolean;
}

export interface Yanhe2CourseSearchQuery {
  /** Part of a course name or a teacher's name. Empty lists the whole catalogue. */
  keyword: string;
  /** One term, or null for every term. aita filters by a single term only. */
  termId: number | null;
  /** 1-based. */
  page: number;
}

export interface Yanhe2CourseSearchPage {
  courses: Yanhe2Course[];
  /** Matches across all pages. */
  total: number;
}
