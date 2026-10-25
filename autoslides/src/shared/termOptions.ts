/**
 * The terms a term picker offers: the current one (Yanhekt's default term tag)
 * and every earlier term back to {@link FIRST_INDEX_TERM}, newest first. Used by
 * the Search page and the CLI's `--term`.
 *
 * Earlier terms have no Yanhekt tag id (Yanhekt only names the current one),
 * so they get a negative id, `-(schoolYear * 10 + semester)`. A positive id is
 * the current term's Yanhekt tag id.
 */
import type { SemesterOption } from './apiTypes';
import { FIRST_INDEX_TERM } from './searchSources';

export function isEarlierTermOption(id: number): boolean {
  return id < 0;
}

/** A picker entry for an earlier term (negative id). */
export function earlierTermOption(schoolYear: number, semester: number): SemesterOption {
  return {
    id: -(schoolYear * 10 + semester),
    label: `${schoolYear}-${schoolYear + 1} ${semester === 1 ? '第一学期' : '第二学期'}`,
    labelEn: semester === 1 ? `${schoolYear} Fall` : `${schoolYear + 1} Spring`,
    schoolYear,
    semester,
  };
}

/** `2025-2026-1`: the index's key for a picker term. */
export function termKeyOfOption(option: SemesterOption): string {
  return `${option.schoolYear}-${option.schoolYear + 1}-${option.semester}`;
}

/** The current term, then every earlier term back to the first indexed one, newest first. */
export function termOptionsBackFrom(current: SemesterOption): SemesterOption[] {
  const out = [current];
  let { schoolYear, semester } = current;
  if (!schoolYear) return out;
  for (;;) {
    if (semester === 2) semester = 1;
    else {
      schoolYear -= 1;
      semester = 2;
    }
    if (`${schoolYear}-${schoolYear + 1}-${semester}` < FIRST_INDEX_TERM) break;
    out.push(earlierTermOption(schoolYear, semester));
  }
  return out;
}
