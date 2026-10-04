/**
 * Yanhe 2.0 Curriculum reads: the account's enrolled courses
 * (`account-profile/course`) and one course's sessions (`get-course-detail`).
 *
 * Response bodies carry teacher badges and more than the page needs. Only the
 * parsed rows leave this module, and bodies are never logged.
 */
import type { Yanhe2CalendarSession, Yanhe2SessionStatus } from '@common/yanhe2Calendar';
import type { Yanhe2Course, Yanhe2CourseDetail } from '@common/yanhe2Curriculum';
import { YANHE2_READ_PATHS, readYanhe2, type Yanhe2Fetched } from './yanhe2Http';

type Row = Record<string, unknown>;

const isRow = (value: unknown): value is Row => !!value && typeof value === 'object' && !Array.isArray(value);
const text = (value: unknown): string =>
  typeof value === 'string' ? value.trim() : typeof value === 'number' ? String(value) : '';
const seconds = (value: unknown): number => {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
};

const STATUS: Record<string, Yanhe2SessionStatus> = {
  '1': 'live',
  '2': 'upcoming',
  '3': 'processing',
  '5': 'ended',
  '6': 'playable',
};

/** `information` is a JSON string holding the term fields and `kcwybm`. */
function parseInformation(value: unknown): { schoolYear: string; semester: string; courseCode: string } {
  let info: unknown = value;
  if (typeof value === 'string') {
    try {
      info = JSON.parse(value);
    } catch {
      info = null;
    }
  }
  if (!isRow(info)) return { schoolYear: '', semester: '', courseCode: '' };
  return { schoolYear: text(info.kkxn), semester: text(info.kkxq), courseCode: text(info.kcwybm) };
}

/** The speaker among `Teachers`, when the row's own teacher field is empty. */
function speakerOf(list: unknown, nameKey: string, speakerKey: string): string {
  const rows = (Array.isArray(list) ? list : []).filter(isRow);
  const speaker = rows.find((row) => text(row[speakerKey]) === '1') ?? rows[0];
  return speaker ? text(speaker[nameKey]) : '';
}

export interface Yanhe2CoursePage {
  courses: Yanhe2Course[];
  /** How many rows the page held, parsed or not, so paging can tell the last page. */
  rows: number;
  total: number;
}

/**
 * `{code:1000, params:{result:{data, total}}}`, rows in PascalCase. `Id` is a
 * number here and a string everywhere else, so it is stringified.
 */
export function parseCourseList(body: unknown): Yanhe2CoursePage | null {
  if (!isRow(body) || body.code !== 1000 || !isRow(body.params) || !isRow(body.params.result)) return null;
  const { data, total } = body.params.result;
  if (!Array.isArray(data)) return null;
  const courses: Yanhe2Course[] = [];
  for (const row of data) {
    if (!isRow(row)) continue;
    const courseId = text(row.Id);
    if (!/^\d{1,12}$/.test(courseId)) continue;
    courses.push({
      courseId,
      title: text(row.Title),
      teacher: text(row.Teacher) || text(row.Realname) || speakerOf(row.Teachers, 'Realname', 'IsSpeaker'),
      college: text(row.KkxyName),
      term: text(row.TermName),
      ...parseInformation(row.information),
    });
  }
  const count = Number(total);
  return { courses, rows: data.length, total: Number.isFinite(count) ? count : data.length };
}

/**
 * `sub_list[year][month][week of that month] = [session, …]`, and `[]` for a
 * course with no sessions. Walked without trusting the depth: anything with a
 * session's `id` and `class_begin` is a session.
 */
function collectSessions(node: unknown, out: Row[], depth = 0): void {
  if (depth > 6) return;
  if (Array.isArray(node)) {
    for (const entry of node) collectSessions(entry, out, depth + 1);
  } else if (isRow(node)) {
    if ('class_begin' in node && 'id' in node) out.push(node);
    else for (const entry of Object.values(node)) collectSessions(entry, out, depth + 1);
  }
}

/**
 * `{code:0, data}`. An empty `sub_list` is a real answer — aita has the course
 * and no meetings attached to it — and comes back as no sessions, not a failure.
 */
export function parseCourseDetail(body: unknown): Yanhe2CourseDetail | null {
  if (!isRow(body) || body.code !== 0 || !isRow(body.data)) return null;
  const data = body.data;
  const courseId = text(data.id);
  if (!courseId) return null;

  const info = parseInformation(data.information);
  const course: Yanhe2Course = {
    courseId,
    title: text(data.title),
    teacher: text(data.realname) || speakerOf(data.teachers, 'realname', 'is_speaker'),
    college: text(data.kkxy_name),
    term: text(data.term_name),
    schoolYear: info.schoolYear,
    semester: info.semester,
    // `course_code` on this call is a shortened form; `kcwybm` is the real key.
    courseCode: text(data.kcwybm) || info.courseCode,
  };

  const rows: Row[] = [];
  collectSessions(data.sub_list, rows);
  const sessions: Yanhe2CalendarSession[] = [];
  for (const row of rows) {
    const subId = text(row.id);
    if (!/^\d{1,12}$/.test(subId)) continue;
    sessions.push({
      courseId,
      subId,
      title: course.title,
      subTitle: text(row.sub_title),
      teacher: text(row.lecturer_name) || course.teacher,
      room: text(row.room_name),
      college: course.college,
      courseCode: course.courseCode,
      startAt: seconds(row.class_begin),
      endAt: seconds(row.class_over),
      status: STATUS[text(row.sub_status)] ?? 'unknown',
    });
  }
  sessions.sort((a, b) => a.startAt - b.startAt || a.subId.localeCompare(b.subId));
  return { ...course, sessions };
}

const PAGE_SIZE = 50;
/** Nobody is enrolled in a thousand courses; this only stops a server that never says "done". */
const MAX_PAGES = 20;

/** Every enrolled course, past terms included, in the server's order. */
export async function fetchYanhe2Courses(jwt: string): Promise<Yanhe2Fetched<Yanhe2Course[]>> {
  const courses: Yanhe2Course[] = [];
  const seen = new Set<string>();
  let rows = 0;
  for (let page = 1; page <= MAX_PAGES; page++) {
    // `force_mycourse=1` is what makes this the enrolled list: without it a
    // course whose player was merely opened is mixed in.
    const fetched = await readYanhe2(jwt, YANHE2_READ_PATHS.myCourses, {
      force_mycourse: '1',
      nowpage: String(page),
      'per-page': String(PAGE_SIZE),
    });
    if (fetched.kind !== 'ok') return fetched;
    const parsed = parseCourseList(fetched.data);
    if (!parsed) return { kind: 'failed', detail: 'course list was not the expected shape' };
    for (const course of parsed.courses) {
      if (seen.has(course.courseId)) continue;
      seen.add(course.courseId);
      courses.push(course);
    }
    rows += parsed.rows;
    if (parsed.rows === 0 || rows >= parsed.total) break;
  }
  return { kind: 'ok', data: courses };
}

export async function fetchYanhe2CourseDetail(
  jwt: string,
  courseId: string,
): Promise<Yanhe2Fetched<Yanhe2CourseDetail>> {
  // `course_id` is the only parameter the list needs. `student` would add a
  // per-session finished flag the page does not show.
  const fetched = await readYanhe2(jwt, YANHE2_READ_PATHS.courseDetail, { course_id: courseId });
  if (fetched.kind !== 'ok') return fetched;
  const data = parseCourseDetail(fetched.data);
  return data ? { kind: 'ok', data } : { kind: 'failed', detail: 'course detail was not the expected shape' };
}
