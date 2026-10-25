/**
 * Course search over the index files on this computer, matched and ordered
 * the way the online Index does it (share/src/api/searchRank.ts, drift group
 * `courseIndexSearch` in scripts/check-drift.mjs: port changes both ways), so
 * the same query gives the same courses from either source.
 *
 *   CJK word:   the course name or a teacher name contains it
 *   other word: a word of the name or of a teacher name starts with it
 *   1-char word: only narrows what the other words found
 * Word matches count only in the searched term. A query that is a course's
 * whole registrar code (`number`) or its id matches it in any term.
 */

import { isCjkWord, numberKey, searchWords, splitWords } from './grams';
import type { TermCourse } from './clientIndex';

/** A course with the term it belongs to. */
export interface IndexCourse extends TermCourse {
  term: string;
}

export type MatchField = 'name' | 'teacher' | 'number' | 'id';

interface Ranked {
  course: IndexCourse;
  score: number;
}

interface Fields {
  name: string;
  nameWords: string[];
  teachers: string[];
  teacherWords: string[][];
}

function fieldsOf(c: IndexCourse): Fields {
  const names = c.teachers.map((n) => n.toLowerCase());
  return {
    name: c.name.toLowerCase(),
    nameWords: splitWords(c.name),
    teachers: names,
    teacherWords: names.map((n) => splitWords(n)),
  };
}

/** Best score of one query word against one course. 0 = no match. Same table as the online Index. */
export function scoreWord(word: string, f: Fields): number {
  let best = 0;
  const hit = (score: number) => {
    if (score > best) best = score;
  };
  if (isCjkWord(word)) {
    if (f.name === word) hit(70);
    else if (f.name.startsWith(word)) hit(55);
    else if (f.name.includes(word)) hit(40);
    for (const t of f.teachers) {
      if (t === word) hit(60);
      else if (t.startsWith(word)) hit(35);
      else if (t.includes(word)) hit(25);
    }
  } else {
    if (f.nameWords.includes(word)) hit(55);
    else if (f.nameWords.some((w) => w.startsWith(word))) hit(45);
    for (const words of f.teacherWords) {
      if (words.includes(word)) hit(50);
      else if (words.some((w) => w.startsWith(word))) hit(30);
    }
  }
  return best;
}

/** Whole-query identifier match: the registrar code (85) or the course id (90); 0 otherwise. */
export function identifierScore(c: IndexCourse, q: string): number {
  const asNumber = numberKey(q);
  if (asNumber !== null && numberKey(c.number) === asNumber) return 85;
  if (/^\d{1,9}$/.test(q) && c.id === String(Number(q))) return 90;
  return 0;
}

const collator = new Intl.Collator('zh-Hans-CN');

function compareRanked(a: Ranked, b: Ranked): number {
  return b.score - a.score || collator.compare(a.course.name, b.course.name) || Number(b.course.id) - Number(a.course.id);
}

/**
 * The matches of `q`, best first. `termCourses` are the searched term's
 * courses; `allCourses` (every term held) are checked for an identifier match
 * only. A query with no words finds nothing.
 */
export function searchCourses(q: string, term: string, termCourses: readonly IndexCourse[], allCourses: readonly IndexCourse[] = termCourses): IndexCourse[] {
  // A pasted course link is its id, as on the online Index.
  const linked = /yanhekt\.cn\/(?:#\/)?course\/(\d+)/i.exec(q);
  const trimmed = linked ? linked[1] : q.trim().replace(/\s+/g, ' ');
  const tokens = searchWords(trimmed);
  if (tokens.length === 0) return [];
  const joined = tokens.join('');
  const out = new Map<string, Ranked>();
  for (const c of allCourses) {
    const ident = identifierScore(c, trimmed);
    if (ident > 0) out.set(c.id, { course: c, score: ident });
  }
  for (const c of termCourses) {
    if (out.has(c.id) || c.term !== term) continue;
    const f = fieldsOf(c);
    let score = 0;
    let ok = true;
    for (const word of tokens) {
      const s = scoreWord(word, f);
      if (s === 0) {
        ok = false;
        break;
      }
      score += s;
    }
    if (!ok) continue;
    if (tokens.length > 1 && f.name === joined) score += 30;
    out.set(c.id, { course: c, score });
  }
  return [...out.values()].sort(compareRanked).map((r) => r.course);
}
