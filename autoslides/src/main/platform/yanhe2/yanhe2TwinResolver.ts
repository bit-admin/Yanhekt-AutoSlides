/**
 * Finds the Yanhekt lecture a Yanhe 2.0 session is, for anything that files
 * Yanhe 2.0 material under Yanhekt's ids and titles (saved slides, subtitles,
 * recordings). The rule and the pure pickers are in `yanhe2Twin.ts`; this is
 * the part that asks the two sites.
 *
 * It never guesses, and never stops the work either (owner ruling
 * 2026-10-21): what Yanhekt does not have is dropped from the name, and Yanhe
 * 2.0's own titles fill in.
 *
 * It also finds a whole course on the other site, in either direction, for the
 * session pages' "find this course on …" button.
 *
 * A Yanhekt course is found by registrar code (Yanhe 2.0 `kcwybm`) or id
 * through `CourseLookup`, in the course's own term (aita's `kkxn` + `kkxq`):
 * the current term from the source Settings → General → Search names for it
 * (Yanhekt's list by default), an earlier term from the course index (this
 * computer, then online). Yanhekt's own list search covers the current term
 * only (since 2026-10), so earlier terms need the index.
 */
import axios from 'axios';
import type { CourseData, SessionData } from '@common/apiTypes';
import type { SlideMetadataSource } from '@common/sidecars/metadata';
import type { Yanhe2CourseTwinResult, YanhektCourseTwinResult } from '@common/yanhe2CourseTwin';
import type { Yanhe2SubtitleTarget } from '@common/yanhe2Subtitles';
import type { ApiClient } from '../apiClient';
import type { ConfigService } from '../configService';
import type { CourseLookup } from '../courseIndex/courseLookup';
import { termKeyOf } from '@common/searchSources';
import { createLogger } from '@main/infra/logger';
import type { Yanhe2Service } from './yanhe2Service';
import { pickTwinSession } from './yanhe2Twin';

const log = createLogger('Yanhe2Twin');

/**
 * The Yanhekt lecture a Yanhe 2.0 session is, as far as Yanhekt has it, and
 * the names its files take. A course or session Yanhekt does not have (or
 * cannot be asked about, signed out) is left out: no id for it, and Yanhe
 * 2.0's own title in its place. So a course found without the session still
 * files under the course id; nothing found files under Yanhe 2.0's titles alone.
 */
export interface Yanhe2Twin {
  course: CourseData | null;
  session: SessionData | null;
  /** Ids are '' where Yanhekt had none. */
  target: Yanhe2SubtitleTarget;
  /** The registrar's course number (Yanhe 2.0 `kcwybm`), known with or without Yanhekt; '' if aita has none. */
  courseNumber: string;
}

/**
 * The `metadata.json` source of slides filed under a twin: the same fields, in
 * the same stored types, as a recorded extraction of that lecture on Yanhekt,
 * plus the registrar's number, which Yanhe 2.0 has even when Yanhekt does not.
 */
export function twinMetadataSource({ course, session, target, courseNumber }: Yanhe2Twin): SlideMetadataSource {
  const number = courseNumber || (course?.number != null && String(course.number) !== '' ? String(course.number) : undefined);
  if (!course) {
    return { courseTitle: target.courseTitle, courseNumber: number, sessionTitle: target.sessionTitle };
  }
  const professors = Array.isArray(course.professors) ? course.professors.filter((name) => typeof name === 'string') : [];
  const classrooms = Array.isArray(course.classrooms) ? course.classrooms.map((room) => room.name).filter(Boolean) : [];
  // Week and day are the Yanhekt session's; without it they are not known.
  const weekNumber = session ? Number(session.week_number) : NaN;
  const day = session ? Number(session.day) : NaN;
  return {
    courseId: target.courseId,
    courseTitle: target.courseTitle,
    courseNumber: number,
    sessionId: target.sessionId || undefined,
    sessionTitle: target.sessionTitle,
    instructor: professors.length > 0 ? professors.join(', ') : undefined,
    professors: professors.length > 0 ? professors : undefined,
    semester: course.semester === undefined ? undefined : String(course.semester),
    schoolYear: course.school_year === undefined ? undefined : String(course.school_year),
    college: course.college_name || undefined,
    classrooms: classrooms.length > 0 ? classrooms : undefined,
    weekNumber: Number.isFinite(weekNumber) ? weekNumber : undefined,
    day: Number.isFinite(day) ? day : undefined,
  };
}

export type Yanhe2TwinFound =
  | { kind: 'ok'; data: Yanhe2Twin }
  /** No live Yanhe 2.0 session for that account. */
  | { kind: 'signed_out' }
  /** Yanhe 2.0 or Yanhekt did not answer. Not a reason to drop the ids: try again. */
  | { kind: 'network' }
  | { kind: 'failed' };

export class Yanhe2TwinResolver {
  constructor(
    private readonly yanhe2Service: Yanhe2Service,
    private readonly apiClient: ApiClient,
    private readonly configService: ConfigService,
    private readonly courseLookup: CourseLookup,
  ) {}

  /** `query` is the renderer's `{ courseId, subId }` (aita ids), checked by the service. */
  async find(account: string, query: unknown): Promise<Yanhe2TwinFound> {
    const key = await this.yanhe2Service.getTwinKey(account, query);
    if (key.kind !== 'ok') return { kind: key.kind };
    const { courseCode, startAt, term } = key.data;

    let course: CourseData | null = null;
    let session: SessionData | null = null;
    // Without a sign-in the session list is empty, so the session is not looked for: Yanhe 2.0's names stand.
    const token = this.configService.getAuthToken();
    if (courseCode) {
      try {
        course = await this.courseLookup.findCourse({ number: courseCode }, term, token);
        if (course && startAt && token) {
          session = pickTwinSession(await this.apiClient.getCourseSessions(String(course.id), token), startAt);
        }
      } catch (error) {
        if (axios.isAxiosError(error) && !error.response) return { kind: 'network' };
        // An answer that is not a list is as good as no match: keep what was found.
        log.warn('Yanhekt lookup for a Yanhe 2.0 session failed:', error instanceof Error ? error.message : error);
      }
    }
    if (!course) log.debug('No Yanhekt course for a Yanhe 2.0 session; filing under Yanhe 2.0 titles');
    else if (!session) log.debug('No Yanhekt session for a Yanhe 2.0 session; filing under the course only');

    return {
      kind: 'ok',
      data: {
        course,
        session,
        target: {
          courseId: course ? String(course.id) : '',
          courseTitle: course?.name_zh || key.data.courseTitle,
          // A session id means nothing without its course.
          sessionId: course && session ? String(session.session_id) : '',
          sessionTitle: (course && session?.title) || key.data.sessionTitle,
        },
        courseNumber: courseCode || '',
      },
    };
  }

  /**
   * Yanhe 2.0 → Yanhekt: the Yanhekt course with this Yanhe 2.0 course's
   * number. One call: Yanhekt's list takes the number as its keyword.
   * `query` is the renderer's `{ courseId }` (aita id), checked by the service.
   */
  async findYanhektCourse(account: string, query: unknown): Promise<YanhektCourseTwinResult> {
    const detail = await this.yanhe2Service.getCourseDetail(account, query);
    if (detail.kind !== 'ok') return { kind: detail.kind };
    const courseCode = detail.data.courseCode;
    if (!courseCode) return { kind: 'no_match' };

    // Its sessions page, where the answer is opened, is empty without a sign-in.
    const token = this.configService.getAuthToken();
    if (!token) return { kind: 'yanhekt_signed_out' };
    try {
      const term = termKeyOf(detail.data.schoolYear, detail.data.semester);
      const course = await this.courseLookup.findCourse({ number: courseCode }, term, token);
      return course ? { kind: 'ok', data: course } : { kind: 'no_match' };
    } catch (error) {
      return this.missOf(error);
    }
  }

  /**
   * Yanhekt → Yanhe 2.0: the Yanhe 2.0 course with this Yanhekt course's
   * number. The course is found here by id (`CourseLookup.locate`), so a
   * course opened from a pin (an id and a title, nothing else) is found the
   * same way, in any term; then Yanhe 2.0 is searched by name in that term
   * (`fetchYanhe2CourseByCode`).
   * `query` is the renderer's `{ courseId }` (Yanhekt id).
   */
  async findYanhe2Course(account: string, query: unknown): Promise<Yanhe2CourseTwinResult> {
    const { courseId } = (query && typeof query === 'object' ? query : {}) as Record<string, unknown>;
    if (typeof courseId !== 'string' || !/^\d{1,12}$/.test(courseId)) return { kind: 'failed' };
    const token = this.configService.getAuthToken();
    if (!token) return { kind: 'yanhekt_signed_out' };

    let key: { courseCode: string; title: string; teachers: string[]; termName: string } | null = null;
    try {
      const located = await this.courseLookup.locate({ id: courseId }, null, token);
      if (located?.kind === 'yanhekt') {
        const row = located.course;
        if (row.number !== undefined && row.number !== null && String(row.number) !== '') {
          key = {
            courseCode: String(row.number),
            title: row.name_zh ?? '',
            teachers: Array.isArray(row.professors) ? row.professors : [],
            termName: `${row.school_year ?? ''}-${row.semester ?? ''}`,
          };
        }
      } else if (located?.kind === 'index' && located.row.number) {
        key = {
          courseCode: located.row.number,
          title: located.row.name,
          teachers: located.row.teachers,
          termName: located.row.term ?? '',
        };
      }
    } catch (error) {
      return this.missOf(error);
    }
    if (!key) return { kind: 'no_match' };

    const found = await this.yanhe2Service.findCourseByCode(account, key);
    if (found.kind !== 'ok') return { kind: found.kind };
    return found.data ? { kind: 'ok', data: found.data } : { kind: 'no_match' };
  }

  private missOf(error: unknown): { kind: 'network' | 'failed' } {
    if (axios.isAxiosError(error) && !error.response) return { kind: 'network' };
    log.warn('Yanhekt course lookup failed:', error instanceof Error ? error.message : error);
    return { kind: 'failed' };
  }
}
