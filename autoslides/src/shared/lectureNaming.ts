// Canonical naming for lecture-derived folders and files, shared by BOTH
// processes. Before this module the same template was hand-written in five
// places and the session-suffix regex existed in three copies; they had already
// drifted (only one copy gated the `section_group_title` fallback on live mode).
//
// ── The collision this exists to prevent ──────────────────────────────────────
// Names used to be built from titles alone (`slides_<course>_<session>`), but a
// course title is not unique: re-offered courses and parallel sections produce
// byte-identical names. Slide extraction is `mkdir -p`, so a second course's
// slides silently merged into the first course's folder, and a colliding `.mp4`
// overwrote the earlier download. Names now carry the course/session ids.
//
// ── Why `__` is a safe delimiter ──────────────────────────────────────────────
// Every sanitizer collapses `_{2,}` into a single `_` (see sanitizeFileName and
// sanitizeDownloadName), and name parts are joined with a single `_`. A
// sanitized title therefore CANNOT contain `__`, which makes the id block
// unforgeable — provided it is appended AFTER sanitization. Never run a name
// that already carries the suffix back through a sanitizer.
import { sanitizeFileName } from './sanitizeFileName';

export const SLIDE_FOLDER_PREFIX = 'slides_';

/**
 * Lecture identity as it arrives from the API (string or number).
 *
 * `liveId` is deliberately separate from `courseId`: a live stream's `id` is one
 * *broadcast*, not the course. The real course id is on the live row too
 * (`session.course_id` — present on 63/63 sampled streams, unlike the partial
 * `course` object at 14/63), so a live folder carries BOTH: the course id so
 * broadcasts of one course group together, and the broadcast id so repeat
 * broadcasts stay distinct folders. Writing a broadcast id into `courseId`
 * would make every broadcast look like its own course — wrong for grouping and
 * wrong for the AutoSlides Index, which keys on `courseId`/`sessionId`.
 */
export interface LectureIdentity {
  courseId?: string | number | null;
  sessionId?: string | number | null;
  liveId?: string | number | null;
}

// All ids are digits, which is what makes the letter tags unambiguous
// separators. Grammar, in this fixed order:
//   `__c<courseId>[s<sessionId>][l<liveId>]`
// recorded → `__c62313s751843`; live → `__c71736l761952`; live with no
// resolvable course → `__l761952`.
const ID_SUFFIX_PATTERN = /__(?:c(\d+))?(?:s(\d+))?(?:l(\d+))?$/;

/**
 * Coerce an id to its canonical string form, or undefined when it is absent or
 * not purely numeric. Yanhekt delivers these inconsistently (a JSON number for
 * `courseId`, a string for `sessionId`), and live streams fall back to
 * `stream.live_id`; anything non-numeric simply yields no suffix, degrading to
 * the pre-existing title-only behaviour rather than emitting an unparseable id.
 */
function normalizeId(value: string | number | null | undefined): string | undefined {
  if (value === null || value === undefined) return undefined;
  const text = String(value).trim();
  return /^\d+$/.test(text) ? text : undefined;
}

/**
 * The id block: `__c<courseId>[s<sessionId>]` for a recorded lecture, or
 * `__l<liveId>` for a live broadcast. '' when no usable id exists.
 *
 * A session id alone is not enough to identify a lecture, so it is only emitted
 * alongside a course id. A course id wins over a live id if somehow both are
 * present — in practice they are mutually exclusive.
 */
export function buildLectureIdSuffix(identity: LectureIdentity): string {
  const courseId = normalizeId(identity.courseId);
  const liveId = normalizeId(identity.liveId);
  // A session id is meaningless without its course, so it is only emitted
  // alongside one.
  const sessionId = courseId ? normalizeId(identity.sessionId) : undefined;

  if (!courseId && !liveId) return '';

  return [
    '__',
    courseId ? `c${courseId}` : '',
    sessionId ? `s${sessionId}` : '',
    liveId ? `l${liveId}` : '',
  ].join('');
}

/**
 * Identity read back out of a name. Narrower than `LectureIdentity`: parsing
 * always yields strings, never the numbers the API can hand us on the way in.
 */
export interface ParsedLectureIds {
  courseId?: string;
  sessionId?: string;
  liveId?: string;
}

/** Recover the ids embedded in a folder/file name. Empty for legacy names. */
export function parseLectureIds(name: string): ParsedLectureIds {
  const match = name.match(ID_SUFFIX_PATTERN);
  // Every group is optional, so a bare `__` would technically match — guard so
  // that only a suffix carrying at least one id counts.
  if (!match || (!match[1] && !match[2] && !match[3])) return {};
  return { courseId: match[1], sessionId: match[2], liveId: match[3] };
}

/**
 * Drop the id block. Every user-facing surface renders through this — the ids
 * are an on-disk identity mechanism, never something a person should read.
 */
export function stripLectureIds(name: string): string {
  return name.replace(ID_SUFFIX_PATTERN, '');
}

/** Strip the `slides_` prefix and the id block, leaving the display name. */
export function formatLectureDisplayName(name: string): string {
  const stripped = name.startsWith(SLIDE_FOLDER_PREFIX)
    ? name.slice(SLIDE_FOLDER_PREFIX.length)
    : name;
  return stripLectureIds(stripped);
}

export interface LectureNameParts {
  courseTitle?: string | null;
  sessionTitle?: string | null;
  /** Live-only fallback (`course.session.section_group_title`) when there is no session. */
  sectionGroupTitle?: string | null;
}

/**
 * The sanitized `<course>_<session>` stem, without prefix or id block. Parts
 * that are missing are skipped, so a bare live stream can yield ''.
 */
export function buildLectureStem(parts: LectureNameParts): string {
  const segments: string[] = [];
  if (parts.courseTitle) segments.push(sanitizeFileName(parts.courseTitle));
  if (parts.sessionTitle) segments.push(sanitizeFileName(parts.sessionTitle));
  else if (parts.sectionGroupTitle) segments.push(sanitizeFileName(parts.sectionGroupTitle));
  return segments.filter(Boolean).join('_');
}

/**
 * Human-readable `<course>_<session>` label, joined but NOT sanitized. Used for
 * queue display names and as the logical `DownloadItem.name`, which is sanitized
 * exactly once later by `buildDownloadFileName` — sanitizing here too would
 * apply the wrong rules (sanitizeFileName drops path separators where
 * sanitizeDownloadName replaces them with `_`) and change the .mp4 filename.
 * Missing parts are skipped rather than interpolated as "undefined".
 */
export function lectureLabel(...titles: (string | null | undefined)[]): string {
  return titles.filter((title): title is string => !!title).join('_');
}

/**
 * Full slide folder name: `slides[_<stem>][__c<id>s<id>]`. The id block goes on
 * last, after all sanitization.
 */
export function buildSlideFolderName(parts: LectureNameParts, identity: LectureIdentity = {}): string {
  const stem = buildLectureStem(parts);
  const base = stem ? `${SLIDE_FOLDER_PREFIX}${stem}` : 'slides';
  return `${base}${buildLectureIdSuffix(identity)}`;
}

// ── Session-suffix parsing ───────────────────────────────────────────────────
// Display-only: recovers course/week/weekday/period from a name for grouping,
// sorting and PDF covers. This is the fallback path for folders created before
// ids were embedded (<= v4.4.1); id-bearing names should prefer parseLectureIds.

/** Chinese weekday → ISO-ish ordinal (Monday = 1, Sunday = 7). */
const WEEKDAY_ORDER: Record<string, number> = {
  '一': 1, '二': 2, '三': 3, '四': 4, '五': 5, '六': 6, '日': 7,
};

export const SESSION_SUFFIX_PATTERN = /_第\d+周_星期[一二三四五六日]_第\d+大节$/;

const SESSION_FULL_PATTERN = /^(.+)_第(\d+)周_星期([一二三四五六日])_第(\d+)大节$/;
const SESSION_CAPTURE_PATTERN = /_(第\d+周_星期[一二三四五六日]_第\d+大节)$/;
const LECTURE_PATTERN = /^(.+) - Lecture (\d+)$/;

export interface ParsedSessionInfo {
  courseName: string;
  week: number;
  weekday: number;
  session: number;
}

/**
 * Parse session info from a folder name.
 * Primary pattern (BIT downloads): slides_<courseName>_第N周_星期X_第N大节
 * English fallback (English-named courses, incl. demo mode): "<courseName> - Lecture N"
 * Note: courseName may contain underscores. Any id block is stripped first, so
 * the `$`-anchored patterns keep matching id-bearing names.
 */
export function parseSessionInfo(folderName: string): ParsedSessionInfo | null {
  const name = formatLectureDisplayName(folderName);

  const match = name.match(SESSION_FULL_PATTERN);
  if (match) {
    return {
      courseName: match[1],
      week: parseInt(match[2], 10),
      weekday: WEEKDAY_ORDER[match[3]] || 0,
      session: parseInt(match[4], 10),
    };
  }

  // English session form: groups by course and orders by lecture number.
  const englishMatch = name.match(LECTURE_PATTERN);
  if (englishMatch) {
    const lecture = parseInt(englishMatch[2], 10);
    return { courseName: englishMatch[1], week: lecture, weekday: 0, session: lecture };
  }

  return null;
}

// A bare session title, in either the API's spaced form ("第21周 星期日 第2大节")
// or the sanitized underscore form used in folder names.
const BARE_SESSION_PATTERN = /^第(\d+)周[_\s]星期([一二三四五六日])[_\s]第(\d+)大节$/;

export interface ParsedSessionTitle {
  weekNumber: number;
  /** Monday = 1 … Sunday = 7, matching the recorded API's `day`. */
  day: number;
  section: number;
}

/**
 * Parse a standalone session title — as opposed to `parseSessionInfo`, which
 * expects a whole folder name with the course prefixed.
 *
 * Live rows carry no `week_number`/`day` of their own, but their
 * `section_group_title` encodes both in exactly the format recorded sessions
 * use, so live folders can record the same fields as recorded ones.
 */
export function parseSessionTitle(title: string | null | undefined): ParsedSessionTitle | null {
  const match = title?.trim().match(BARE_SESSION_PATTERN);
  if (!match) return null;
  return {
    weekNumber: parseInt(match[1], 10),
    day: WEEKDAY_ORDER[match[2]] || 0,
    section: parseInt(match[3], 10),
  };
}

/** Course name with the session suffix removed (used for PDF covers). */
export function extractCourseName(folderName: string): string {
  return formatLectureDisplayName(folderName).replace(SESSION_SUFFIX_PATTERN, '');
}

/**
 * The session segment with underscores turned back into spaces, or undefined
 * when the name has no session suffix.
 */
export function extractSessionLabel(folderName: string): string | undefined {
  const match = formatLectureDisplayName(folderName).match(SESSION_CAPTURE_PATTERN);
  return match ? match[1].replace(/_/g, ' ') : undefined;
}
