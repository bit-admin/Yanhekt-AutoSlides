/**
 * Anonymous Yanhekt (cbiz) client for the share Worker.
 *
 * Course/session/list/tag GETs work without a user Bearer when Origin is the
 * official site and Xdomain-Client is web_user.
 * Signature headers are optional for these reads; we still send the constant
 * Xclient-Signature so we match the desktop/web clients.
 *
 * This is NOT an open proxy — only the helpers below are used, and only for
 * metadata (no video token, no VOD URLs).
 */

const CBIZ = 'https://cbiz.yanhekt.cn';
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.3';
const XCLIENT_SIGNATURE = '72b77856f6df3f563ab6e658631cac3d';

function headers(): Record<string, string> {
  return {
    Origin: 'https://www.yanhekt.cn',
    Referer: 'https://www.yanhekt.cn/',
    'User-Agent': USER_AGENT,
    'Xdomain-Client': 'web_user',
    'xdomain-client': 'web_user',
    'Xclient-Version': 'v1',
    'Xclient-Signature': XCLIENT_SIGNATURE,
    'Xclient-Timestamp': Math.floor(Date.now() / 1000).toString(),
    Accept: 'application/json',
  };
}

interface YanhektEnvelope<T> {
  code?: unknown;
  message?: string;
  data?: T;
}

async function getJson<T>(pathAndQuery: string): Promise<T | null> {
  try {
    const res = await fetch(`${CBIZ}${pathAndQuery}`, { headers: headers() });
    if (!res.ok) return null;
    const body = (await res.json()) as YanhektEnvelope<T>;
    if (body.code !== 0 && String(body.code) !== '0') return null;
    return (body.data ?? null) as T | null;
  } catch {
    return null;
  }
}

export interface YanhektCourse {
  id?: string | number;
  name_zh?: string;
  name_en?: string;
  college_name?: string;
  college?: { name?: string };
  school_year?: string | number;
  semester?: string | number;
  professors?: Array<string | { name?: string }>;
  instructor?: string;
}

export interface YanhektSession {
  id?: string | number;
  title?: string;
  week_number?: number;
  day?: number | string;
  started_at?: string;
  ended_at?: string;
  location?: string;
  course?: YanhektCourse;
}

export interface YanhektCourseListRow extends YanhektCourse {
  classrooms?: Array<{ name?: string }>;
}

export interface YanhektCourseListPage {
  data?: YanhektCourseListRow[];
  current_page?: number;
  last_page?: number;
  total?: number;
}

export interface YanhektTagChild {
  id: number;
  name: string;
  sort?: number;
}

export interface YanhektTag {
  param?: string;
  children?: YanhektTagChild[];
}

export interface LectureMeta {
  courseId: string;
  sessionId?: string;
  liveId?: string;
  courseTitle: string;
  sessionTitle: string;
  instructor: string;
  professors: string[];
  college: string;
  schoolYear: string;
  semester: string;
  weekNumber?: number;
  day?: number;
  location?: string;
}

function asString(value: unknown): string {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

function professorNames(course: YanhektCourse | undefined): string[] {
  if (!course) return [];
  const raw = course.professors ?? [];
  const names = raw
    .map((p) => (typeof p === 'string' ? p : p?.name ?? ''))
    .map((n) => n.trim())
    .filter(Boolean);
  if (names.length === 0 && course.instructor) names.push(course.instructor.trim());
  return names;
}

export function courseFromYanhekt(course: YanhektCourse | undefined, fallbackId?: string): Partial<LectureMeta> {
  const professors = professorNames(course);
  return {
    courseId: asString(course?.id) || fallbackId || '',
    courseTitle: asString(course?.name_zh) || asString(course?.name_en),
    instructor: professors[0] ?? '',
    professors,
    college: asString(course?.college_name) || asString(course?.college?.name),
    schoolYear: asString(course?.school_year),
    semester: asString(course?.semester),
  };
}

export function metaFromSession(
  session: YanhektSession | undefined,
  courseId: string,
  sessionId: string,
): LectureMeta {
  const course = courseFromYanhekt(session?.course, courseId);
  const dayRaw = session?.day;
  const day = typeof dayRaw === 'number' ? dayRaw : dayRaw ? Number(dayRaw) : undefined;
  return {
    courseId: course.courseId || courseId,
    sessionId,
    courseTitle: course.courseTitle ?? '',
    sessionTitle: asString(session?.title),
    instructor: course.instructor ?? '',
    professors: course.professors ?? [],
    college: course.college ?? '',
    schoolYear: course.schoolYear ?? '',
    semester: course.semester ?? '',
    weekNumber: session?.week_number,
    day: Number.isFinite(day) ? day : undefined,
    location: asString(session?.location) || undefined,
  };
}

export async function fetchCourse(courseId: string): Promise<YanhektCourse | null> {
  return getJson<YanhektCourse>(`/v1/course?id=${encodeURIComponent(courseId)}&with_professor_badges=true`);
}

export async function fetchSession(sessionId: string): Promise<YanhektSession | null> {
  return getJson<YanhektSession>(
    `/v1/course/session?session_id=${encodeURIComponent(sessionId)}&with_video=true`,
  );
}

export async function fetchCourseList(opts: {
  keyword?: string;
  /** Legacy single-id alias; ignored when `semesterIds` is provided. */
  semesterId?: string | number;
  /** Empty / omitted = all semesters (Yanhekt `semesters[]` is left off). */
  semesterIds?: Array<string | number>;
  page?: number;
  pageSize?: number;
}): Promise<YanhektCourseListPage | null> {
  const params = new URLSearchParams();
  params.set('page', String(opts.page ?? 1));
  params.set('page_size', String(opts.pageSize ?? 32));
  if (opts.keyword?.trim()) params.set('keyword', opts.keyword.trim());
  for (const id of collectSemesterIds(opts)) {
    params.append('semesters[]', id);
  }
  // Yanhekt wraps list pages as { code, data: { data: [...], last_page } } OR
  // { code, data: [...] } depending on version. Normalize below.
  const raw = await getJson<YanhektCourseListPage | YanhektCourseListRow[]>(`/v2/course/list?${params}`);
  if (!raw) return null;
  if (Array.isArray(raw)) return { data: raw, current_page: 1, last_page: 1, total: raw.length };
  return raw;
}

function collectSemesterIds(opts: {
  semesterId?: string | number;
  semesterIds?: Array<string | number>;
}): string[] {
  const raw = opts.semesterIds
    ?? (opts.semesterId !== undefined && opts.semesterId !== '' ? [opts.semesterId] : []);
  const out: string[] = [];
  const seen = new Set<string>();
  for (const value of raw) {
    const id = String(value).trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

export interface IndexSemester {
  id: number;
  /** Raw Yanhekt tag name, e.g. "2025-2026 第二学期". */
  label: string;
  /** Start year of the academic year, or 0 if unparseable. */
  schoolYear: number;
  /** 1 = Fall, 2 = Spring. */
  semester: number;
  /** English display, e.g. "Fall 2025" / "Spring 2026". */
  labelEn: string;
}

function parseSemesterName(name: string): Pick<IndexSemester, 'schoolYear' | 'semester' | 'labelEn'> {
  const match = name.match(/(\d{4})-(\d{4})\s+(第[一二]学期)/);
  if (!match) return { schoolYear: 0, semester: 1, labelEn: name };
  const startYear = parseInt(match[1], 10);
  const endYear = parseInt(match[2], 10);
  const semester = match[3] === '第一学期' ? 1 : 2;
  return {
    schoolYear: startYear,
    semester,
    labelEn: semester === 1 ? `Fall ${startYear}` : `Spring ${endYear}`,
  };
}

export async function fetchSemesters(): Promise<IndexSemester[]> {
  const tags = await getJson<YanhektTag[]>('/v1/tag/list?with_sub=true');
  const semesterTag = tags?.find((t) => t.param === 'semesters');
  const children = semesterTag?.children ?? [];
  return [...children]
    .sort((a, b) => (b.sort ?? 0) - (a.sort ?? 0))
    .map((c) => ({ id: c.id, label: c.name, ...parseSemesterName(c.name) }));
}

/**
 * One Worker-side fan-out: session detail (nested course) plus a course-detail
 * fallback when the session payload is thin. Used by /v1/api/meta and /v1/api/get.
 */
export async function fetchLectureMeta(courseId: string, sessionId?: string): Promise<LectureMeta | null> {
  const cid = courseId.trim();
  const sid = sessionId?.trim();
  if (!cid && !sid) return null;

  if (sid) {
    const [session, course] = await Promise.all([fetchSession(sid), cid ? fetchCourse(cid) : Promise.resolve(null)]);
    if (!session && !course) return null;
    const fromSession = metaFromSession(session ?? undefined, cid || asString(session?.course?.id), sid);
    if (course) {
      const fromCourse = courseFromYanhekt(course, cid);
      return {
        ...fromSession,
        courseTitle: fromCourse.courseTitle || fromSession.courseTitle,
        instructor: fromCourse.instructor || fromSession.instructor,
        professors: fromCourse.professors?.length ? fromCourse.professors : fromSession.professors,
        college: fromCourse.college || fromSession.college,
        schoolYear: fromCourse.schoolYear || fromSession.schoolYear,
        semester: fromCourse.semester || fromSession.semester,
      };
    }
    return fromSession;
  }

  const course = await fetchCourse(cid);
  if (!course) return null;
  const fromCourse = courseFromYanhekt(course, cid);
  return {
    courseId: fromCourse.courseId || cid,
    courseTitle: fromCourse.courseTitle ?? '',
    sessionTitle: '',
    instructor: fromCourse.instructor ?? '',
    professors: fromCourse.professors ?? [],
    college: fromCourse.college ?? '',
    schoolYear: fromCourse.schoolYear ?? '',
    semester: fromCourse.semester ?? '',
  };
}
