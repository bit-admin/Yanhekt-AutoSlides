import { describe, it, expect } from 'vitest';
import { formatAcademicTerm } from './academicTerm';

describe('formatAcademicTerm', () => {
  it('formats Fall / Spring from Yanhekt 1/2', () => {
    expect(formatAcademicTerm('2025-2026', 1)).toBe('2025-2026 Fall');
    expect(formatAcademicTerm('2025-2026', '2')).toBe('2025-2026 Spring');
  });

  it('degrades when a part is missing', () => {
    expect(formatAcademicTerm('2025-2026', null)).toBe('2025-2026');
    expect(formatAcademicTerm(undefined, 1)).toBe('Fall');
    expect(formatAcademicTerm(undefined, undefined)).toBe('');
  });
});
