/**
 * The registrar's course number of a Yanhekt course, by course id.
 *
 * `metadata.json` keeps the number (Yanhekt `number`, Yanhe 2.0 `kcwybm`) for
 * every extraction, but most writers only hold the course id: the renderer's
 * `Course` does not carry `number`, nor do pins, live rows or download rows.
 * So the metadata writer asks here and adds it afterwards. The course is found
 * by id where Settings → General → Search says to look (`CourseLookup.locate`:
 * Yanhekt's list for the current term, the course index on this computer or
 * online for any term); answers are remembered for the session.
 */
import type { ConfigService } from './configService';
import type { CourseLookup } from './courseIndex/courseLookup';
import { createLogger } from '@main/infra/logger';

const log = createLogger('CourseNumber');

export class CourseNumberLookup {
  /** Course id → its number ('' when it has none). Failures are not kept. */
  private readonly known = new Map<string, Promise<string>>();

  constructor(
    private readonly courseLookup: CourseLookup,
    private readonly configService: ConfigService,
  ) {}

  /** The number, or null when it cannot be had now (no sign-in, no answer, no such course). */
  async numberOf(courseId: string): Promise<string | null> {
    if (!/^\d{1,12}$/.test(courseId)) return null;
    // The lookups behind it are for signed-in users only.
    const token = this.configService.getAuthToken();
    if (!token) return null;

    let pending = this.known.get(courseId);
    if (!pending) {
      pending = this.ask(courseId, token);
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

  private async ask(courseId: string, token: string): Promise<string> {
    const found = await this.courseLookup.locate({ id: courseId }, null, token);
    if (!found) throw new Error(`course ${courseId} not found`);
    const value = found.kind === 'yanhekt' ? found.course.number : found.row.number;
    return value === undefined || value === null ? '' : String(value);
  }
}
