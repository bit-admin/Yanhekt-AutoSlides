/**
 * Reads and writes the course notes of one account (`@common/courseCloud`).
 * Every call takes the account's token, so a run cannot cross an account
 * switch. Notes in these groups that AutoSlides did not write are left alone.
 */
import {
  COURSE_CLOUD_GROUPS,
  courseCloudKey,
  decodeCourseTitle,
  type CloudCourse,
  type CourseCloudKind,
} from '@common/courseCloud';
import { createLogger } from '@main/infra/logger';
import type { IntranetApiTransport } from '../intranetApiTransport';
import { planCloudWrites, type CloudNote } from './courseCloudPlan';

const log = createLogger('CourseCloud');

const BASE = 'https://cbiz.yanhekt.cn';
const TIMEOUT_MS = 15000;
const PAGE_SIZE = 500;
const MAX_PAGES = 20;
/** Writes one run makes at most; the rest go out with the next sync. */
const MAX_WRITES = 30;

export interface CloudSnapshot {
  /** The group's id, null when the account does not have it yet. */
  groupId: number | null;
  notes: CloudNote[];
}

interface Envelope<T> {
  code: number;
  message?: string;
  data: T;
}

interface NoteRow {
  id: number;
  title: string;
  note_group_id: number;
  deleted?: number;
}

export class CourseCloudStore {
  constructor(
    private readonly configService: { getCourseCloudSync(): boolean },
    private readonly transport: Pick<IntranetApiTransport, 'send'>,
  ) {}

  enabled(): boolean {
    return this.configService.getCourseCloudSync();
  }

  /** The group's courses. Throws when the list could not be read whole. */
  async read(token: string, kind: CourseCloudKind): Promise<CloudSnapshot> {
    const groupIds = await this.groupIds(token, kind);
    if (!groupIds.length) return { groupId: null, notes: [] };
    const inGroup = new Set(groupIds);
    const notes: CloudNote[] = [];
    for (let page = 1; ; page++) {
      const qs = new URLSearchParams({
        with_brief: 'false',
        keyword: '',
        page: String(page),
        page_size: String(PAGE_SIZE),
        with_page: 'true',
      });
      const result = await this.request<{ data: NoteRow[]; last_page: number }>(token, 'GET', `/v1/note/list?${qs}`);
      for (const row of result.data ?? []) {
        if (row.deleted || !inGroup.has(row.note_group_id)) continue;
        const course = decodeCourseTitle(row.title);
        if (course) notes.push({ id: row.id, rawTitle: row.title, course });
      }
      const last = Number(result.last_page) || 1;
      // A partial list would read as courses removed on another computer.
      if (last > MAX_PAGES) throw new Error('Note list is too long to read whole');
      if (page >= last) break;
    }
    return { groupId: groupIds[0], notes };
  }

  /**
   * Make the group hold `wanted`, within the write budget. Returns the keys
   * the group holds afterwards. A failed write stays for the next sync.
   */
  async reconcile(
    token: string,
    kind: CourseCloudKind,
    wanted: CloudCourse[],
    snapshot?: CloudSnapshot,
  ): Promise<string[]> {
    const current = snapshot ?? await this.read(token, kind);
    const plan = planCloudWrites(current.notes, wanted);
    const held = new Set(plan.unchanged);
    const keyOfNote = (id: number) => current.notes.find((n) => n.id === id);
    let budget = MAX_WRITES;

    let groupId = current.groupId;
    if (groupId === null && plan.create.length) {
      await this.request(token, 'POST', '/v1/note/group', { name: COURSE_CLOUD_GROUPS[kind] });
      [groupId] = await this.groupIds(token, kind);
      if (!groupId) throw new Error('Created note group was not listed');
    }

    for (const item of plan.retitle) {
      const old = keyOfNote(item.id);
      if (budget-- <= 0) {
        if (old) held.add(item.key);
        continue;
      }
      try {
        await this.request(token, 'PUT', '/v1/note', { id: item.id, title: item.title });
      } catch (error) {
        log.warn('Course note update failed:', message(error));
      }
      held.add(item.key);
    }

    for (const item of plan.create) {
      if (budget-- <= 0) break;
      if (await this.createNote(token, groupId as number, item.title)) held.add(item.key);
    }

    // A note still there stays in the result: left out, the next sync would
    // read it as a course added elsewhere and bring back what was just removed.
    for (const id of plan.remove) {
      let gone = false;
      if (budget-- > 0) {
        try {
          await this.request(token, 'DELETE', '/v1/note', { id });
          gone = true;
        } catch (error) {
          log.warn('Course note delete failed:', message(error));
        }
      }
      const note = keyOfNote(id);
      if (!gone && note) held.add(courseCloudKey(note.course));
    }
    return [...held];
  }

  private async createNote(token: string, groupId: number, title: string): Promise<boolean> {
    let id: number | null = null;
    try {
      ({ id } = await this.request<{ id: number }>(token, 'POST', '/v1/note', { content: '', version: 2 }));
      await this.request(token, 'PUT', '/v1/note', { id, title, note_group_id: groupId });
      return true;
    } catch (error) {
      log.warn('Course note create failed:', message(error));
      // Do not leave a blank note in the student's list.
      if (id !== null) await this.request(token, 'DELETE', '/v1/note', { id }).catch(() => undefined);
      return false;
    }
  }

  /** Ids of the groups with this name, oldest first (two computers may each create one). */
  private async groupIds(token: string, kind: CourseCloudKind): Promise<number[]> {
    const groups = await this.request<Array<{ id: number; name: string }>>(
      token,
      'GET',
      '/v1/note/group/list?with_note=false',
    );
    return (Array.isArray(groups) ? groups : [])
      .filter((g) => g.name === COURSE_CLOUD_GROUPS[kind])
      .map((g) => g.id)
      .sort((a, b) => a - b);
  }

  private async request<T>(token: string, method: string, path: string, data?: Record<string, unknown>): Promise<T> {
    const res = await this.transport.send<Envelope<T>>({
      method,
      url: `${BASE}${path}`,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        Accept: 'application/json, text/plain, */*',
        Origin: 'https://www.yanhekt.cn',
        Referer: 'https://www.yanhekt.cn/',
        'Xdomain-Client': 'web_user',
      },
      data,
      timeout: TIMEOUT_MS,
      validateStatus: () => true,
    });
    if (res.status < 200 || res.status >= 300) throw new Error(`Note API ${res.status}: ${method}`);
    const payload = res.data;
    if (!payload || typeof payload !== 'object') throw new Error(`Note API returned no data: ${method}`);
    if (payload.code !== 0) throw new Error(`Note API code ${payload.code}: ${method}`);
    return payload.data;
  }
}

const message = (error: unknown): string => (error instanceof Error ? error.message : String(error));
