/**
 * Academic term as shown on the session page and share viewer:
 *   "2025-2026 Fall"   (semester 1)
 *   "2025-2026 Spring" (semester 2)
 * Yanhekt stores semester as 1/2 (sometimes a string).
 */
export function formatAcademicTerm(
  schoolYear?: string | number | null,
  semester?: string | number | null,
): string {
  const year = schoolYear == null ? '' : String(schoolYear).trim();
  const n = semester == null || semester === '' ? NaN : Number(semester);
  const season = n === 1 ? 'Fall' : n === 2 ? 'Spring' : '';
  return [year, season].filter(Boolean).join(' ');
}
