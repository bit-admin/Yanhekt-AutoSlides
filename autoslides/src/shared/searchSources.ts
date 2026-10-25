/**
 * Where course searches and course lookups get their answers
 * (Settings → General → Search). Shared by main, the renderer and the CLI.
 *
 * Current term: one source, no fallback. Yanhekt answers loosely related
 * courses for most keywords, so "no match" cannot be told from a poor answer.
 *   yanhekt  Yanhekt's own course search (default)
 *   local    the course index on this computer (needs the downloaded current term)
 *   online   the AutoSlides Index (share.ruc.edu.kg)
 *
 * Earlier terms, a course's session ids when Yanhekt's lists are empty, and
 * course lookups by id or registrar code:
 *   local-then-online  the course index on this computer, then the AutoSlides
 *                      Index (default). A keyword search uses the local copy
 *                      when it holds the term, else the online Index; an exact
 *                      lookup (session ids, an id, a code) asks online when the
 *                      local copy has no answer, since it may be stale.
 *   online             the AutoSlides Index only
 */

export type CurrentTermSearchSource = 'yanhekt' | 'local' | 'online';
export type EarlierTermSearchSource = 'local-then-online' | 'online';

export const CURRENT_TERM_SEARCH_SOURCES: readonly CurrentTermSearchSource[] = ['yanhekt', 'local', 'online'];
export const EARLIER_TERM_SEARCH_SOURCES: readonly EarlierTermSearchSource[] = ['local-then-online', 'online'];

export const DEFAULT_CURRENT_TERM_SEARCH_SOURCE: CurrentTermSearchSource = 'yanhekt';
export const DEFAULT_EARLIER_TERM_SEARCH_SOURCE: EarlierTermSearchSource = 'local-then-online';

export function normalizeCurrentTermSearchSource(value: unknown): CurrentTermSearchSource {
  return CURRENT_TERM_SEARCH_SOURCES.includes(value as CurrentTermSearchSource)
    ? (value as CurrentTermSearchSource)
    : DEFAULT_CURRENT_TERM_SEARCH_SOURCE;
}

export function normalizeEarlierTermSearchSource(value: unknown): EarlierTermSearchSource {
  return EARLIER_TERM_SEARCH_SOURCES.includes(value as EarlierTermSearchSource)
    ? (value as EarlierTermSearchSource)
    : DEFAULT_EARLIER_TERM_SEARCH_SOURCE;
}

/** `2026-2027-1`: school year + semester (1 autumn, 2 spring), the index's term key. */
export const TERM_KEY_PATTERN = /^(\d{4})-(\d{4})-([12])$/;

export function termKeyOf(schoolYear: number | string, semester: number | string): string | null {
  const year = Number(String(schoolYear).slice(0, 4));
  const sem = Number(semester);
  if (!Number.isInteger(year) || year < 2000 || (sem !== 1 && sem !== 2)) return null;
  return `${year}-${year + 1}-${sem}`;
}

/** The oldest term the index and the term pickers go back to. */
export const FIRST_INDEX_TERM = '2023-2024-1';

/** `current` and every earlier term back to {@link FIRST_INDEX_TERM}, newest first. */
export function termsBackFrom(current: string): string[] {
  const m = TERM_KEY_PATTERN.exec(current);
  if (!m) return [];
  const out: string[] = [];
  let year = Number(m[1]);
  let sem = Number(m[3]);
  for (;;) {
    const key = `${year}-${year + 1}-${sem}`;
    if (key < FIRST_INDEX_TERM) break;
    out.push(key);
    if (sem === 2) sem = 1;
    else {
      year -= 1;
      sem = 2;
    }
  }
  return out;
}
