/**
 * Yanhe 2.0 Calendar — the plain rows both processes agree on, and the date
 * rules the page and main share.
 *
 * Main reads aita with the stored JWT and hands the renderer only what is
 * below: no token, no teacher badge, no upstream envelope.
 */

/** Lifecycle of one session (aita `sub_status`). Upstream labels are often empty, so the page words these itself. */
export type Yanhe2SessionStatus = 'upcoming' | 'live' | 'processing' | 'playable' | 'ended' | 'unknown';

export interface Yanhe2CalendarSession {
  courseId: string;
  /** aita session id (`sub_id`). */
  subId: string;
  title: string;
  /** e.g. `2026-09-28第1-2节`. Empty on My Courses rows. */
  subTitle: string;
  teacher: string;
  room: string;
  /** Empty on My Courses rows. */
  college: string;
  /** `kcwybm`, the key that links a course to cbiz. Kept for later, not shown. Empty on My Courses rows. */
  courseCode: string;
  /** Epoch seconds; 0 when upstream gave none. */
  startAt: number;
  endAt: number;
  status: Yanhe2SessionStatus;
}

/** One teaching period of the school day (第一节 08:00–09:35, …). */
export interface Yanhe2CalendarPeriod {
  id: number;
  name: string;
  /** `HH:MM`. */
  beginTime: string;
  endTime: string;
  sessions: Yanhe2CalendarSession[];
  /** False when this response did not cover the period: ask again with its id. */
  loaded: boolean;
}

export interface Yanhe2CalendarDay {
  periods: Yanhe2CalendarPeriod[];
}

export interface Yanhe2ScheduleDay {
  /** `YYYY-MM-DD`. */
  day: string;
  sessions: Yanhe2CalendarSession[];
}

export interface Yanhe2DayQuery {
  /** `YYYY-MM-DD`. */
  date: string;
  keyword?: string;
  /** Load just this period. */
  periodId?: number;
}

export interface Yanhe2WeekQuery {
  /** `YYYY-MM-DD`, inclusive. */
  startDate: string;
  endDate: string;
}

export type Yanhe2ReadResult<T> =
  | { kind: 'ok'; data: T }
  /** No live Yanhe 2.0 session for that account, or the server just refused it. */
  | { kind: 'signed_out' }
  | { kind: 'network' }
  /** Reached Yanhe 2.0, but the answer was not the expected shape, or the query was not valid. */
  | { kind: 'failed' };

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** True for a real calendar date written `YYYY-MM-DD`. */
export function isCalendarDate(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const m = DATE_RE.exec(value);
  if (!m) return false;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return d.toISOString().slice(0, 10) === value;
}

/** `2026-09-28` → `2026-9-28`: the day list wants its date without zero padding. */
export function toSearchTime(date: string): string {
  const [y, m, d] = date.split('-');
  return `${y}-${Number(m)}-${Number(d)}`;
}

export function shiftDate(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** The Monday that starts that date's week. The school week (and aita's own) runs Monday to Sunday. */
export function weekStartOf(date: string): string {
  const weekday = new Date(`${date}T00:00:00Z`).getUTCDay();
  return shiftDate(date, -((weekday + 6) % 7));
}

// The timetable is Beijing's wherever the app runs.
const BEIJING_OFFSET_MS = 8 * 60 * 60 * 1000;

/** Today's date in Beijing, `YYYY-MM-DD`. */
export function beijingDate(nowMs: number): string {
  return new Date(nowMs + BEIJING_OFFSET_MS).toISOString().slice(0, 10);
}

/** Beijing wall clock `HH:MM` for an epoch-seconds instant; '' for 0. */
export function beijingClock(epochSeconds: number): string {
  if (!epochSeconds) return '';
  return new Date(epochSeconds * 1000 + BEIJING_OFFSET_MS).toISOString().slice(11, 16);
}

const CN_DIGITS = '零一二三四五六七八九';

/** `第一节` / `第12节` → its number, so the page can word it per locale. Null for any other shape. */
export function periodNumber(name: string): number | null {
  const m = /^第\s*([0-9]+|[一二三四五六七八九十]+)\s*大?节$/.exec(name.trim());
  if (!m) return null;
  if (/^\d+$/.test(m[1])) return Number(m[1]);
  const [tens, ones] = m[1].includes('十') ? m[1].split('十') : ['', m[1]];
  const digit = (ch: string) => (ch ? CN_DIGITS.indexOf(ch) : 0);
  if (tens.length > 1 || ones.length > 1) return null;
  const value = (m[1].includes('十') ? (tens ? digit(tens) : 1) * 10 : 0) + digit(ones);
  return value > 0 ? value : null;
}

/** `2026-09-28第1-2节` → `{ from: 1, to: 2 }`: the lessons a session spans. Null when the subtitle says nothing of the kind. */
export function lessonRange(subTitle: string): { from: number; to: number } | null {
  const m = /第\s*(\d+)(?:\s*[-–~]\s*(\d+))?\s*节/.exec(subTitle);
  if (!m) return null;
  const from = Number(m[1]);
  return { from, to: m[2] ? Number(m[2]) : from };
}

/**
 * BIT's teaching day: five periods (大节), each two or three 45-minute lessons
 * (小节) with a 5-minute break between. These are the same hours aita's own
 * period list gives. aita numbers a session by its lessons
 * (`第1-2节`); cbiz names the same slot by its period (`第1大节`).
 */
export const YANHE2_TIMETABLE = [
  { period: 1, lessons: [1, 2], begin: '08:00', end: '09:35' },
  { period: 2, lessons: [3, 5], begin: '09:55', end: '12:20' },
  { period: 3, lessons: [6, 7], begin: '13:20', end: '14:55' },
  { period: 4, lessons: [8, 10], begin: '15:15', end: '17:40' },
  { period: 5, lessons: [11, 13], begin: '18:30', end: '20:55' },
] as const;

const minutesOf = (clock: string): number => Number(clock.slice(0, 2)) * 60 + Number(clock.slice(3, 5));

/**
 * Which period's row a session belongs in on the week timetable: the one it
 * overlaps most. Null when it touches none (an evening make-up, a lunch slot),
 * or has no start time.
 */
export function timetablePeriodOf(startAt: number, endAt: number): number | null {
  const startClock = beijingClock(startAt);
  if (!startClock) return null;
  const start = minutesOf(startClock);
  // A session that runs past midnight, or has no end, counts from its start only.
  const endClock = beijingClock(endAt);
  const end = endClock && minutesOf(endClock) > start ? minutesOf(endClock) : start + 1;
  let best: number | null = null;
  let bestOverlap = 0;
  for (const slot of YANHE2_TIMETABLE) {
    const overlap = Math.min(end, minutesOf(slot.end)) - Math.max(start, minutesOf(slot.begin));
    if (overlap > bestOverlap) {
      bestOverlap = overlap;
      best = slot.period;
    }
  }
  return best;
}
