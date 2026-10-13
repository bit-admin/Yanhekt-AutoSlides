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
): Promise<Yanhe2Fetched<Yanhe2CourseSearchPage>> {
  const params: Record<string, string> = {
    tenant: String(YANHE2_TENANT_ID),
    // Matches course names and teacher names; empty lists everything.
    title: query.keyword,
    page: String(query.page),
    per_page: String(YANHE2_SEARCH_PAGE_SIZE),
  };
  // The bare id. The `_42_` form a course row stores matches nothing, and so
  // does more than one id: aita filters by a single term.
  if (query.termId !== null) params.term = String(query.termId);
  const fetched = await readYanhe2(jwt, YANHE2_READ_PATHS.courseSearch, params);
  if (fetched.kind !== 'ok') return fetched;
  const data = parseCourseSearch(fetched.data);
  return data ? { kind: 'ok', data } : { kind: 'failed', detail: 'course search was not the expected shape' };
}
