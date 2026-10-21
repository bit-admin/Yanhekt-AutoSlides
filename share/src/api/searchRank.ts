/**
 * Matching and ordering for `/api/search`. Pure: the D1 layer (search.ts)
 * finds candidates through `course_grams` and hands over their course rows;
 * this module checks every word against each row and orders the matches.
 *
 * Checks mirror what the grams can find (indexer/src/grams.ts):
 *   CJK word:   the course name or a teacher name contains it
 *   other word: a word of the name or of a teacher name starts with it
 *   1-char word (not looked up): name/teacher contains it, or a word starts with it
 * Word matches count only in the searched term. A query that is a course's
 * whole registrar code (`number`) or its id matches it in any term.
 */

import { isCjkWord, numberKey, splitWords } from '../../../indexer/src/grams.ts';
import type { SearchParams } from './searchParams';

/** One D1 `courses` row (indexer/src/d1model.ts), as search.ts selects it. */
export interface CourseRow {
  id: number;
  name: string;
  number: string | null;
  term: string | null;
  teachers: string | null;
  session_count: number;
}

export const COURSE_COLUMNS = 'id, name, number, term, teachers, json_array_length(session_ids) AS session_count';

export type MatchField = 'name' | 'teacher' | 'number' | 'id';

export interface Ranked {
  row: CourseRow;
  teachers: string[];
  score: number;
  fields: MatchField[];
}

/** `courses.teachers`: a JSON array of names. */
export function parseTeachers(json: string | null): string[] {
  if (!json) return [];
  try {
    const v = JSON.parse(json) as unknown;
    return Array.isArray(v) ? v.filter((t): t is string => typeof t === 'string') : [];
  } catch {
    return [];
  }
}

interface Fields {
  name: string;
  nameWords: string[];
  teachers: string[];
  teacherWords: string[][];
}

function fieldsOf(row: CourseRow, teachers: string[]): Fields {
  const names = teachers.map((n) => n.toLowerCase());
  return {
    name: row.name.toLowerCase(),
    nameWords: splitWords(row.name),
    teachers: names,
    teacherWords: names.map((n) => splitWords(n)),
  };
}

/** Best score of one query word against one course, and the field it hit. 0 = no match. */
export function scoreWord(word: string, f: Fields): [number, MatchField | null] {
  let best = 0;
  let field: MatchField | null = null;
  const hit = (score: number, which: MatchField) => {
    if (score > best) {
      best = score;
      field = which;
    }
  };
  if (isCjkWord(word)) {
    if (f.name === word) hit(70, 'name');
    else if (f.name.startsWith(word)) hit(55, 'name');
    else if (f.name.includes(word)) hit(40, 'name');
    for (const t of f.teachers) {
      if (t === word) hit(60, 'teacher');
      else if (t.startsWith(word)) hit(35, 'teacher');
      else if (t.includes(word)) hit(25, 'teacher');
    }
  } else {
    if (f.nameWords.includes(word)) hit(55, 'name');
    else if (f.nameWords.some((w) => w.startsWith(word))) hit(45, 'name');
    for (const words of f.teacherWords) {
      if (words.includes(word)) hit(50, 'teacher');
      else if (words.some((w) => w.startsWith(word))) hit(30, 'teacher');
    }
  }
  return [best, field];
}

/** Whole-query identifier matches: the registrar code, or the course id. */
function identifierMatch(row: CourseRow, q: string): Ranked['fields'] | null {
  const asNumber = numberKey(q);
  if (asNumber !== null && numberKey(row.number) === asNumber) return ['number'];
  if (/^\d{1,9}$/.test(q) && row.id === Number(q)) return ['id'];
  return null;
}

/** Check and score every candidate; drop those where some word does not match. */
export function rank(rows: readonly CourseRow[], p: SearchParams): Ranked[] {
  const joined = p.tokens.join('');
  const out = new Map<number, Ranked>();
  for (const row of rows) {
    if (out.has(row.id)) continue;
    const teachers = parseTeachers(row.teachers);
    const ident = identifierMatch(row, p.q);
    if (ident) {
      out.set(row.id, { row, teachers, score: ident[0] === 'id' ? 90 : 85, fields: ident });
      continue;
    }
    if (row.term !== p.term) continue;
    const f = fieldsOf(row, teachers);
    let score = 0;
    const fields = new Set<MatchField>();
    let ok = true;
    for (const word of p.tokens) {
      const [s, which] = scoreWord(word, f);
      if (s === 0 || which === null) {
        ok = false;
        break;
      }
      score += s;
      fields.add(which);
    }
    if (!ok) continue;
    if (p.tokens.length > 1 && f.name === joined) score += 30;
    out.set(row.id, { row, teachers, score, fields: [...fields] });
  }
  return [...out.values()];
}

const collator = new Intl.Collator('zh-Hans-CN');

/** Relevance, then name (pinyin order), then the newer course id. */
export function compareRanked(a: Ranked, b: Ranked): number {
  return b.score - a.score || collator.compare(a.row.name, b.row.name) || b.row.id - a.row.id;
}
