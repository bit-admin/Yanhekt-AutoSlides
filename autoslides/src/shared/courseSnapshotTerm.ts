/**
 * Temporary: course snapshot term keys, shared by main and the renderer.
 * `2023-2024-1` is the 2023-2024 school year, autumn; `-2` is spring.
 */

const TERM_KEY = /^(\d{4})-(\d{4})-([12])$/;

export interface TermKeyParts {
  /** The year the school year starts in. */
  schoolYear: number;
  /** 1 autumn, 2 spring. */
  semester: 1 | 2;
}

/** The parts of a term key, or null when it is not one (the years must follow each other). */
export function parseTermKey(term: string): TermKeyParts | null {
  const m = TERM_KEY.exec(term);
  if (!m || Number(m[2]) !== Number(m[1]) + 1) return null;
  return { schoolYear: Number(m[1]), semester: m[3] === '1' ? 1 : 2 };
}

export function isTermKey(term: string): boolean {
  return parseTermKey(term) !== null;
}

export function termKeyOf(schoolYear: number, semester: number): string {
  return `${schoolYear}-${schoolYear + 1}-${semester}`;
}

/** Valid, distinct term keys, newest first. */
export function normalizeTermKeys(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const keys = value.filter((v): v is string => typeof v === 'string' && isTermKey(v));
  return [...new Set(keys)].sort().reverse();
}
