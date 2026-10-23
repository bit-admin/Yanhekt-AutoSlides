/**
 * Search keys ("grams") for the D1 `course_grams` table. Pure and
 * dependency-free: the indexer writes grams with `courseGrams`, and the share
 * Worker (share/src/api) reads them with `searchWords` / `wordLookup` from
 * share/src/indexer/grams.ts, a byte-identical copy of this file (drift group
 * `indexerGrams`, scripts/check-drift.mjs), so both sides split text the same
 * way. Edit here, then copy the file over.
 *
 * Indexed text: the Chinese course name and the teacher names (the English
 * name is not indexed), plus the registrar code. Text is lowercased and split
 * into words at anything that is not a letter or a digit, and again where CJK
 * meets other scripts (`Java程序设计` → `java`, `程序设计`). Then:
 *   CJK word        → its overlapping 2-character pieces (`程序`, `序设`, `设计`)
 *   other word      → `w:` + the word, matched by prefix (`w:java`); English
 *                     filler words (STOP_WORDS) are skipped
 *   registrar code  → `n:` + cbiz `number` (= Yanhe 2.0 `kcwybm`), matched
 *                     whole: the entire query, trimmed and lowercased
 * A search reads only the grams its words point at, never the whole table.
 * A search word needs fewer pieces than were stored: `wordLookup` picks pieces
 * that cover the word without overlapping (`程序`, `设计`); ranking checks the
 * whole word against the name.
 */

const CJK_CHAR = /[⺀-⿟぀-ヿ㄀-ㄯ㐀-䶿一-鿿가-힯豈-﫿]/u;

export function isCjkWord(word: string): boolean {
  return CJK_CHAR.test(word);
}

/** Lowercased words: split at non-letters/digits, then at CJK ↔ non-CJK boundaries. */
export function splitWords(text: string | null | undefined): string[] {
  if (!text) return [];
  const out: string[] = [];
  for (const chunk of text.toLowerCase().split(/[^\p{L}\p{N}]+/u)) {
    if (!chunk) continue;
    let run = '';
    let runCjk = false;
    for (const ch of chunk) {
      const cjk = CJK_CHAR.test(ch);
      if (run && cjk !== runCjk) {
        out.push(run);
        run = '';
      }
      run += ch;
      runCjk = cjk;
    }
    if (run) out.push(run);
  }
  return out;
}

/**
 * English filler words: in almost every English name, never useful alone. Not
 * indexed; in a search they only filter what the other words found.
 */
export const STOP_WORDS: ReadonlySet<string> = new Set([
  'a', 'an', 'and', 'as', 'at', 'by', 'for', 'from', 'in', 'into', 'of', 'on', 'or', 'the', 'to', 'with',
]);

export function bigrams(word: string): string[] {
  const chars = [...word];
  const out: string[] = [];
  for (let i = 0; i + 1 < chars.length; i++) out.push(chars[i] + chars[i + 1]);
  return out;
}

/** Every gram of one course. `teachers` are names only. */
export function courseGrams(c: { name: string | null; teachers: string[]; number?: string | null }): string[] {
  const grams = new Set<string>();
  for (const text of [c.name, ...c.teachers]) {
    for (const w of splitWords(text)) {
      if (isCjkWord(w)) for (const g of bigrams(w)) grams.add(g);
      else if ([...w].length >= 2 && !STOP_WORDS.has(w)) grams.add(`w:${w}`);
    }
  }
  const number = numberKey(c.number);
  if (number) grams.add(`n:${number}`);
  return [...grams];
}

/**
 * The registrar code as matched: trimmed and lowercased, compared as a whole
 * string. Its formats include dashes and hex (docs/aita-yanhekt.md §4.1), so it
 * is never split into words. Null when too short to be one.
 */
export function numberKey(text: string | null | undefined): string | null {
  const t = text?.trim().toLowerCase() ?? '';
  return t.length >= 8 && !/\s/.test(t) ? t : null;
}

/** At most this many pieces are looked up per CJK word (spread over its cover); ranking verifies the rest. */
export const MAX_BIGRAMS_PER_WORD = 4;

export type WordLookup =
  | { kind: 'bigrams'; grams: string[] }
  | { kind: 'prefix'; word: string }
  | { kind: 'none' };

/** Pieces that cover the word without overlapping; an odd length ends on the last pair. */
function coverBigrams(word: string): string[] {
  const all = bigrams(word);
  if (all.length === 0) return [];
  const picked: string[] = [];
  for (let i = 0; i < all.length; i += 2) picked.push(all[i]);
  if ((all.length - 1) % 2 === 1) picked.push(all[all.length - 1]);
  return [...new Set(picked)];
}

/**
 * How one search word is found in `course_grams`. `none` = too short to look
 * up (one character); such a word only filters what the other words found.
 */
export function wordLookup(word: string): WordLookup {
  if (isCjkWord(word)) {
    const all = coverBigrams(word);
    if (all.length === 0) return { kind: 'none' };
    if (all.length <= MAX_BIGRAMS_PER_WORD) return { kind: 'bigrams', grams: all };
    const picked = new Set<string>();
    for (let i = 0; i < MAX_BIGRAMS_PER_WORD; i++) {
      picked.add(all[Math.round((i * (all.length - 1)) / (MAX_BIGRAMS_PER_WORD - 1))]);
    }
    return { kind: 'bigrams', grams: [...picked] };
  }
  if ([...word].length < 2 || STOP_WORDS.has(word)) return { kind: 'none' };
  return { kind: 'prefix', word };
}

/** The search's words, lowercased and deduplicated, in query order. */
export function searchWords(q: string): string[] {
  return [...new Set(splitWords(q))];
}

/** Smallest string greater than every string starting with `prefix` (for `gram >= p AND gram < end`). */
export function prefixEnd(prefix: string): string {
  const chars = [...prefix];
  const last = chars.pop()!;
  return chars.join('') + String.fromCodePoint(last.codePointAt(0)! + 1);
}
