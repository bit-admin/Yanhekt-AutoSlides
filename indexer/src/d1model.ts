/**
 * The D1 data model: a slim projection of the local database, holding only
 * what the Index API (share/src/api) serves. The local SQLite keeps every
 * field the crawler fetched (schema.ts); upload and dump convert rows with the
 * functions below. Read by the share Worker; shared there through its tests.
 *
 * Why slim: the free D1 plan allows 500 MB, 100k rows written and 5M rows read
 * per day, and every index entry counts as a written row.
 *   - courses: one row per course, with its session ids as a JSON list. There
 *     is no sessions table: a client gets a session's details from Yanhekt,
 *     which serves them without login; only the list of a course's sessions
 *     needs our crawl.
 *   - course_grams: the search index (see grams.ts), keyed by term first, so a
 *     search (always within one term) reads only that term's entries.
 *     Registrar codes go under the empty term: they are found in any term.
 * Not in D1: session details, videos, English names, staff numbers.
 * Kept on purpose: `courses.number`, cbiz's registrar code, which equals
 * Yanhe 2.0's `kcwybm` and is how a course is matched between the two sites
 * (docs/aita-yanhekt.md §4.1).
 */

import type { DatabaseSync } from 'node:sqlite';
import { courseGrams } from './grams.ts';
import { sqlLiteral } from './sql.ts';

/** Bump when the D1 layout changes; `upload` refuses another layout until `--reset`. */
export const D1_SCHEMA_VERSION = 3;

/** `course_grams.term` of grams found in every term (registrar codes). */
export const ANY_TERM = '';

export const D1_SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS courses (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  number TEXT,
  term TEXT,
  teachers TEXT,
  session_ids TEXT NOT NULL DEFAULT '[]',
  detail INTEGER NOT NULL DEFAULT 0,
  fetched_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS course_grams (
  term TEXT NOT NULL,
  gram TEXT NOT NULL,
  course_id INTEGER NOT NULL,
  PRIMARY KEY (term, gram, course_id)
) WITHOUT ROWID;

CREATE TABLE IF NOT EXISTS device_progress (
  device TEXT PRIMARY KEY,
  lanes TEXT NOT NULL,
  totals TEXT NOT NULL,
  uploaded_at INTEGER NOT NULL
);

INSERT INTO meta (key, value) VALUES ('schema', '${D1_SCHEMA_VERSION}')
  ON CONFLICT(key) DO UPDATE SET value = excluded.value;
`;

/** Everything a D1 of any earlier layout may hold. */
export const D1_RESET_SQL = ['meta', 'courses', 'sessions', 'lives', 'videos', 'course_grams', 'device_progress']
  .map((t) => `DROP TABLE IF EXISTS ${t};`)
  .join('\n');

type Row = Record<string, unknown>;

const str = (v: unknown): string | null => {
  if (typeof v !== 'string') return null;
  const t = v.trim();
  return t === '' ? null : t;
};
const int = (v: unknown): number | null => {
  const n = Number(v);
  return v === null || v === undefined || v === '' || !Number.isFinite(n) ? null : Math.trunc(n);
};
const seconds = (ms: unknown): number => Math.floor((int(ms) ?? 0) / 1000);

function parseJson(v: unknown): unknown {
  if (typeof v !== 'string' || v === '') return null;
  try {
    return JSON.parse(v);
  } catch {
    return null;
  }
}

/** Our term key `2026-2027-1`, from a course's `school_year` and `semester`. */
export function termKey(schoolYear: unknown, semester: unknown): string | null {
  const year = str(schoolYear);
  const n = int(semester);
  if (!year || !/^\d{4}-\d{4}$/.test(year) || n === null || n < 1 || n > 9) return null;
  return `${year}-${n}`;
}

/** Teacher names only: titles and staff numbers stay local. */
function teachersOf(local: Row): string[] {
  const list = parseJson(local.professors);
  if (Array.isArray(list)) {
    const out: string[] = [];
    for (const p of list) {
      const name = str(p && typeof p === 'object' ? (p as Row).name : null);
      if (name && !out.includes(name)) out.push(name);
    }
    if (out.length) return out;
  }
  return (str(local.professor_names) ?? '')
    .split(/[、,，]/)
    .map((n) => n.trim())
    .filter(Boolean);
}

/** A course's sessions as the local database knows them. */
export interface LocalSessions {
  /** Ids of sessions Yanhekt still serves, ascending. */
  ids: number[];
  /** Ids Yanhekt stopped serving; removed from D1's list. */
  gone: number[];
}

/** Reads one course's sessions from the local database (uses idx_sessions_course). */
export function localSessionsReader(db: DatabaseSync): (courseId: number) => LocalSessions {
  const st = db.prepare('SELECT id, gone_at FROM sessions WHERE course_id = ? ORDER BY id');
  return (courseId) => {
    const out: LocalSessions = { ids: [], gone: [] };
    for (const r of st.all(courseId) as Array<{ id: number; gone_at: number | null }>) {
      (r.gone_at == null ? out.ids : out.gone).push(Number(r.id));
    }
    return out;
  };
}

export interface D1Course {
  id: number;
  name: string;
  number: string | null;
  term: string | null;
  teachers: string | null;
  session_ids: string;
  detail: number;
  fetched_at: number;
}

/** A local `courses` row and its sessions → the D1 row and its search grams. */
export function projectCourse(local: Row, sessions: LocalSessions): { row: D1Course; grams: string[]; gone: number[] } {
  const teachers = teachersOf(local);
  const row: D1Course = {
    id: Number(local.id),
    name: str(local.name_zh) ?? '',
    number: str(local.number),
    term: termKey(local.school_year, local.semester),
    teachers: teachers.length ? JSON.stringify(teachers) : null,
    session_ids: JSON.stringify(sessions.ids),
    detail: local.detail_status === 'ok' ? 1 : 0,
    fetched_at: seconds(local.detail_fetched_at ?? local.first_seen_at),
  };
  const grams = courseGrams({ name: row.name, teachers, number: row.number });
  return { row, grams, gone: sessions.gone };
}

/** The incoming copy's fields win when it is fuller, or as full and as new. */
const INCOMING_WINS =
  'excluded.detail > courses.detail OR (excluded.detail = courses.detail AND excluded.fetched_at >= courses.fetched_at)';
const COURSE_FIELDS = ['name', 'number', 'term', 'teachers', 'detail', 'fetched_at'] as const;

/**
 * Upsert of one course. Fields follow INCOMING_WINS; session ids are merged:
 * D1's list plus this copy's, minus the ones this copy knows are gone, so
 * devices that each saw part of a course cannot overwrite one another.
 */
export function courseRowStatement(row: D1Course, gone: number[]): string {
  const cols = Object.keys(row);
  const values = Object.values(row).map((v) => sqlLiteral(v));
  const sets = COURSE_FIELDS.map((c) => `${c} = CASE WHEN ${INCOMING_WINS} THEN excluded.${c} ELSE courses.${c} END`);
  const merged =
    '(SELECT json_group_array(v) FROM (' +
    'SELECT value AS v FROM json_each(courses.session_ids) UNION SELECT value FROM json_each(excluded.session_ids)' +
    ` EXCEPT SELECT value FROM json_each(${sqlLiteral(JSON.stringify(gone))}) ORDER BY 1))`;
  return (
    `INSERT INTO courses (${cols.join(', ')}) VALUES (${values.join(', ')}) ` +
    `ON CONFLICT(id) DO UPDATE SET ${sets.join(', ')}, session_ids = ${merged}`
  );
}

/** Grams of one course. Only ever added: a stale one yields a candidate that ranking drops. */
export function courseGramsStatement(row: D1Course, grams: string[]): string | null {
  if (grams.length === 0) return null;
  const term = row.term ?? '-';
  const values = grams.map((g) => `(${sqlLiteral(g.startsWith('n:') ? ANY_TERM : term)}, ${sqlLiteral(g)}, ${row.id})`);
  return `INSERT OR IGNORE INTO course_grams (term, gram, course_id) VALUES ${values.join(', ')}`;
}

/** Both statements for one course (dump, tests). */
export function courseStatements(local: Row, sessions: LocalSessions): string[] {
  const { row, grams, gone } = projectCourse(local, sessions);
  const g = courseGramsStatement(row, grams);
  return g ? [courseRowStatement(row, gone), g] : [courseRowStatement(row, gone)];
}

/**
 * Marks new data. The share Worker keys its cache by this value, so a search
 * is answered from cache until the next upload changes it.
 */
export function dataVersionStatement(version: number): string {
  return `INSERT INTO meta (key, value) VALUES ('data', ${sqlLiteral(String(version))}) ON CONFLICT(key) DO UPDATE SET value = excluded.value`;
}
