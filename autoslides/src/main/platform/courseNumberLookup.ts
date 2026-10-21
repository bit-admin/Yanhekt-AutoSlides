/**
 * The registrar's course number of a Yanhekt course, by course id.
 *
 * `metadata.json` keeps the number (Yanhekt `number`, Yanhe 2.0 `kcwybm`) for
 * every extraction, but most writers only hold the course id: the renderer's
 * `Course` does not carry `number`, nor do pins, live rows or download rows.
 * So the metadata writer asks here and adds it afterwards. One list call
 * (`/v2/course/list?keyword=<id>`, the same one the course-twin lookup uses),
 * the id checked on the row, answers remembered for the session.
 */
import type { ApiClient } from './apiClient';
import type { ConfigService } from './configService';
import { createLogger } from '@main/infra/logger';

const log = createLogger('CourseNumber');

export class CourseNumberLookup {
  /** Course id → its number ('' when Yanhekt has none). Failures are not kept. */
  private readonly known = new Map<string, Promise<string>>();

  constructor(
    private readonly apiClient: ApiClient,
    private readonly configService: ConfigService,
  ) {}

  /** The number, or null when it cannot be had now (no sign-in, no answer, no such course). */
  async numberOf(courseId: string): Promise<string | null> {
    if (!/^\d{1,12}$/.test(courseId)) return null;
    const token = this.configService.getAuthToken();
    if (!token) return null;

    let pending = this.known.get(courseId);
    if (!pending) {
      pending = this.ask(token, courseId);
      this.known.set(courseId, pending);
      pending.catch(() => this.known.delete(courseId));
    }
    try {
      return (await pending) || null;
    } catch (error) {
      log.debug('Course number lookup failed:', error instanceof Error ? error.message : error);
      return null;
    }
  }

  private async ask(token: string, courseId: string): Promise<string> {
    // The keyword also matches numbers, codes and teacher badges, so the id is checked.
    const listed = await this.apiClient.getCourseList(token, { keyword: courseId, page: 1, pageSize: 16 });
    const row = (listed.data ?? []).find((course) => String(course.id) === courseId);
    const value = row?.number;
    return value === undefined || value === null ? '' : String(value);
  }
}
