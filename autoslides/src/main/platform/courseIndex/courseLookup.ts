/**
 * Course search and lookups across the three sources, following
 * Settings → General → Search (@common/searchSources):
 *
 *   - word search in a term: the current term from the one chosen source (the
 *     Yanhekt case stays with the caller); an earlier term from the local copy
 *     when it holds that term, else the online Index;
 *   - session ids of a course (after Yanhekt's lists came back empty), a course
 *     by id, a course by registrar code: local copy, then the online Index on
 *     a miss (the local copy may be stale), or the online Index only. A lookup
 *     in the current term follows the current-term source instead.
 *
 * Signed-in users only in the app: every method takes the Yanhekt token, and
 * without one neither the local copy nor the online Index is read (the online
 * Index gets the token as a Bearer). The one exception is `yhdl search`, which
 * stays anonymous (owner ruling): it passes `anonymous` and sends no Bearer.
 *
 * Index failures (offline, an error answer) count as "not found" here: the
 * callers already have an answer that stands without the index. Yanhekt's own
 * errors are thrown, as callers handled them before.
 */

import type { CourseData } from '@common/apiTypes';
import type { CourseIndexRow, CourseIndexSearchResult, CourseIndexSource } from '@common/courseIndexTypes';
import { termKeyOf, type CurrentTermSearchSource, type EarlierTermSearchSource } from '@common/searchSources';
import { createLogger } from '@main/infra/logger';
import type { ApiClient } from '../apiClient';
import type { ConfigService } from '../configService';
import { IndexError, indexCourseById, indexCourseByNumber, indexSearch, indexSessionIds, type IndexSearchRow } from '../indexClient';
import type { LocalCourseIndex } from './courseIndex';

const log = createLogger('CourseLookup');

/** How long the current term is trusted before asking again. */
const CURRENT_TERM_TTL_MS = 10 * 60 * 1000;
/** Online answers are kept briefly so paging does not ask again. */
const ONLINE_PAGE_TTL_MS = 5 * 60 * 1000;

export type { CourseIndexRow, CourseIndexSearchResult, CourseIndexSource };

type Step = 'yanhekt' | 'local' | 'online';

function toRow(c: { id: string; name: string; number: string | null; term: string | null; teachers: string[] }): CourseIndexRow {
  return { id: c.id, name: c.name, number: c.number, term: c.term, teachers: [...c.teachers] };
}

export class CourseLookup {
  private current: { at: number; value: Promise<string | null> } | null = null;
  private readonly onlinePages = new Map<string, { at: number; rows: CourseIndexRow[] }>();

  constructor(
    private readonly local: LocalCourseIndex,
    private readonly apiClient: ApiClient,
    private readonly configService: ConfigService,
  ) {}

  private get currentSource(): CurrentTermSearchSource {
    return this.configService.getCurrentTermSearchSource();
  }

  private get earlierSource(): EarlierTermSearchSource {
    return this.configService.getEarlierTermSearchSource();
  }

  /** The current term key from Yanhekt's default term tag (saved, so it survives a failed request). */
  currentTerm(): Promise<string | null> {
    if (!this.current || Date.now() - this.current.at > CURRENT_TERM_TTL_MS) {
      const value = this.apiClient.getAvailableSemesters()
        .then(([option]) => (option ? termKeyOf(option.schoolYear, option.semester) : null))
        .catch(() => null);
      this.current = { at: Date.now(), value };
      void value.then((term) => {
        if (term === null) this.current = null;
      });
    }
    return this.current.value;
  }

  /** The sources an exact lookup asks, in order, for a course of `term` (null: unknown). */
  private async stepsFor(term: string | null): Promise<Step[]> {
    const earlier: Step[] = this.earlierSource === 'online' ? ['online'] : ['local', 'online'];
    const current = term === null ? null : await this.currentTerm();
    if (term !== null && current !== null && term !== current) return earlier;
    const first: Step = this.currentSource;
    if (term !== null && current !== null) return [first];
    // Unknown term: the current-term source first, then the earlier-term chain.
    return [first, ...earlier.filter((s) => s !== first)];
  }

  /** Where a word search in `term` goes: Yanhekt (the caller's job), or the local or online index. */
  async searchSource(term: string): Promise<'yanhekt' | CourseIndexSource> {
    const current = await this.currentTerm();
    if (current !== null && term === current) return this.currentSource;
    if (this.earlierSource === 'online') return 'online';
    return (await this.local.hasTerm(term)) ? 'local' : 'online';
  }

  /**
   * A word search in one term from the index (local or online, per the
   * settings). Needs a token, unless the caller is the anonymous `yhdl`
   * (`token` then 'anonymous').
   */
  async search(term: string, keyword: string, page: number, pageSize: number, token: string | null | 'anonymous'): Promise<CourseIndexSearchResult> {
    const source = await this.searchSource(term);
    if (source === 'yanhekt') return { ok: false, reason: 'yanhekt' };
    if (!token) return { ok: false, reason: 'sign-in' };
    const bearer = token === 'anonymous' ? null : token;

    let rows: CourseIndexRow[];
    if (source === 'local') {
      const found = await this.local.search(term, keyword);
      if (!found) return { ok: false, reason: 'local-missing' };
      rows = found.map(toRow);
    } else {
      try {
        rows = await this.onlineSearch(term, keyword, bearer);
      } catch (error) {
        const code = error instanceof IndexError ? error.code : 'network';
        return { ok: false, reason: 'online-failed', code, message: error instanceof Error ? error.message : String(error) };
      }
    }
    const lastPage = Math.max(1, Math.ceil(rows.length / pageSize));
    const at = Math.min(Math.max(1, page), lastPage);
    return {
      ok: true,
      source,
      term,
      total: rows.length,
      page: at,
      lastPage,
      courses: rows.slice((at - 1) * pageSize, at * pageSize),
    };
  }

  private async onlineSearch(term: string, keyword: string, token: string | null): Promise<CourseIndexRow[]> {
    const key = `${term}\n${keyword.trim()}`;
    const hit = this.onlinePages.get(key);
    if (hit && Date.now() - hit.at < ONLINE_PAGE_TTL_MS) return hit.rows;
    const answer = await indexSearch(keyword.trim(), term, token);
    const rows = answer.results.map((r) => toRow(r));
    this.onlinePages.set(key, { at: Date.now(), rows });
    if (this.onlinePages.size > 50) this.onlinePages.delete(this.onlinePages.keys().next().value as string);
    return rows;
  }

  /** A course's session ids from the index: local, then online on a miss (or online only). Empty when neither has any, or with no token. */
  async sessionIds(courseId: string, token: string | null): Promise<string[]> {
    if (!token) return [];
    if (this.earlierSource !== 'online') {
      const course = await this.local.byId(courseId).catch(() => null);
      if (course && course.sessionIds.length > 0) return [...course.sessionIds];
    }
    try {
      return await indexSessionIds(courseId, token);
    } catch (error) {
      log.debug('Index session ids unavailable for course', courseId, error instanceof Error ? error.message : error);
      return [];
    }
  }

  /**
   * The course with this id or registrar code, where the settings say to look.
   * `term` is the course's term when the caller knows it (Yanhe 2.0 does).
   * Without a token nothing is looked up (Yanhekt's list needs one too).
   */
  async locate(
    by: { id: string } | { number: string },
    term: string | null,
    token: string | null,
  ): Promise<{ kind: 'yanhekt'; course: CourseData } | { kind: 'index'; row: CourseIndexRow } | null> {
    if (!token) return null;
    for (const step of await this.stepsFor(term)) {
      if (step === 'yanhekt') {
        // Yanhekt's list takes an id or a code as its keyword; the row is checked.
        const keyword = 'id' in by ? by.id : by.number;
        const listed = await this.apiClient.getCourseList(token, { keyword, page: 1, pageSize: 16 });
        const rows = listed.data ?? [];
        const matches = 'id' in by
          ? rows.filter((row) => String(row.id) === by.id)
          : rows.filter((row) => row.number != null && String(row.number) === by.number);
        if (matches.length === 1) return { kind: 'yanhekt', course: matches[0] };
        continue;
      }
      if (step === 'local') {
        const found = await ('id' in by ? this.local.byId(by.id) : this.local.byNumber(by.number)).catch(() => null);
        if (found) return { kind: 'index', row: toRow(found) };
        continue;
      }
      try {
        const found: IndexSearchRow | null = 'id' in by ? await indexCourseById(by.id, token) : await indexCourseByNumber(by.number, token);
        if (found) return { kind: 'index', row: toRow(found) };
      } catch (error) {
        log.debug('Online Index lookup failed:', error instanceof Error ? error.message : error);
      }
    }
    return null;
  }

  /**
   * As {@link locate}, as a Yanhekt course row. An index answer is filled from
   * Yanhekt's `/v1/course` (no sign-in needed); if that fails, the index's own
   * name, teachers and term stand.
   */
  async findCourse(by: { id: string } | { number: string }, term: string | null, token: string | null): Promise<CourseData | null> {
    const found = await this.locate(by, term, token);
    if (!found) return null;
    if (found.kind === 'yanhekt') return found.course;
    return this.courseDataOf(found.row, token);
  }

  private async courseDataOf(row: CourseIndexRow, token: string | null): Promise<CourseData> {
    const [schoolYear = '', semester = ''] = /^(\d{4}-\d{4})-([12])$/.exec(row.term ?? '')?.slice(1) ?? [];
    const base: CourseData = {
      id: row.id,
      number: row.number ?? undefined,
      name_zh: row.name,
      professors: [...row.teachers],
      classrooms: [],
      school_year: schoolYear,
      semester,
      college_name: '',
      participant_count: 0,
    };
    try {
      const detail = await this.apiClient.getCourseDetail(row.id, token ?? '');
      return {
        ...base,
        name_zh: detail.title || base.name_zh,
        name_en: detail.title_en,
        professors: detail.professors && detail.professors.length > 0 ? [...detail.professors] : base.professors,
        college_name: detail.college_name ?? '',
        school_year: detail.school_year ?? base.school_year,
        semester: detail.semester != null ? String(detail.semester) : base.semester,
        image_url: detail.image_url,
      };
    } catch (error) {
      log.debug(`Course ${row.id} detail failed; using the index row`, error instanceof Error ? error.message : error);
      return base;
    }
  }
}
