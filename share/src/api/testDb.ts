/**
 * Test-only: an in-memory SQLite with the indexer's D1 layout, behind the
 * slice of the D1 API this Worker uses. Rows go in through the indexer's own
 * upload statements, so these tests cover the path a real upload takes.
 * Not imported by the Worker.
 */

import { DatabaseSync } from 'node:sqlite';
import { courseStatements, D1_SCHEMA_SQL, dataVersionStatement } from '../../../indexer/src/d1model.ts';
import type { D1Database, D1PreparedStatement, D1Result } from '../lib/runtime';

export interface TestDb extends D1Database {
  raw: DatabaseSync;
  /** Statements run so far (to assert on query shape). */
  log: string[];
  /** Rows the queries returned so far (a stand-in for D1's rows read). */
  rowsReturned: number;
}

export function testDb(): TestDb {
  const raw = new DatabaseSync(':memory:');
  raw.exec(D1_SCHEMA_SQL);

  const db: TestDb = {
    raw,
    log: [],
    rowsReturned: 0,
    prepare: (sql: string) => statement(sql),
    batch: async <T>(stmts: D1PreparedStatement[]) =>
      stmts.map((s) => (s as unknown as { exec(): D1Result }).exec()) as unknown as D1Result<T>[],
  };

  const statement = (sql: string, binds: unknown[] = []): D1PreparedStatement & { exec(): D1Result } => {
    const exec = (): D1Result => {
      db.log.push(sql);
      const params = binds as Array<string | number | null>;
      if (params.length > 100) throw new Error(`D1 allows at most 100 bound parameters (got ${params.length})`);
      const results = raw.prepare(sql).all(...params) as Record<string, unknown>[];
      db.rowsReturned += results.length;
      return { results, success: true };
    };
    return {
      bind: (...values: unknown[]) => statement(sql, values),
      first: async <T>() => (exec().results[0] as T) ?? null,
      run: async () => exec(),
      all: async <T>() => exec() as unknown as D1Result<T>,
      exec,
    };
  };
  return db;
}

const NOW = 1_760_000_000_000;

/** A course as the indexer's local database holds it, uploaded the way `upload` does. */
export function addCourse(
  db: TestDb,
  c: {
    id: number;
    name: string;
    nameEn?: string;
    number?: string;
    year?: string;
    semester?: number;
    teachers?: Array<[name: string, title: string]>;
    sessions?: number[];
  },
): void {
  const teachers = c.teachers ?? [];
  const local = {
    id: c.id,
    name_zh: c.name,
    name_en: c.nameEn ?? null,
    code: String(100000000 + c.id),
    number: c.number ?? `01S01${c.id}`,
    school_year: c.year ?? '2026-2027',
    semester: c.semester ?? 1,
    college_code: '205',
    college_name: '信息与电子学院',
    professors: JSON.stringify(teachers.map(([name, title], i) => ({ id: i + 1, name, title, badge: `61201${i}` }))),
    professor_names: teachers.map(([n]) => n).join('、') || null,
    detail_status: 'ok',
    first_seen_at: NOW,
    detail_fetched_at: NOW,
  };
  for (const s of courseStatements(local, { ids: c.sessions ?? [], gone: [] })) db.raw.exec(s);
}

export function setDataVersion(db: TestDb, version: number): void {
  db.raw.exec(dataVersionStatement(version));
}
