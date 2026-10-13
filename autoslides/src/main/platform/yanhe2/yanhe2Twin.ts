/**
 * Finding the Yanhekt lecture a Yanhe 2.0 session is.
 *
 * The two sites number courses and sessions separately, but both keep the
 * registrar's course number (Yanhekt `number`, Yanhe 2.0 `kcwybm`) and both
 * schedule a session at the same start time. So:
 *
 *   1. Yanhekt's course list takes the number as its keyword and answers with
 *      that one course (a whole-string match, every term).
 *   2. That course's session list has the session whose `started_at`, read as
 *      Beijing time, is the Yanhe 2.0 start.
 *
 * Step 2 needs the Yanhekt sign-in: an anonymous session list is empty.
 * Either step finding nothing is an answer, not an error. Nothing here guesses.
 */
import type { CourseData, SessionData } from '@common/apiTypes';

/** What the join needs from Yanhe 2.0. */
export interface Yanhe2TwinKey {
  /** `kcwybm`. An opaque string: never parsed, compared whole. */
  courseCode: string;
  /** The session's scheduled start, epoch seconds. */
  startAt: number;
}

/** `2026-09-21 08:00:00`, Beijing wall clock → epoch seconds. Null for any other shape. */
export function yanhektStartSeconds(startedAt: unknown): number | null {
  if (typeof startedAt !== 'string') return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?$/.exec(startedAt.trim());
  if (!m) return null;
  const utc = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4]) - 8, Number(m[5]), Number(m[6] ?? 0));
  return Number.isFinite(utc) ? Math.floor(utc / 1000) : null;
}

/** The row whose number is exactly this one. The keyword also matches course codes, ids and teacher badges, so the rows are checked. */
export function pickTwinCourse(rows: CourseData[], courseCode: string): CourseData | null {
  if (!courseCode) return null;
  const matches = rows.filter((row) => row.number !== undefined && row.number !== null && String(row.number) === courseCode);
  return matches.length === 1 ? matches[0] : null;
}

/** The one session starting at that second. Two at the same time is not a match. */
export function pickTwinSession(sessions: SessionData[], startAt: number): SessionData | null {
  if (!startAt) return null;
  const matches = sessions.filter((session) => yanhektStartSeconds(session.started_at) === startAt);
  return matches.length === 1 ? matches[0] : null;
}
