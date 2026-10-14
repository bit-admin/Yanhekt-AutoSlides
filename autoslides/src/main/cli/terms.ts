// Term names for `--term`. Pure, so it is unit-tested.
//
// Yanhekt filters by a tag id (`semesters[]`); people know a term as
// `2025-2026-1`, `2025-2026 第一学期` or `2025 Fall`. All of those, and the tag
// id itself, are accepted.
import type { SemesterOption } from '@common/apiTypes';

/** `2025-2026-1` from a list row's `school_year` (`2025-2026`) and `semester` (`1`). */
export function termKey(schoolYear: string | number | undefined, semester: string | number | undefined): string {
  if (schoolYear === undefined || schoolYear === '' || semester === undefined || semester === '') return '';
  const year = String(schoolYear);
  const span = /^\d{4}$/.test(year) ? `${year}-${Number(year) + 1}` : year;
  return `${span}-${semester}`;
}

export function semesterTermKey(option: SemesterOption): string {
  return termKey(option.schoolYear, option.semester);
}

export function matchTerm(input: string, options: readonly SemesterOption[]): SemesterOption | null {
  const query = input.trim().toLowerCase().replace(/\s+/g, ' ');
  return (
    options.find(
      (o) =>
        String(o.id) === query ||
        semesterTermKey(o) === query ||
        o.label.toLowerCase().replace(/\s+/g, ' ') === query ||
        o.labelEn.toLowerCase() === query
    ) ?? null
  );
}
