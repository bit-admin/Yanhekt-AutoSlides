/**
 * The Recorded page's enrolled courses, every term.
 *
 * Yanhekt's enrolled list only holds the current term. Earlier terms come
 * from Yanhe 2.0's My Courses, each course matched to its Yanhekt twin by
 * registrar number; a course Yanhekt does not have (a lab with no recordings)
 * is left out.
 *
 * Main is the only writer of the stored list (`enrolledCourses` in config,
 * rows of every saved account, each with its `owner`). What a twin lookup
 * found is kept in `enrolledSync`, so a course is looked up once:
 * - the current term is read from Yanhekt on every refresh (each visit);
 * - My Courses is read at most once a day, and only courses not looked up yet
 *   (or found missing more than a month ago) cost a lookup.
 */
import { cloudCourseOf, type CloudCourse } from '@common/courseCloud';
import { termKeyOf } from '@common/searchSources';
import type { CourseData } from '@common/apiTypes';
import type { EnrolledCourse, EnrolledRefreshResult } from '@common/types';
import type { Yanhe2Course } from '@common/yanhe2Curriculum';
import type { ApiClient } from '../apiClient';
import type { ConfigService } from '../configService';
import type { CourseLookup } from '../courseIndex/courseLookup';
import type { Yanhe2Service } from '../yanhe2/yanhe2Service';
import type { CourseCloudStore } from '../courseCloud/courseCloudStore';
import { createLogger } from '@main/infra/logger';
import { pinFromCourseData } from '../pins/pinSnapshots';

const log = createLogger('EnrolledCourses');

const PAGE_SIZE = 50;
const MAX_PAGES = 20;
/** My Courses is read again after this long. */
const AITA_REREAD_MS = 24 * 60 * 60 * 1000;
/** A course Yanhekt did not have is looked for again after this long. */
const MISSING_RECHECK_MS = 30 * 24 * 60 * 60 * 1000;
/** During a long fill, the list is written after this many new courses. */
const WRITE_EVERY = 4;
/** The account's course notes are read and written at most this often. */
const CLOUD_INTERVAL_MS = 10 * 60 * 1000;
/** Courses from the notes without a title, filled in per refresh. */
const MAX_CLOUD_TITLE_LOOKUPS = 12;

type Lookup = { kind: 'found'; course: CourseData } | { kind: 'missing' } | { kind: 'unknown' };

/** `2026-2027-1`, or '' when the term is not known. */
const termOf = (c: { school_year?: string; semester?: string }): string =>
  (c.school_year && c.semester ? termKeyOf(c.school_year, c.semester) : null) ?? '';

/** Newest term first; within a term, the order the courses came in. */
export function orderEnrolled(courses: EnrolledCourse[]): EnrolledCourse[] {
  return courses
    .map((course, index) => ({ course, index, term: termOf(course) }))
    .sort((a, b) => (a.term === b.term ? a.index - b.index : a.term < b.term ? 1 : -1))
    .map((e) => e.course);
}

/** A plain copy with the fields in a fixed order, so equal rows compare equal. */
export function plainEnrolled(c: EnrolledCourse): EnrolledCourse {
  return {
    id: String(c.id),
    yanhe2Id: c.yanhe2Id,
    title: c.title ?? '',
    titleEn: c.titleEn,
    number: c.number,
    instructor: c.instructor,
    time: c.time,
    classrooms: c.classrooms?.map((r) => ({ name: r.name })),
    participant_count: c.participant_count,
    college_name: c.college_name,
    professors: c.professors ? [...c.professors] : undefined,
    school_year: c.school_year,
    semester: c.semester,
    imageUrl: c.imageUrl,
    owner: c.owner,
  };
}

function enrolledOf(row: CourseData, owner: string, yanhe2Id?: string): EnrolledCourse {
  // The pin snapshot has the same card fields; `plainEnrolled` keeps only those.
  return plainEnrolled({ ...pinFromCourseData(row), yanhe2Id, owner });
}

export class EnrolledCoursesService {
  /** The refresh running per account: its first phase (current term) and the whole run. */
  private running = new Map<string, { firstPhase: Promise<EnrolledRefreshResult>; done: Promise<void> }>();
  private cloudAt = new Map<string, number>();
  /** What the last read of the notes gave, reused within the interval. */
  private cloudRows = new Map<string, EnrolledCourse[]>();
  /** Accounts whose current term was read this run, with that term ('' = unknown). */
  private cloudReady = new Map<string, string>();

  constructor(
    private readonly configService: ConfigService,
    private readonly apiClient: ApiClient,
    private readonly yanhe2Service: Yanhe2Service,
    private readonly courseLookup: CourseLookup,
    /** Called after the stored list changed, to broadcast config. */
    private readonly onChange: () => void,
    /** The account's course notes; absent or switched off, the list stays local. */
    private readonly courseCloud?: CourseCloudStore,
  ) {}

  /**
   * Refresh the account's enrolled list. Resolves once the current term is
   * read; earlier terms keep filling in the background. A call while one is
   * running joins it.
   */
  refresh(owner: string): Promise<EnrolledRefreshResult> {
    if (!owner) return Promise.resolve({ kind: 'ok' });
    const current = this.running.get(owner);
    if (current) return current.firstPhase;
    let settleFirst!: (result: EnrolledRefreshResult) => void;
    const firstPhase = new Promise<EnrolledRefreshResult>((resolve) => { settleFirst = resolve; });
    const done = (async () => {
      try {
        await this.run(owner, settleFirst);
        const readTerm = this.cloudReady.get(owner);
        this.cloudReady.delete(owner);
        if (readTerm !== undefined) await this.writeCloud(owner, readTerm);
      } catch (error) {
        log.warn('Enrolled list refresh failed:', error instanceof Error ? error.message : error);
        settleFirst({ kind: 'failed', message: error instanceof Error ? error.message : String(error) });
      } finally {
        this.running.delete(owner);
      }
    })();
    this.running.set(owner, { firstPhase, done });
    return firstPhase;
  }

  /** The whole run of the refresh in progress (tests). */
  whenIdle(owner: string): Promise<void> {
    return this.running.get(owner)?.done ?? Promise.resolve();
  }

  private async run(owner: string, settleFirst: (result: EnrolledRefreshResult) => void): Promise<void> {
    const token = this.configService.getAccountToken(owner);
    if (!token) {
      settleFirst({ kind: 'ok' });
      return;
    }

    // ---------- current term, from Yanhekt ----------
    const [rows, currentTermTag] = await Promise.all([this.fetchEnrolled(token), this.currentTerm()]);
    const stored = this.own(owner);
    const sync = this.configService.getEnrolledSync(owner);
    const yanhe2IdOf = (yanhektId: string): string | undefined =>
      Object.entries(sync.twins).find(([, t]) => t.yanhektId === yanhektId)?.[0];

    let current: EnrolledCourse[];
    let currentTerm: string;
    if (rows.kind === 'ok') {
      current = rows.data.map((row) => enrolledOf(row, owner, yanhe2IdOf(String(row.id))));
      currentTerm = currentTermTag ?? current.map(termOf).sort().pop() ?? '';
    } else {
      currentTerm = currentTermTag ?? '';
      current = currentTerm ? stored.filter((c) => termOf(c) === currentTerm) : [];
    }
    const currentIds = new Set(current.map((c) => c.id));
    const isPast = (c: EnrolledCourse) => !currentIds.has(c.id) && (!currentTerm || termOf(c) !== currentTerm);
    const fromCloud = (await this.readCloud(owner, token)).filter(isPast);
    let past = [...stored.filter(isPast), ...fromCloud.filter((c) => !stored.some((s) => s.id === c.id))];
    this.write(owner, [...current, ...past]);
    if (rows.kind === 'ok') this.cloudReady.set(owner, currentTerm);

    if (rows.kind !== 'ok' && !stored.length) settleFirst({ kind: 'failed', message: rows.message });
    else settleFirst({ kind: 'ok' });

    // ---------- earlier terms, from Yanhe 2.0 ----------
    if (!this.yanhe2Service.isSignedIn(owner)) return;
    const now = Date.now();
    if (now - sync.aitaReadAt < AITA_REREAD_MS) return;
    const mine = await this.yanhe2Service.getMyCourses(owner);
    if (mine.kind !== 'ok') return;

    // The current term's courses are on Yanhekt's list: join them by number
    // for free, so they need no lookup once the term is over.
    const byNumber = new Map(current.filter((c) => c.number).map((c) => [c.number as string, c]));
    for (const course of mine.data) {
      const hit = course.courseCode ? byNumber.get(course.courseCode) : undefined;
      if (hit) {
        sync.twins[course.courseId] = { yanhektId: hit.id, checkedAt: now };
        hit.yanhe2Id = course.courseId;
      }
    }

    const earlier = mine.data.filter((c) => !currentTerm || termOf({ school_year: c.schoolYear, semester: c.semester }) !== currentTerm);
    const known = new Map([...stored, ...current].map((c) => [c.id, c]));
    const resolved = new Map<string, EnrolledCourse>();
    const queue: Yanhe2Course[] = [];
    for (const course of earlier) {
      const twin = sync.twins[course.courseId];
      if (twin?.yanhektId) {
        const row = known.get(twin.yanhektId);
        if (row) resolved.set(course.courseId, { ...row, yanhe2Id: course.courseId });
        else queue.push(course);
      } else if (!twin || now - twin.checkedAt > MISSING_RECHECK_MS) {
        queue.push(course);
      }
    }

    const assemble = (): EnrolledCourse[] => {
      const seen = new Set(currentIds);
      past = [];
      for (const course of earlier) {
        const row = resolved.get(course.courseId);
        if (row && !seen.has(row.id)) {
          seen.add(row.id);
          past.push(row);
        }
      }
      // Earlier terms another computer saved stay, even if My Courses lacks them.
      for (const row of fromCloud) {
        if (!seen.has(row.id)) {
          seen.add(row.id);
          past.push(row);
        }
      }
      return [...current, ...past];
    };
    this.write(owner, assemble());
    this.configService.setEnrolledSync(owner, sync);

    let unknown = 0;
    let unwritten = 0;
    for (const course of queue) {
      const found = await this.lookup(owner, course, token);
      if (found.kind === 'unknown') {
        unknown++;
        continue;
      }
      sync.twins[course.courseId] = {
        yanhektId: found.kind === 'found' ? String(found.course.id) : null,
        checkedAt: Date.now(),
      };
      if (found.kind === 'found') {
        resolved.set(course.courseId, enrolledOf(found.course, owner, course.courseId));
        if (++unwritten >= WRITE_EVERY) {
          unwritten = 0;
          this.write(owner, assemble());
          this.configService.setEnrolledSync(owner, sync);
        }
      }
    }
    this.write(owner, assemble());
    // A lookup that could not be answered is tried at the next visit, not tomorrow.
    if (!unknown) sync.aitaReadAt = now;
    this.configService.setEnrolledSync(owner, sync);
    if (queue.length) log.info(`Enrolled list: ${queue.length} looked up, ${unknown} unanswered`);
  }

  // ---------- course notes ----------

  /** Enrolled rows from the account's notes, at most once per interval. */
  private async readCloud(owner: string, token: string): Promise<EnrolledCourse[]> {
    if (!this.courseCloud?.enabled()) return [];
    if (Date.now() - (this.cloudAt.get(owner) ?? 0) < CLOUD_INTERVAL_MS) return this.cloudRows.get(owner) ?? [];
    try {
      const { notes } = await this.courseCloud.read(token, 'enrolled');
      const known = new Map(this.own(owner).map((c) => [c.id, c]));
      let budget = MAX_CLOUD_TITLE_LOOKUPS;
      const rows: EnrolledCourse[] = [];
      for (const { course } of notes) {
        if (!course.yanhektId) continue;
        const row = known.get(course.yanhektId);
        if (row) {
          rows.push(row);
        } else if (course.title) {
          rows.push(this.rowOf(course, owner));
        } else if (budget-- > 0) {
          const filled = await this.fillTitle(course, token);
          if (filled) rows.push(this.rowOf(filled, owner));
        }
      }
      this.cloudRows.set(owner, rows);
      return rows;
    } catch (error) {
      log.warn('Course notes not read:', error instanceof Error ? error.message : error);
      return this.cloudRows.get(owner) ?? [];
    }
  }

  private rowOf(course: CloudCourse, owner: string): EnrolledCourse {
    return plainEnrolled({
      id: course.yanhektId,
      yanhe2Id: course.yanhe2Id || undefined,
      title: course.title,
      number: course.number || undefined,
      school_year: course.school_year || undefined,
      semester: course.semester || undefined,
      owner,
    });
  }

  private async fillTitle(course: CloudCourse, token: string): Promise<CloudCourse | null> {
    try {
      const detail = await this.apiClient.getCourseDetailOrIndex(course.yanhektId, token);
      return detail.title ? { ...course, title: detail.title } : null;
    } catch {
      return null;
    }
  }

  /**
   * Add this computer's courses to the notes. Only a current-term note can be
   * removed (the course was dropped): an earlier term's note stays even when
   * this computer has not got that course.
   */
  private async writeCloud(owner: string, currentTerm: string): Promise<void> {
    if (!this.courseCloud?.enabled()) return;
    if (Date.now() - (this.cloudAt.get(owner) ?? 0) < CLOUD_INTERVAL_MS) return;
    const token = this.configService.getAccountToken(owner);
    if (!token) return;
    try {
      const snapshot = await this.courseCloud.read(token, 'enrolled');
      const wanted = this.own(owner).map(cloudCourseOf);
      for (const { course } of snapshot.notes) {
        const term = termOf(course);
        if (!currentTerm || term !== currentTerm) wanted.push(course);
      }
      await this.courseCloud.reconcile(token, 'enrolled', wanted, snapshot);
      this.cloudAt.set(owner, Date.now());
    } catch (error) {
      log.warn('Course notes not written:', error instanceof Error ? error.message : error);
    }
  }

  /** The Yanhekt course with this Yanhe 2.0 course's registrar number. */
  private async lookup(owner: string, course: Yanhe2Course, token: string): Promise<Lookup> {
    let code = course.courseCode;
    let term = termKeyOf(course.schoolYear, course.semester);
    // My Courses often leaves the number out; the course's own detail has it.
    if (!code) {
      const detail = await this.yanhe2Service.getCourseDetail(owner, { courseId: course.courseId });
      if (detail.kind !== 'ok') return { kind: 'unknown' };
      code = detail.data.courseCode;
      term = term ?? termKeyOf(detail.data.schoolYear, detail.data.semester);
    }
    if (!code) return { kind: 'missing' };
    try {
      const found = await this.courseLookup.findCourse({ number: code }, term, token);
      return found ? { kind: 'found', course: found } : { kind: 'missing' };
    } catch {
      return { kind: 'unknown' };
    }
  }

  private async fetchEnrolled(token: string): Promise<{ kind: 'ok'; data: CourseData[] } | { kind: 'failed'; message: string }> {
    try {
      const data: CourseData[] = [];
      for (let page = 1; page <= MAX_PAGES; page++) {
        const result = await this.apiClient.getPersonalCourseList(token, { page, pageSize: PAGE_SIZE });
        data.push(...(result?.data ?? []));
        if (page >= (Number(result?.last_page) || 1)) break;
      }
      return { kind: 'ok', data };
    } catch (error) {
      return { kind: 'failed', message: error instanceof Error ? error.message : String(error) };
    }
  }

  private async currentTerm(): Promise<string | null> {
    try {
      const [current] = await this.apiClient.getAvailableSemesters();
      return current ? termKeyOf(current.schoolYear, current.semester) : null;
    } catch {
      return null;
    }
  }

  // ---------- storage ----------

  private own(owner: string): EnrolledCourse[] {
    return this.configService.getEnrolledCourses().filter((c) => c.owner === owner).map(plainEnrolled);
  }

  /** Replace the account's rows; writes and broadcasts only when something changed. */
  private write(owner: string, courses: EnrolledCourse[]): void {
    const all = this.configService.getEnrolledCourses().map(plainEnrolled);
    const seen = new Set<string>();
    const mine = orderEnrolled(courses.map((c) => plainEnrolled({ ...c, owner })))
      .filter((c) => (seen.has(c.id) ? false : (seen.add(c.id), true)));
    const next = [...mine, ...all.filter((c) => c.owner !== owner)];
    if (JSON.stringify(next) === JSON.stringify(all)) return;
    this.configService.setEnrolledCourses(next);
    this.onChange();
  }
}
