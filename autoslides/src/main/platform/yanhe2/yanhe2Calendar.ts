/**
 * Yanhe 2.0 Calendar reads: the school day (`search-role-course-list`) and the
 * account's own week (`get-week-schedules`).
 *
 * On aita a GET is not always a read (`course-collect/down` adds a favorite),
 * so nothing here builds a URL from a caller's path: `READ_PATHS` is the whole
 * list of what this module may request.
 *
 * Response bodies carry teacher badges and more than the page needs. Only the
 * parsed rows leave this module, and bodies are never logged.
 */
import { YANHE2_ORIGIN, YANHE2_TENANT_ID } from '@common/yanhe2';
import {
  shiftDate,
  toSearchTime,
  type Yanhe2CalendarDay,
  type Yanhe2CalendarPeriod,
  type Yanhe2CalendarSession,
  type Yanhe2ScheduleDay,
  type Yanhe2SessionStatus,
} from '@common/yanhe2Calendar';

const READ_PATHS = {
  dayList: '/courseapi/v3/course-live-role/search-role-course-list',
  weekSchedule: '/courseapi/v2/schedule/get-week-schedules',
} as const;

const TIMEOUT_MS = 20_000;

export type Yanhe2Fetched<T> =
  | { kind: 'ok'; data: T }
  /** 401/403: the token is not accepted. */
  | { kind: 'rejected' }
  | { kind: 'network' }
  | { kind: 'failed' };

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

const statusOf = (value: unknown): Yanhe2SessionStatus => STATUS[text(value)] ?? 'unknown';

function daySession(row: Row): Yanhe2CalendarSession | null {
  const courseId = text(row.course_id) || text(row.id);
  const subId = text(row.sub_id);
  if (!courseId || !subId) return null;
  return {
    courseId,
    subId,
    title: text(row.title),
    subTitle: text(row.sub_title),
    teacher: text(row.lecturer_name) || text(row.realname),
    room: text(row.room_name),
    college: text(row.kkxy_name),
    courseCode: text(row.course_code),
    startAt: seconds(row.start_at),
    endAt: seconds(row.end_at),
    status: statusOf(row.sub_status ?? row.status),
  };
}

/**
 * `{code:0, total, list}` where `list` is the day's periods and each period's
 * own `list` is its sessions. Asked without a period, every period comes back
 * filled. Asked for one period, the other headers come back empty, which is
 * "not asked", not "no classes" — `loaded` keeps the two apart.
 */
export function parseDayList(body: unknown, periodId?: number): Yanhe2CalendarDay | null {
  if (!isRow(body) || body.code !== 0 || !Array.isArray(body.list)) return null;
  const periods: Yanhe2CalendarPeriod[] = [];
  let rows = 0;
  for (const entry of body.list) {
    if (!isRow(entry)) continue;
    const id = Number(entry.id);
    if (!Number.isInteger(id)) continue;
    const sessions = (Array.isArray(entry.list) ? entry.list : [])
      .filter(isRow)
      .map(daySession)
      .filter((s): s is Yanhe2CalendarSession => s !== null)
      .sort((a, b) => a.startAt - b.startAt || a.title.localeCompare(b.title, 'zh'));
    rows += sessions.length;
    periods.push({
      id,
      name: text(entry.name),
      beginTime: text(entry.class_begin_time).slice(0, 5),
      endTime: text(entry.class_end_time).slice(0, 5),
      sessions,
      loaded: false,
    });
  }
  // `total` counts sessions. A whole-day answer that holds fewer rows than it
  // says was cut down to some periods, so its empty ones still need asking.
  const total = Number(body.total);
  const whole = periodId === undefined && !(Number.isFinite(total) && rows < total);
  for (const period of periods) {
    period.loaded = whole || period.sessions.length > 0 || period.id === periodId;
  }
  return { periods };
}

/**
 * `{success, result:{code:200, list}}`: one entry per day, `course: []` on a
 * free day. A range with no class at all is not an empty list but
 * `{success:true, result:{code:400, msg:"课表为空"}}` — a normal answer, read
 * here as no days.
 */
export function parseWeekSchedule(body: unknown): Yanhe2ScheduleDay[] | null {
  if (!isRow(body) || body.success !== true || !isRow(body.result)) return null;
  if (body.result.code === 400 && body.result.list === undefined) return [];
  if (body.result.code !== 200 || !Array.isArray(body.result.list)) return null;
  const days: Yanhe2ScheduleDay[] = [];
  for (const entry of body.result.list) {
    if (!isRow(entry)) continue;
    const day = text(entry.day);
    if (!day) continue;
    const sessions: Yanhe2CalendarSession[] = [];
    for (const row of Array.isArray(entry.course) ? entry.course : []) {
      if (!isRow(row)) continue;
      // Here `id` is the session, not the course.
      const subId = text(row.id);
      const courseId = text(row.course_id);
      if (!subId || !courseId) continue;
      sessions.push({
        courseId,
        subId,
        title: text(row.course_title),
        subTitle: '',
        teacher: text(row.lecturer_name) || text(row.teacher_name),
        room: text(row.room_name),
        college: '',
        courseCode: '',
        startAt: seconds(row.start_at),
        endAt: seconds(row.end_at),
        status: statusOf(row.status),
      });
    }
    sessions.sort((a, b) => a.startAt - b.startAt);
    days.push({ day, sessions });
  }
  return days.sort((a, b) => a.day.localeCompare(b.day));
}

/** Every day from `startDate` to `endDate`, so a free day (or a whole free week) still has its entry. */
export function fillScheduleDays(days: Yanhe2ScheduleDay[], startDate: string, endDate: string): Yanhe2ScheduleDay[] {
  const byDay = new Map(days.map((d) => [d.day, d]));
  const out: Yanhe2ScheduleDay[] = [];
  for (let day = startDate; day <= endDate; day = shiftDate(day, 1)) {
    out.push(byDay.get(day) ?? { day, sessions: [] });
  }
  return out;
}

async function read(
  jwt: string,
  path: (typeof READ_PATHS)[keyof typeof READ_PATHS],
  params: Record<string, string>,
): Promise<Yanhe2Fetched<unknown>> {
  const url = new URL(path, YANHE2_ORIGIN);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  let response: Response;
  try {
    response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${jwt}`,
        Accept: 'application/json',
        'tenant-id': String(YANHE2_TENANT_ID),
      },
      redirect: 'manual',
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch {
    return { kind: 'network' };
  }
  // A bad or expired token is a bare 403 with an empty body.
  if (response.status === 401 || response.status === 403) return { kind: 'rejected' };
  if (!response.ok) return { kind: 'failed' };
  try {
    return { kind: 'ok', data: await response.json() };
  } catch {
    return { kind: 'failed' };
  }
}

export async function fetchYanhe2Day(
  jwt: string,
  query: { date: string; keyword: string; periodId?: number },
): Promise<Yanhe2Fetched<Yanhe2CalendarDay>> {
  // Same flags the site's own calendar sends. `like_title` only filters; unlike
  // the header search it leaves no search-history entry.
  const params: Record<string, string> = {
    search_time: toSearchTime(query.date),
    tenant: String(YANHE2_TENANT_ID),
    need_time_quantum: '1',
    unique_course: '1',
    with_sub_duration: '1',
    with_sub_data: '1',
    has_frame: '1',
    nteacher: '0',
  };
  if (query.keyword) params.like_title = query.keyword;
  if (query.periodId !== undefined) params.quantum_id = String(query.periodId);

  const fetched = await read(jwt, READ_PATHS.dayList, params);
  if (fetched.kind !== 'ok') return fetched;
  const data = parseDayList(fetched.data, query.periodId);
  return data ? { kind: 'ok', data } : { kind: 'failed' };
}

export async function fetchYanhe2Week(
  jwt: string,
  query: { userId: number; tenantId: number; startDate: string; endDate: string },
): Promise<Yanhe2Fetched<Yanhe2ScheduleDay[]>> {
  // The site also puts the JWT in `?token=`. The bearer is enough, and a query
  // string ends up in logs and proxies.
  const fetched = await read(jwt, READ_PATHS.weekSchedule, {
    user_id: String(query.userId),
    tenant_id: String(query.tenantId),
    start_at: query.startDate,
    end_at: query.endDate,
  });
  if (fetched.kind !== 'ok') return fetched;
  const data = parseWeekSchedule(fetched.data);
  return data ? { kind: 'ok', data: fillScheduleDays(data, query.startDate, query.endDate) } : { kind: 'failed' };
}
