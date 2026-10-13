/**
 * Yanhe 2.0 course search: the catalogue by keyword (`get-course-list`) and the
 * terms to filter it by (`search-term`).
 *
 * This is not the site's header search box (`pptnote/v1/searchlist`): that one
 * returns no `kcwybm`, mixes single sessions in with courses, and appends to
 * the account's search history on every call. `get-course-list` writes nothing
 * and every row carries the key that links a course to Yanhekt.
 *
 * Response bodies carry teacher badges and more than the page needs. Only the
 * parsed rows leave this module, and bodies are never logged.
 */
import type { Yanhe2Course } from '@common/yanhe2Curriculum';
import {
  YANHE2_SEARCH_PAGE_SIZE,
  type Yanhe2CourseSearchPage,
  type Yanhe2CourseSearchQuery,
  type Yanhe2Term,
} from '@common/yanhe2Search';
import { YANHE2_TENANT_ID } from '@common/yanhe2';
import { termFieldsOf } from './yanhe2Curriculum';
import { YANHE2_READ_PATHS, readYanhe2, type Yanhe2Fetched } from './yanhe2Http';

type Row = Record<string, unknown>;

const isRow = (value: unknown): value is Row => !!value && typeof value === 'object' && !Array.isArray(value);
const text = (value: unknown): string =>
  typeof value === 'string' ? value.trim() : typeof value === 'number' ? String(value) : '';

/**
 * `{code:0, total, list}` — the flat envelope, although the path is a v2 one.
 * `id` is a number here. `season` is `"1"` / `"2"`, or a word for a term that
 * is neither (`2021-2022试用`, aita's trial term): those are left out of the
 * list (owner ruling 2026-10-14).
 */
export function parseTerms(body: unknown): Yanhe2Term[] | null {
  if (!isRow(body) || body.code !== 0 || !Array.isArray(body.list)) return null;
  const terms: Yanhe2Term[] = [];
  for (const row of body.list) {
    if (!isRow(row)) continue;
    const id = Number(row.id);
    const name = text(row.term_name);
    if (!Number.isInteger(id) || id <= 0 || !name) continue;
    const season = text(row.season);
    const semester = season === '1' ? 1 : season === '2' ? 2 : 0;
    const year = /^(\d{4})-\d{4}$/.exec(text(row.year));
    if (!semester || !year) continue;
    terms.push({ id, name, schoolYear: Number(year[1]), semester, current: row.current === true });
  }
  return terms;
}

/**
 * `{code:0, data:{total, list}}`; `total` is a string. No match is an empty
 * list, not an error. On this call `course_code` equals `kcwybm`, and a row
 * made by hand can have only the former.
 */
export function parseCourseSearch(body: unknown): Yanhe2CourseSearchPage | null {
  if (!isRow(body) || body.code !== 0 || !isRow(body.data) || !Array.isArray(body.data.list)) return null;
  const courses: Yanhe2Course[] = [];
  for (const row of body.data.list) {
    if (!isRow(row)) continue;
    const courseId = text(row.id);
    if (!/^\d{1,12}$/.test(courseId)) continue;
    const info = termFieldsOf(row.information, row.term_name);
    courses.push({
      courseId,
      title: text(row.title),
      teacher: text(row.realname),
      college: text(row.kkxy_name),
      term: text(row.term_name),
      schoolYear: info.schoolYear,
      semester: info.semester,
      courseCode: text(row.kcwybm) || text(row.course_code) || info.courseCode,
    });
  }
  const total = Number(body.data.total);
  return { courses, total: Number.isFinite(total) && total >= 0 ? total : courses.length };
}

export async function fetchYanhe2Terms(jwt: string): Promise<Yanhe2Fetched<Yanhe2Term[]>> {
  const fetched = await readYanhe2(jwt, YANHE2_READ_PATHS.terms, { tenant: String(YANHE2_TENANT_ID) });
  if (fetched.kind !== 'ok') return fetched;
  const data = parseTerms(fetched.data);
  return data ? { kind: 'ok', data } : { kind: 'failed', detail: 'term list was not the expected shape' };
}

export async function fetchYanhe2CourseSearch(
  jwt: string,
  query: Yanhe2CourseSearchQuery,
  pageSize: number = YANHE2_SEARCH_PAGE_SIZE,
): Promise<Yanhe2Fetched<Yanhe2CourseSearchPage>> {
  const params: Record<string, string> = {
    tenant: String(YANHE2_TENANT_ID),
    // Matches course names and teacher names; empty lists everything.
    title: query.keyword,
    page: String(query.page),
    per_page: String(pageSize),
  };
  // The bare id. The `_42_` form a course row stores matches nothing, and so
  // does more than one id: aita filters by a single term.
  if (query.termId !== null) params.term = String(query.termId);
  const fetched = await readYanhe2(jwt, YANHE2_READ_PATHS.courseSearch, params);
  if (fetched.kind !== 'ok') return fetched;
  const data = parseCourseSearch(fetched.data);
  return data ? { kind: 'ok', data } : { kind: 'failed', detail: 'course search was not the expected shape' };
}

/** What is known, from Yanhekt, about the course to find on Yanhe 2.0. */
export interface Yanhe2CourseKey {
  /** The registrar's course number: Yanhekt `number`, to equal a row's `kcwybm`. Compared whole, never parsed. */
  courseCode: string;
  /** The Chinese course name. */
  title: string;
  /** Teacher names; a fallback search when the name alone matches too many courses. */
  teachers: string[];
  /** `2026-2027-1`, the term the course runs in. Narrows the search when aita knows that term. */
  termName: string;
}

/** Rows asked for at a time when looking for one course. aita honors it (measured 2026-10-14). */
const LOOKUP_PAGE_SIZE = 200;
/** Pages of one name read before giving up: 2,000 rows, the most one name has in a term (the physics labs). */
const LOOKUP_MAX_PAGES = 10;
const LOOKUP_MAX_TEACHERS = 3;

/** The row with exactly that number. Two rows sharing one is not a match. */
export function pickCourseByCode(courses: Yanhe2Course[], courseCode: string): Yanhe2Course | null {
  if (!courseCode) return null;
  const matches = courses.filter((course) => course.courseCode === courseCode);
  return matches.length === 1 ? matches[0] : null;
}

/**
 * The Yanhe 2.0 course with a given number, or null when it has none.
 *
 * aita cannot be asked for a number: `title` matches course and teacher names
 * only, and `kcwybm=` / `course_code=` / `kcbh=` / `keyword=` are ignored
 * (measured 2026-10-14). So the course is searched by name inside its term and
 * the rows are checked. A lab course can have a thousand sections under one
 * name, so when the first page is not all of them the teachers are tried
 * next — a teacher has a handful of courses — before reading on through the
 * name.
 */
export async function fetchYanhe2CourseByCode(
  jwt: string,
  key: Yanhe2CourseKey,
): Promise<Yanhe2Fetched<Yanhe2Course | null>> {
  if (!key.courseCode || !key.title) return { kind: 'ok', data: null };

  const terms = await fetchYanhe2Terms(jwt);
  if (terms.kind !== 'ok') return terms;
  // A term aita does not list is searched across all of them.
  const termId = terms.data.find((term) => term.name === key.termName)?.id ?? null;

  const search = (keyword: string, page: number) =>
    fetchYanhe2CourseSearch(jwt, { keyword, termId, page }, LOOKUP_PAGE_SIZE);

  const first = await search(key.title, 1);
  if (first.kind !== 'ok') return first;
  let found = pickCourseByCode(first.data.courses, key.courseCode);
  if (found || first.data.total <= LOOKUP_PAGE_SIZE) return { kind: 'ok', data: found };

  for (const teacher of key.teachers.filter(Boolean).slice(0, LOOKUP_MAX_TEACHERS)) {
    const byTeacher = await search(teacher, 1);
    if (byTeacher.kind !== 'ok') return byTeacher;
    found = pickCourseByCode(byTeacher.data.courses, key.courseCode);
    if (found) return { kind: 'ok', data: found };
  }

  const pages = Math.min(LOOKUP_MAX_PAGES, Math.ceil(first.data.total / LOOKUP_PAGE_SIZE));
  for (let page = 2; page <= pages; page++) {
    const next = await search(key.title, page);
    if (next.kind !== 'ok') return next;
    found = pickCourseByCode(next.data.courses, key.courseCode);
    if (found) return { kind: 'ok', data: found };
  }
  return { kind: 'ok', data: null };
}
