/**
 * Yanhe 2.0 「我的收藏」: the account's course bookmarks, which pins sync with.
 *
 * Measured 2026-10-27 (docs/aita-yanhekt.md §5.14, §5.16):
 * - The list returns every term, unlike Yanhekt's subscription list.
 * - A row names the course but carries no registrar number and no term;
 *   those come from `get-course-detail`.
 * - Adding a bookmark that exists answers `err: 201` (重复收藏) and changes
 *   nothing, so it counts as done. Removing is safe to repeat.
 * - `is_collect` on `get-course-detail` stays 0 for a bookmarked course, so
 *   the list is the only way to read bookmarks.
 */
import { readYanhe2, writeYanhe2, YANHE2_READ_PATHS, YANHE2_WRITE_PATHS, type Yanhe2Fetched } from './yanhe2Http';

/** One bookmark, as much as a pin needs. */
export interface Yanhe2Bookmark {
  courseId: string;
  title: string;
  /** Teachers' real names, the speaker first. No staff numbers. */
  teachers: string[];
  /** Unix seconds; 0 when the row had none. */
  collectedAt: number;
  /** False when the course was unpublished or deleted on aita. */
  available: boolean;
}

const PAGE_SIZE = 50;
const MAX_PAGES = 20;

const str = (value: unknown): string => (value === null || value === undefined ? '' : String(value).trim());

function envelopeData(body: unknown): Record<string, unknown> | null {
  if (!body || typeof body !== 'object') return null;
  const result = (body as { result?: unknown }).result;
  if (!result || typeof result !== 'object') return null;
  const { err, data } = result as { err?: unknown; data?: unknown };
  if (Number(err) !== 200 || !data || typeof data !== 'object') return null;
  return data as Record<string, unknown>;
}

function parseTeachers(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const rows = value
    .filter((t): t is Record<string, unknown> => !!t && typeof t === 'object')
    .map((t) => ({ name: str(t.realname), speaker: str(t.is_speaker) === '1' }))
    .filter((t) => t.name);
  rows.sort((a, b) => Number(b.speaker) - Number(a.speaker));
  return [...new Set(rows.map((t) => t.name))];
}

/** One page of the list; null when the answer is not the expected shape. */
export function parseBookmarkPage(body: unknown): { rows: Yanhe2Bookmark[]; total: number } | null {
  const data = envelopeData(body);
  if (!data || !Array.isArray(data.models)) return null;
  const rows: Yanhe2Bookmark[] = [];
  for (const raw of data.models) {
    if (!raw || typeof raw !== 'object') continue;
    const row = raw as Record<string, unknown>;
    const courseId = str(row.course_id);
    if (!/^\d{1,12}$/.test(courseId)) continue;
    rows.push({
      courseId,
      title: str(row.course_title),
      teachers: parseTeachers(row.teachers),
      collectedAt: Number(row.collect_time) || 0,
      available: str(row.course_publish) !== '0' && (str(row.course_deleted_at) === '' || str(row.course_deleted_at) === '0'),
    });
  }
  return { rows, total: Number(data.total) || 0 };
}

/** True when a bookmark add or remove went through (or had nothing to do). */
export function parseBookmarkWrite(body: unknown): boolean {
  if (!body || typeof body !== 'object') return false;
  const result = (body as { result?: unknown }).result;
  if (!result || typeof result !== 'object') return false;
  const err = Number((result as { err?: unknown }).err);
  // 201: already bookmarked.
  return err === 200 || err === 201;
}

/** Every bookmark of the account, all pages. */
export async function fetchYanhe2Bookmarks(jwt: string): Promise<Yanhe2Fetched<Yanhe2Bookmark[]>> {
  const all: Yanhe2Bookmark[] = [];
  for (let page = 1; page <= MAX_PAGES; page++) {
    const fetched = await readYanhe2(jwt, YANHE2_READ_PATHS.bookmarks, {
      course_title: '',
      page: String(page),
      'per-page': String(PAGE_SIZE),
    });
    if (fetched.kind !== 'ok') return fetched;
    const parsed = parseBookmarkPage(fetched.data);
    if (!parsed) return { kind: 'failed', detail: 'bookmark list was not the expected shape' };
    all.push(...parsed.rows);
    if (parsed.rows.length < PAGE_SIZE || all.length >= parsed.total) break;
  }
  return { kind: 'ok', data: all };
}

/** Bookmark a course (`on`) or remove the bookmark. */
export async function setYanhe2Bookmark(jwt: string, courseId: string, on: boolean): Promise<Yanhe2Fetched<true>> {
  const params: Record<string, string> = { course_id: courseId };
  if (!on) params.cancel = '1';
  const fetched = await writeYanhe2(jwt, YANHE2_WRITE_PATHS.bookmark, params);
  if (fetched.kind !== 'ok') return fetched;
  return parseBookmarkWrite(fetched.data)
    ? { kind: 'ok', data: true }
    : { kind: 'failed', detail: `bookmark ${on ? 'add' : 'remove'} was refused` };
}
