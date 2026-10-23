/**
 * `GET /api/search` parameters: parse, validate, and build the canonical cache
 * key. Pure; see docs/api.md for the contract.
 */

import { numberKey, searchWords, wordLookup } from '../indexer/grams.ts';

export interface SearchParams {
  /** Normalized query: trimmed, inner whitespace collapsed. */
  q: string;
  /** Lowercased words of `q` (split as the indexer splits text); every one must match. */
  tokens: string[];
  /**
   * The one term searched, e.g. `2026-2027-1`. Null only when `q` is an
   * identifier (see `isIdentifierQuery`); then only identifiers are looked up.
   */
  term: string | null;
}

export interface ParamError {
  error: string;
  message: string;
  param: string;
}

export const MIN_QUERY_CHARS = 2;
export const MAX_QUERY_CHARS = 64;
export const MAX_TOKENS = 6;

/** Our term key: academic year + semester number (indexer/src/d1model.ts `termKey`). */
export const TERM_KEY = /^\d{4}-\d{4}-[1-9]$/;

/** Yanhekt links name the thing to find: `…/course/123`, `…/session/456`. */
const YANHEKT_LINK = /yanhekt\.cn\/(?:#\/)?(course|session)\/(\d+)/i;

function bad(param: string, error: string, message: string): ParamError {
  return { error, message, param };
}

/** `a,b` and repeated `?x=a&x=b` both work; empty items and repeats are dropped. */
function list(params: URLSearchParams, name: string): string[] {
  const out: string[] = [];
  for (const raw of params.getAll(name)) {
    for (const item of raw.split(',')) {
      const v = item.trim();
      if (v && !out.includes(v)) out.push(v);
    }
  }
  return out;
}

/**
 * A query that can name one course by itself, in any term: a course id, or
 * something shaped like a registrar code (8+ characters, no spaces, a digit).
 */
export function isIdentifierQuery(q: string): boolean {
  return /^\d{1,9}$/.test(q) || (numberKey(q) !== null && /\d/.test(q));
}

/** A pasted course link becomes its id; a session link is refused (sessions are not in the index). */
export function normalizeQuery(raw: string): string | ParamError {
  const link = YANHEKT_LINK.exec(raw);
  if (link?.[1].toLowerCase() === 'session') {
    return bad('q', 'bad-param', 'session links cannot be searched; paste the course link or search the course name');
  }
  if (link) return link[2];
  // No NFKC: it would turn a query's `Ⅰ` into `I` while stored names keep `Ⅰ`.
  return raw.trim().replace(/\s+/g, ' ');
}

export function parseSearchParams(params: URLSearchParams): SearchParams | ParamError {
  const q = normalizeQuery(params.get('q') ?? '');
  if (typeof q !== 'string') return q;
  if (q === '') return bad('q', 'query-required', 'q is required; empty searches are not supported');
  const chars = [...q].length;
  if (chars < MIN_QUERY_CHARS) return bad('q', 'query-too-short', `q needs at least ${MIN_QUERY_CHARS} characters`);
  if (chars > MAX_QUERY_CHARS) return bad('q', 'query-too-long', `q may have at most ${MAX_QUERY_CHARS} characters`);
  const tokens = searchWords(q);
  if (tokens.length > MAX_TOKENS) return bad('q', 'query-too-long', `q may have at most ${MAX_TOKENS} words`);
  if (!tokens.some((t) => wordLookup(t).kind !== 'none')) {
    return bad('q', 'query-too-short', 'q needs at least one word of 2 or more characters');
  }

  const terms = list(params, 'term');
  if (terms.length === 0) {
    if (isIdentifierQuery(q)) return { q, tokens, term: null };
    return bad('term', 'term-required', 'term is required (e.g. term=2026-2027-1) unless q is a course id or registrar code');
  }
  if (terms.length > 1) return bad('term', 'bad-param', 'search one term at a time');
  if (!TERM_KEY.test(terms[0])) return bad('term', 'bad-param', `term must look like 2026-2027-1 (got ${terms[0]})`);

  return { q, tokens, term: terms[0] };
}

export function isParamError(v: unknown): v is ParamError {
  return typeof v === 'object' && v !== null && 'error' in v;
}

/**
 * One URL per distinct search and data version, so equivalent requests share
 * a cache entry and an upload starts fresh entries.
 */
export function cacheKey(origin: string, p: SearchParams, version: string): string {
  const qs = new URLSearchParams();
  qs.set('q', p.q);
  if (p.term) qs.set('term', p.term);
  qs.set('v', version);
  return `${origin}/api/search?${qs}`;
}
