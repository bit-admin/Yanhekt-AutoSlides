/**
 * `GET /api/search` against the `yanhekt-index` D1 database. The layout is
 * the indexer's (indexer/src/d1model.ts); this Worker only reads it.
 *
 * Every search is within one term, and `course_grams` is keyed by term first,
 * so only that term's entries are read. Two round trips, no table scans:
 *   1. one batch: the first CAP+1 course ids of each search key (a gram, or a
 *      `w:` prefix range), plus the whole query as a registrar code or a
 *      course id (those match in any term).
 *   2. if some key had at most CAP courses, its list is complete and holds
 *      every match (each key must match): fetch just those courses (rarest
 *      key first). Otherwise intersect all keys in D1 and fetch the result.
 * searchRank.ts then checks every word against the rows and orders them.
 * Rows read ≈ (CAP+1) per key + the candidates; only when every key is common
 * does it read every key's entries in that term.
 */

import { numberKey, prefixEnd, wordLookup } from '../../../indexer/src/grams.ts';
import type { D1Database, D1PreparedStatement } from '../lib/runtime';
import type { SearchParams } from './searchParams';
import { compareRanked, COURSE_COLUMNS, rank, type CourseRow, type MatchField } from './searchRank';

/** Entries read per key in the first round; a key with no more than this is complete. */
export const CAP = 32;
/** Matches returned in one response, best first; no paging. */
export const MAX_RESULTS = 200;
/** Candidate cap for the intersection; past it, `truncated` is set. */
export const MAX_CANDIDATES = 5000;

export interface CourseResult {
  id: number;
  name: string;
  /** cbiz registrar code; equals Yanhe 2.0's `kcwybm`. */
  number: string | null;
  /** Our term key, e.g. `2026-2027-1`. */
  term: string | null;
  /** Names only. */
  teachers: string[];
  /** Session ids in the index (`GET /api/courses/{id}/sessions`). */
  sessionCount: number;
  match: { fields: MatchField[] };
}

export interface SearchResponse {
  query: { q: string; term: string };
  /** All matches; `results` holds at most MAX_RESULTS of them. */
  total: number;
  truncated: boolean;
  results: CourseResult[];
}

type Key = { gram: string } | { from: string; to: string };

/** The search keys of every looked-up word; each must match. */
export function searchKeys(tokens: string[]): Key[] {
  const keys: Key[] = [];
  for (const t of tokens) {
    const lookup = wordLookup(t);
    if (lookup.kind === 'bigrams') for (const gram of lookup.grams) keys.push({ gram });
    if (lookup.kind === 'prefix') keys.push({ from: `w:${t}`, to: prefixEnd(`w:${t}`) });
  }
  const seen = new Set<string>();
  return keys.filter((k) => {
    const id = JSON.stringify(k);
    return seen.has(id) ? false : (seen.add(id), true);
  });
}

/** `SELECT course_id …` for one key within the term, and its binds. */
function keySql(term: string, k: Key): [string, unknown[]] {
  return 'gram' in k
    ? ['SELECT course_id FROM course_grams WHERE term = ? AND gram = ?', [term, k.gram]]
    : ['SELECT course_id FROM course_grams WHERE term = ? AND gram >= ? AND gram < ?', [term, k.from, k.to]];
}

function coursesByIds(db: D1Database, ids: number[]): D1PreparedStatement {
  return db
    .prepare(`SELECT ${COURSE_COLUMNS} FROM courses WHERE id IN (SELECT value FROM json_each(?))`)
    .bind(JSON.stringify(ids));
}

async function candidates(db: D1Database, p: SearchParams): Promise<{ rows: CourseRow[]; truncated: boolean }> {
  const keys = searchKeys(p.tokens);
  const stmts = keys.map((k) => {
    const [sql, binds] = keySql(p.term, k);
    return db.prepare(`${sql} LIMIT ${CAP + 1}`).bind(...binds);
  });
  const asNumber = numberKey(p.q);
  if (asNumber !== null) {
    stmts.push(
      db
        .prepare(`SELECT ${COURSE_COLUMNS} FROM courses WHERE id IN (SELECT course_id FROM course_grams WHERE term = '' AND gram = ?)`)
        .bind(`n:${asNumber}`),
    );
  }
  if (/^\d{1,9}$/.test(p.q)) stmts.push(db.prepare(`SELECT ${COURSE_COLUMNS} FROM courses WHERE id = ?`).bind(Number(p.q)));
  const first = await db.batch<Record<string, unknown>>(stmts);

  const identified = first.slice(keys.length).flatMap((r) => r.results as unknown as CourseRow[]);
  const lists = first.slice(0, keys.length).map((r) => [...new Set(r.results.map((x) => Number(x.course_id)))]);
  const complete = lists.filter((l) => l.length <= CAP).sort((a, b) => a.length - b.length);

  if (complete.length > 0) {
    const ids = complete[0];
    if (ids.length === 0) return { rows: identified, truncated: false };
    const { results } = await coursesByIds(db, ids).all<CourseRow>();
    return { rows: [...identified, ...results], truncated: false };
  }

  // Every key is common in this term: intersect them all in D1.
  const parts = keys.map((k) => keySql(p.term, k));
  const { results } = await db
    .prepare(
      `SELECT ${COURSE_COLUMNS} FROM courses WHERE id IN (${parts.map(([sql]) => sql).join(' INTERSECT ')}) ` +
        `ORDER BY id DESC LIMIT ${MAX_CANDIDATES + 1}`,
    )
    .bind(...parts.flatMap(([, binds]) => binds))
    .all<CourseRow>();
  const truncated = results.length > MAX_CANDIDATES;
  return { rows: [...identified, ...results.slice(0, MAX_CANDIDATES)], truncated };
}

export async function search(db: D1Database, p: SearchParams): Promise<SearchResponse> {
  const { rows, truncated } = await candidates(db, p);
  const ranked = rank(rows, p).sort(compareRanked);
  return {
    query: { q: p.q, term: p.term },
    total: ranked.length,
    truncated,
    results: ranked.slice(0, MAX_RESULTS).map((r) => ({
      id: r.row.id,
      name: r.row.name,
      number: r.row.number,
      term: r.row.term,
      teachers: r.teachers,
      sessionCount: Number(r.row.session_count ?? 0),
      match: { fields: r.fields },
    })),
  };
}

/** `GET /api/courses/{id}/sessions`: the course's session ids, ascending; null if the course is unknown. */
export async function courseSessions(db: D1Database, courseId: number): Promise<{ course: number; sessions: number[] } | null> {
  const row = await db.prepare('SELECT session_ids FROM courses WHERE id = ?').bind(courseId).first<{ session_ids: string }>();
  if (!row) return null;
  const ids = JSON.parse(row.session_ids) as unknown;
  return { course: courseId, sessions: Array.isArray(ids) ? ids.map(Number).sort((a, b) => a - b) : [] };
}
