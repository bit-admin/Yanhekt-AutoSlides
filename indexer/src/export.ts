/**
 * Per-term JSON files for the release: the same slim projection as D1
 * (d1model.ts projectCourse), one file per term, from `minTerm` on.
 *
 *   { "format": 1, "term": "2025-2026-1",
 *     "fields": ["id", "name", "number", "teachers", "sessions"],
 *     "courses": [[48123, "高等数学", "…", ["…"], [801234, 801240]], …] }
 *
 * Courses are sorted by id, sessions ascending, gone sessions left out, so an
 * unchanged term gives the same bytes (and the same hash) on every run.
 */

import { createHash } from 'node:crypto';
import type { DatabaseSync } from 'node:sqlite';
import { TERM_FIELDS, TERM_FORMAT } from './clientIndex.ts';
import { localSessionsReader, projectCourse } from './d1model.ts';

export const EXPORT_FORMAT = TERM_FORMAT;
export const EXPORT_FIELDS = TERM_FIELDS;

/** Oldest term that goes into the release (owner decision 2026-10-25). */
export const DEFAULT_MIN_TERM = '2023-2024-1';

export interface TermFile {
  term: string;
  courses: number;
  sessions: number;
  /** sha256 of `json`, hex. */
  sha256: string;
  json: Buffer;
}

/** `2023-2024-1` style keys compare correctly as strings. */
export function termAtLeast(term: string, min: string): boolean {
  return term >= min;
}

export function exportTerms(db: DatabaseSync, minTerm: string = DEFAULT_MIN_TERM): TermFile[] {
  const sessionsOf = localSessionsReader(db);
  const byTerm = new Map<string, unknown[][]>();
  const counts = new Map<string, number>();
  for (const local of db.prepare('SELECT * FROM courses ORDER BY id').all() as Array<Record<string, unknown>>) {
    const s = sessionsOf(Number(local.id));
    const { row } = projectCourse(local, s);
    if (!row.term || !termAtLeast(row.term, minTerm)) continue;
    const teachers = row.teachers ? (JSON.parse(row.teachers) as string[]) : [];
    let list = byTerm.get(row.term);
    if (!list) byTerm.set(row.term, (list = []));
    list.push([row.id, row.name, row.number, teachers, s.ids]);
    counts.set(row.term, (counts.get(row.term) ?? 0) + s.ids.length);
  }
  return [...byTerm.keys()].sort().reverse().map((term) => {
    const courses = byTerm.get(term)!;
    const json = Buffer.from(JSON.stringify({ format: EXPORT_FORMAT, term, fields: EXPORT_FIELDS, courses }));
    return {
      term,
      courses: courses.length,
      sessions: counts.get(term) ?? 0,
      sha256: createHash('sha256').update(json).digest('hex'),
      json,
    };
  });
}
