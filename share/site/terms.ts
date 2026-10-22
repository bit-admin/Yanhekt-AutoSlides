/** The term in session on `date` (Beijing calendar, roughly): autumn from August, spring from February. */
export function termForDate(date = new Date()): string {
  const y = date.getFullYear();
  const m = date.getMonth() + 1;
  if (m >= 8) return `${y}-${y + 1}-1`;
  if (m === 1) return `${y - 1}-${y}-1`;
  return `${y - 1}-${y}-2`;
}

/** The term to search by default: the current one if the index has it, else the newest. */
export function defaultTerm(list: string[]): string {
  const now = termForDate();
  return list.includes(now) ? now : (list[0] ?? now);
}
