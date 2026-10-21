/**
 * The fabricated world behind `/demo/`.
 *
 * The cast is deliberately the same as the desktop demo
 * (`autoslides/src/renderer/demo/demoData.ts`) and the web demo
 * (`web/frontend/src/demo/demoData.ts`) — Kate, Dr. Helena Whitcombe,
 * Functional Analysis #501 — so all three READMEs tell one story end to end.
 *
 * Content is English even though the guide is Chinese: docs screenshots are
 * English by house convention, and this site's chrome is English anyway.
 *
 * Ids follow the real conventions: a session id is the course id followed by a
 * zero-padded week (`50109`), and a share fragment is built with the REAL codec
 * (`autoslides/src/shared/shareLink`), as a v3 payload carrying a timeline, so
 * the viewer's `Download timeline` button is genuinely live.
 */

import {
  encodeSharePayload,
  type SharePayload,
} from '../../autoslides/src/shared/shareLink';

export interface DemoLecture {
  courseId: string;
  sessionId: string;
  courseTitle: string;
  sessionTitle: string;
  instructor: string;
  professors: string[];
  college: string;
  /** Strings on this API — `semesterRank`/`schoolYearRank` parse them. */
  semester: string;
  schoolYear: string;
  weekNumber: number;
  day: number;
  versionCount: number;
  updatedAt: string;
}

export interface DemoVersion {
  shareId: string;
  imageCount: number;
  reviewed: boolean;
  edited: boolean;
  hasTimeline: boolean;
  createdAt: string;
}

const MATH = 'School of Mathematical Sciences';
const CS = 'School of Computer Science and Technology';

interface CourseSpec {
  id: string;
  title: string;
  instructor: string;
  college: string;
  /** week → [weekday (1=Mon), lecture topic]. */
  sessions: Array<[week: number, day: number, topic: string]>;
  schoolYear: string;
  semester: string;
}

const COURSES: CourseSpec[] = [
  {
    id: '501',
    college: MATH,
    title: 'Functional Analysis',
    instructor: 'Dr. Helena Whitcombe',
    schoolYear: '2025-2026',
    semester: '1',
    sessions: [
      [9, 3, 'Compact Operators'],
      [10, 3, 'The Spectral Theorem'],
      [11, 3, 'The Fredholm Alternative'],
      [12, 3, 'Unbounded Operators'],
    ],
  },
  {
    id: '410',
    college: MATH,
    title: 'Complex Analysis',
    instructor: 'Dr. Sofia Renault',
    schoolYear: '2025-2026',
    semester: '1',
    sessions: [
      [8, 2, 'Conformal Mappings'],
      [9, 2, 'The Residue Theorem'],
    ],
  },
  {
    id: '401',
    college: MATH,
    title: 'Real Analysis',
    instructor: 'Dr. Marcus Lindqvist',
    schoolYear: '2025-2026',
    semester: '1',
    sessions: [
      [10, 1, 'Sequences of Functions'],
      [11, 1, 'Uniform Convergence'],
    ],
  },
  {
    id: '402',
    college: MATH,
    title: 'Abstract Algebra',
    instructor: 'Dr. Priya Narayan',
    schoolYear: '2025-2026',
    semester: '1',
    sessions: [[6, 4, 'Sylow’s Theorems']],
  },
  {
    id: '480',
    college: CS,
    title: 'Numerical Analysis',
    instructor: 'Dr. Tobias Ferreira',
    schoolYear: '2025-2026',
    semester: '1',
    sessions: [
      [7, 5, 'Iterative Methods'],
      [8, 5, 'Numerical Stability'],
    ],
  },
  {
    id: '505',
    college: MATH,
    title: 'Point-Set Topology',
    instructor: 'Dr. Helena Whitcombe',
    schoolYear: '2024-2025',
    semester: '2',
    sessions: [
      [5, 2, 'Compactness'],
      [7, 2, 'Connectedness'],
    ],
  },
];

export function demoSessionId(courseId: string, week: number): string {
  return `${courseId}${String(week).padStart(2, '0')}`;
}

/**
 * Fixed timestamps, `offset` days after a fixed epoch. Dates are baked rather
 * than computed from `Date.now()` because the screenshot run freezes the clock
 * and every rendered date must be stable across machines and runs.
 */
const EPOCH = Date.UTC(2026, 7, 18); // 2026-08-18

function stamp(offset: number, hour: number): string {
  return new Date(EPOCH + offset * 86_400_000 + hour * 3_600_000).toISOString();
}

export const LECTURES: DemoLecture[] = COURSES.flatMap((course, ci) =>
  course.sessions.map(([week, day, topic], si): DemoLecture => ({
    courseId: course.id,
    sessionId: demoSessionId(course.id, week),
    courseTitle: course.title,
    sessionTitle: `Lecture ${week}: ${topic}`,
    instructor: course.instructor,
    professors: [course.instructor],
    college: course.college,
    semester: course.semester,
    schoolYear: course.schoolYear,
    weekNumber: week,
    day,
    // Two of Functional Analysis' lectures carry a second, later upload.
    versionCount: course.id === '501' && week <= 10 ? 2 : 1,
    updatedAt: stamp(ci * 2 + si, 9 + si),
  })),
);

function lectureAt(courseId: string, sessionId: string): DemoLecture | undefined {
  return LECTURES.find((l) => l.courseId === courseId && l.sessionId === sessionId);
}

// ------------------------------------------------------------------ files ---

/** Deterministic 32-bit FNV-1a, rendered as hex — stands in for an md5 prefix. */
function hashHex(seed: string, length: number): string {
  let h = 0x811c9dc5;
  let out = '';
  while (out.length < length) {
    for (let i = 0; i < seed.length; i += 1) {
      h ^= seed.charCodeAt(i);
      h = Math.imul(h, 0x01000193) >>> 0;
    }
    out += h.toString(16).padStart(8, '0');
    seed += '.';
  }
  return out.slice(0, length);
}

const SHORT_HASH_LEN = 7;

export interface DemoFile extends DemoVersion {
  courseId: string;
  sessionId: string;
}

/** Every indexed file, newest first. */
export const FILES: DemoFile[] = LECTURES.flatMap((lecture, li) =>
  Array.from({ length: lecture.versionCount }, (_, vi): DemoFile => ({
    shareId: `demo-${lecture.courseId}-w${lecture.weekNumber}-v${vi + 1}`,
    courseId: lecture.courseId,
    sessionId: lecture.sessionId,
    imageCount: 5 + ((li + vi) % 4),
    // The second upload of a lecture is the human-corrected one.
    reviewed: vi > 0 || li % 3 !== 2,
    edited: vi > 0,
    hasTimeline: li % 4 !== 3,
    createdAt: stamp(li + vi, 11 + vi),
  })),
).sort((a, b) => b.createdAt.localeCompare(a.createdAt));

/** The share payload a file's link carries — a real v3 payload, real codec. */
export function payloadFor(shareId: string): SharePayload | null {
  const file = FILES.find((f) => f.shareId === shareId);
  if (!file) return null;
  const h = Array.from({ length: file.imageCount }, (_, i) =>
    hashHex(`${shareId}:${i}`, SHORT_HASH_LEN),
  ).join('');
  // One cue per slide, a couple of minutes apart, so the timeline is plausible.
  const t = file.hasTimeline
    ? Array.from({ length: file.imageCount }, (_, i) => `${i}:${i === 0 ? 184 : 137 + (i % 3) * 46}`).join(',')
    : undefined;
  return {
    v: t ? 3 : 2,
    c: file.courseId,
    s: file.sessionId,
    p: '2026/9',
    n: SHORT_HASH_LEN,
    h,
    ...(t ? { t } : {}),
  };
}

export function fragmentFor(shareId: string): string {
  const payload = payloadFor(shareId);
  return payload ? encodeSharePayload(payload) : '';
}

/** The file the bare `/demo/v1/` lands on when no fragment is given. */
export const LANDING_SHARE_ID = 'demo-501-w9-v2';

// ------------------------------------------------------------------- API ----

export interface ViewerMeta {
  courseId?: string;
  sessionId?: string;
  courseTitle?: string;
  sessionTitle?: string;
  instructor?: string;
  professors?: string[];
  college?: string;
  schoolYear?: string;
  semester?: string;
}

export function metaFor(courseId: string, sessionId: string): ViewerMeta | null {
  const lecture = lectureAt(courseId, sessionId);
  if (!lecture) return null;
  const { courseTitle, sessionTitle, instructor, professors, college, schoolYear, semester } = lecture;
  return { courseId, sessionId, courseTitle, sessionTitle, instructor, professors, college, schoolYear, semester };
}
