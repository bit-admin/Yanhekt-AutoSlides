/**
 * Finds the Yanhekt lecture a Yanhe 2.0 session is, for anything that files
 * Yanhe 2.0 material under Yanhekt's ids and titles (saved slides, downloaded
 * subtitles). The rule and the pure pickers are in `yanhe2Twin.ts`; this is
 * the part that asks the two sites.
 *
 * It declines rather than guesses: no Yanhekt sign-in, no course with that
 * number, or no session at that start time is an answer of its own.
 */
import axios from 'axios';
import type { CourseData, SessionData } from '@common/apiTypes';
import type { ApiClient } from '../apiClient';
import type { ConfigService } from '../configService';
import { createLogger } from '@main/infra/logger';
import type { Yanhe2Service } from './yanhe2Service';
import { pickTwinCourse, pickTwinSession } from './yanhe2Twin';

const log = createLogger('Yanhe2Twin');

/** The Yanhekt course row and session a Yanhe 2.0 session matched. */
export interface Yanhe2Twin {
  course: CourseData;
  session: SessionData;
}

export type Yanhe2TwinFound =
  | { kind: 'ok'; data: Yanhe2Twin }
  /** No live Yanhe 2.0 session for that account. */
  | { kind: 'signed_out' }
  /** Not signed in to Yanhekt, so its session list cannot be read. */
  | { kind: 'yanhekt_signed_out' }
  /** Yanhekt has no course with that number, or no session at that time. */
  | { kind: 'no_match' }
  | { kind: 'network' }
  | { kind: 'failed' };

export class Yanhe2TwinResolver {
  constructor(
    private readonly yanhe2Service: Yanhe2Service,
    private readonly apiClient: ApiClient,
    private readonly configService: ConfigService,
  ) {}

  /** `query` is the renderer's `{ courseId, subId }` (aita ids), checked by the service. */
  async find(account: string, query: unknown): Promise<Yanhe2TwinFound> {
    const key = await this.yanhe2Service.getTwinKey(account, query);
    if (key.kind !== 'ok') return { kind: key.kind };
    if (!key.data.courseCode || !key.data.startAt) return { kind: 'no_match' };

    // The session list is empty without a sign-in, which would read as "no match".
    const token = this.configService.getAuthToken();
    if (!token) return { kind: 'yanhekt_signed_out' };

    try {
      const listed = await this.apiClient.getCourseList(token, { keyword: key.data.courseCode, page: 1, pageSize: 16 });
      const course = pickTwinCourse(listed.data ?? [], key.data.courseCode);
      if (!course) return { kind: 'no_match' };
      const sessions = await this.apiClient.getCourseSessions(String(course.id), token);
      const session = pickTwinSession(sessions, key.data.startAt);
      return session ? { kind: 'ok', data: { course, session } } : { kind: 'no_match' };
    } catch (error) {
      if (axios.isAxiosError(error) && !error.response) return { kind: 'network' };
      log.warn('Yanhekt lookup for a Yanhe 2.0 session failed:', error instanceof Error ? error.message : error);
      return { kind: 'failed' };
    }
  }
}
