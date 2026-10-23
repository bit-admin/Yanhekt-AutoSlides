/** The Worker's own query rules, so the site asks the way the API expects. */

import { isIdentifierQuery, normalizeQuery } from '../src/api/searchParams';
import { searchWords } from '../src/indexer/grams.ts';

/** A course id, course link or registrar code: looked up in every term, so no term is sent. */
export function isIdentifier(raw: string): boolean {
  const q = normalizeQuery(raw);
  return typeof q === 'string' && isIdentifierQuery(q);
}

/** The words a result was matched on, for bolding in snippets. */
export function queryWords(raw: string): string[] {
  const q = normalizeQuery(raw);
  return typeof q === 'string' ? searchWords(q).filter((w) => [...w].length >= 2) : [];
}
