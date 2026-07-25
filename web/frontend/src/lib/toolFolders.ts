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
  const name = formatToolFolderName(folderName);

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

/**
 * Slide folder names embed a `__c<courseId>[s<sessionId>][l<liveId>]` block,
 * because course titles are not unique. Strip it for display alongside the
 * `slides_` prefix. Local copy — this frontend is a separate deployable and
 * cannot import the app's `@common/lectureNaming`.
 */
const LECTURE_ID_SUFFIX = /__(?:c\d+)?(?:s\d+)?(?:l\d+)?$/;

export function stripLectureIds(name: string): string {
  return name.replace(LECTURE_ID_SUFFIX, '');
}

const numericId = (value: string | number | null | undefined): string | undefined => {
  if (value === null || value === undefined) return undefined;
  const text = String(value).trim();
  return /^\d+$/.test(text) ? text : undefined;
};

/**
 * The id block for a lecture, in this fixed order:
 *   `__c<courseId>[s<sessionId>][l<liveId>]`
 * Recorded → `__c62313s751843`; live → `__c71736l761952`. '' when no usable id.
 *
 * A live id gets its own slot because it identifies one *broadcast*, not the
 * course — writing it as a courseId would make every broadcast of a course look
 * like a different course. Ids must be purely numeric; anything else degrades
 * to the title-only name.
 */
export function buildLectureIdSuffix(
  identity: {
    courseId?: string | number | null;
    sessionId?: string | number | null;
    liveId?: string | number | null;
  },
): string {
  const course = numericId(identity.courseId);
  const live = numericId(identity.liveId);
  // A session id is meaningless without its course.
  const session = course ? numericId(identity.sessionId) : undefined;
  if (!course && !live) return '';
  return `__${course ? `c${course}` : ''}${session ? `s${session}` : ''}${live ? `l${live}` : ''}`;
}

export function formatToolFolderName(name: string): string {
  const stripped = name.startsWith('slides_') ? name.slice(7) : name;
  return stripLectureIds(stripped);
}

export function compareToolImages(a: string, b: string): number {
  return a.localeCompare(b, undefined, {
    numeric: true,
    sensitivity: 'base',
  });
}

/**
 * Split a slides folder name into a card-friendly course title + session
 * detail line (e.g. "第2周 · 星期四 · 第3大节" or "Week 2"). Falls back to the
 * cleaned raw name when the session pattern doesn't parse.
 */
export function parseFolderDisplayName(name?: string): { course: string; details: string } {
  if (!name) return { course: '', details: '' };
  const parsed = parseSessionInfo(name);
  if (!parsed) {
    return { course: formatToolFolderName(name).replace(/_/g, ' '), details: '' };
  }

  const isChinese = name.includes('第') && name.includes('周');
  if (isChinese) {
    const weekMatch = name.match(/第(\d+)周/);
    const dayMatch = name.match(/星期([一二三四五六日])/);
    const periodMatch = name.match(/第(\d+)大节/);

    const parts = [];
    if (weekMatch) parts.push(weekMatch[0]);
    if (dayMatch) parts.push(dayMatch[0]);
    if (periodMatch) parts.push(periodMatch[0]);

    return { course: parsed.courseName, details: parts.join(' · ') };
  }

  if (name.includes(' - Lecture ')) {
    const lectureMatch = name.match(/Lecture (\d+)/);
    return {
      course: parsed.courseName,
      details: lectureMatch ? lectureMatch[0] : `Lecture ${parsed.week}`,
    };
  }

  return { course: parsed.courseName, details: `Week ${parsed.week}` };
}

// A bare session title, in the API's spaced form or the sanitized underscore form.
const BARE_SESSION_PATTERN = /^第(\d+)周[_\s]星期([一二三四五六日])[_\s]第(\d+)大节$/;

/**
 * Parse a standalone session title. Live rows carry no week/day of their own,
 * but their `section_group_title` encodes both in the same format recorded
 * sessions use, so live folders can record the same fields.
 */
export function parseSessionTitle(
  title?: string | null,
): { weekNumber: number; day: number; section: number } | null {
  const match = title?.trim().match(BARE_SESSION_PATTERN);
  if (!match) return null;
  return {
    weekNumber: parseInt(match[1], 10),
    day: WEEKDAY_ORDER[match[2]] || 0,
    section: parseInt(match[3], 10),
  };
}
