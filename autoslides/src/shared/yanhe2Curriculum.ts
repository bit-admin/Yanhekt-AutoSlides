/**
 * Yanhe 2.0 Curriculum — the plain rows both processes agree on: the account's
 * enrolled courses, and one course with its sessions.
 *
 * Same rule as the Calendar: main reads aita with the stored JWT and hands the
 * renderer only what is below.
 */
import type { Yanhe2CalendarSession } from './yanhe2Calendar';

export interface Yanhe2Course {
  courseId: string;
  title: string;
  teacher: string;
  college: string;
  /** aita's own term name, e.g. `2026-2027-1`. Past terms are listed too. */
  term: string;
  /** `2026-2027` and `1` / `2` when the row carried them, for a worded term line. */
  schoolYear: string;
  semester: string;
  /** `kcwybm`, the key that links a course to cbiz. Kept for later, not shown. */
  courseCode: string;
}

export interface Yanhe2CourseDetail extends Yanhe2Course {
  /** Every session of the course, oldest first. Empty when aita has none attached. */
  sessions: Yanhe2CalendarSession[];
}

export interface Yanhe2CourseDetailQuery {
  courseId: string;
}
