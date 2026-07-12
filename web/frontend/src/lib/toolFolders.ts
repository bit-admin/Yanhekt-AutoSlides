// Ported from autoslides/src/renderer/shared/utils/toolWindowFolders.ts —
// folder/image naming helpers for the Slides page (course-grouping helpers
// dropped; the web Slides page has no group-by-course view).

// Chinese weekday mapping for sorting (Monday = 1, Sunday = 7)
const WEEKDAY_ORDER: Record<string, number> = {
  '一': 1,
  '二': 2,
  '三': 3,
  '四': 4,
  '五': 5,
  '六': 6,
  '日': 7,
};

interface ParsedSessionInfo {
  courseName: string;
  week: number;
  weekday: number;
  session: number;
}

/**
 * Parse session info from folder name.
 * Primary pattern (BIT downloads): slides_<courseName>_第N周_星期X_第N大节
 * English fallback (English-named courses): "<courseName> - Lecture N"
 * Note: courseName may contain underscores.
 */
export function parseSessionInfo(folderName: string): ParsedSessionInfo | null {
  const name = folderName.startsWith('slides_') ? folderName.slice(7) : folderName;

  const sessionPattern = /^(.+)_第(\d+)周_星期([一二三四五六日])_第(\d+)大节$/;
  const match = name.match(sessionPattern);
  if (match) {
    return {
      courseName: match[1],
      week: parseInt(match[2], 10),
      weekday: WEEKDAY_ORDER[match[3]] || 0,
      session: parseInt(match[4], 10),
    };
  }

  // English session form: groups by course and orders by lecture number.
  const englishPattern = /^(.+) - Lecture (\d+)$/;
  const englishMatch = name.match(englishPattern);
  if (englishMatch) {
    const lecture = parseInt(englishMatch[2], 10);
    return { courseName: englishMatch[1], week: lecture, weekday: 0, session: lecture };
  }

  return null;
}

/**
 * Compare two folder names with Chinese natural sorting.
 */
export function compareToolFolders(a: string, b: string): number {
  const infoA = parseSessionInfo(a);
  const infoB = parseSessionInfo(b);

  if (infoA && infoB) {
    const courseCompare = infoA.courseName.localeCompare(infoB.courseName, 'zh');
    if (courseCompare !== 0) return courseCompare;
    if (infoA.week !== infoB.week) return infoA.week - infoB.week;
    if (infoA.weekday !== infoB.weekday) return infoA.weekday - infoB.weekday;
    return infoA.session - infoB.session;
  }

  if (infoA && !infoB) return -1;
  if (!infoA && infoB) return 1;

  return a.localeCompare(b, 'zh');
}

export function formatToolFolderName(name: string): string {
  return name.startsWith('slides_') ? name.slice(7) : name;
}

export function compareToolImages(a: string, b: string): number {
  return a.localeCompare(b, undefined, {
    numeric: true,
    sensitivity: 'base',
  });
}
