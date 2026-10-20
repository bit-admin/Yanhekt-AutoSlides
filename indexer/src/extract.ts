/** Turn raw API objects into column/value rows. Pure. */

import type { Columns } from './schema.ts';
import type { Json } from './yanhekt.ts';

export type SqlValue = string | number | null;
export type Row = Record<string, SqlValue>;

/** Some URLs arrive double-escaped (`https:\/\/cvideo…`). */
function unescapeSlashes(s: string): string {
  return s.includes('\\/') ? s.replaceAll('\\/', '/') : s;
}

function deepClean(v: unknown): unknown {
  if (typeof v === 'string') return unescapeSlashes(v);
  if (Array.isArray(v)) return v.map(deepClean);
  if (v && typeof v === 'object') {
    const out: Json = {};
    for (const [k, val] of Object.entries(v)) out[k] = deepClean(val);
    return out;
  }
  return v;
}

/** One API value → something SQLite binds: objects/arrays as JSON text. */
export function toSql(v: unknown): SqlValue {
  if (v === null || v === undefined) return null;
  if (typeof v === 'boolean') return v ? 1 : 0;
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (typeof v === 'bigint') return Number(v);
  if (typeof v === 'string') return unescapeSlashes(v);
  return JSON.stringify(deepClean(v));
}

/**
 * Known keys → columns; everything else (minus `skip`) → `extra` JSON, or
 * null when there is nothing left over.
 */
export function splitRow(obj: Json, columns: Columns, skip: readonly string[] = []): Row {
  const row: Row = {};
  const known = new Set<string>();
  for (const [name] of columns) {
    known.add(name);
    row[name] = toSql(obj[name]);
  }
  const extra: Json = {};
  for (const [k, v] of Object.entries(obj)) {
    if (!known.has(k) && !skip.includes(k)) extra[k] = deepClean(v);
  }
  row.extra = Object.keys(extra).length > 0 ? JSON.stringify(extra) : null;
  return row;
}

export function asObject(v: unknown): Json | null {
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as Json) : null;
}

/** Video ids from a session, as numbers. */
export function videoIdsOf(session: Json): number[] {
  const raw = session.video_ids;
  if (!Array.isArray(raw)) return [];
  return raw.map((v) => Number(v)).filter((n) => Number.isSafeInteger(n) && n > 0);
}

/** Teacher names from `/v1/course/professor/list` (or a course's `professors`). */
export function professorNames(list: unknown): string[] {
  if (!Array.isArray(list)) return [];
  return list
    .map((p) => (typeof p === 'string' ? p : String(asObject(p)?.name ?? '')).trim())
    .filter((n) => n.length > 0);
}
