export interface ParsedTitle {
  course: string;
  session: string;
}

/**
 * Split a managed-note display name into a course title and a human-readable
 * session line. Mirrors the folder-naming scheme used by AutoSlides:
 *   - Chinese: "<course>_第N周_星期X_第N大节"
 *   - English: "<course> - Lecture N"
 * Falls back to the raw name (underscores → spaces) when no pattern matches.
 */
export function parseTitle(raw: string): ParsedTitle {
  const zh = raw.match(/^(.+)_第(\d+)周_星期([一二三四五六日])_第(\d+)大节$/);
  if (zh) {
    return { course: zh[1], session: `第${zh[2]}周 · 星期${zh[3]} · 第${zh[4]}大节` };
  }

  const en = raw.match(/^(.+) - Lecture (\d+)$/);
  if (en) {
    return { course: en[1], session: `Lecture ${en[2]}` };
  }

  return { course: raw.replace(/_/g, ' '), session: '' };
}
