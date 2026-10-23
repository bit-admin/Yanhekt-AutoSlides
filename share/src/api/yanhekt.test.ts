import { beforeEach, describe, expect, it } from 'vitest';
import type { Env } from '../lib/runtime';
import { addCourse, testDb, type TestDb } from './testDb';
import { courseDetails, PLACEHOLDER_TOKEN, SESSION_BATCH, sessionDetails, sessionFromRaw } from './yanhekt';

let db: TestDb;
let seen: Array<{ path: string; auth: string | null }>;
/** Yanhekt as the web Worker's proxy would relay it: path → envelope, or an HTTP status for a failure. */
let answers: Record<string, unknown>;

const web = {
  fetch: async (req: Request) => {
    const u = new URL(req.url);
    seen.push({ path: u.pathname + u.search, auth: req.headers.get('Authorization') });
    const a = answers[u.pathname.replace(/^\/api\/yanhekt/, '') + u.search];
    if (typeof a === 'number') return new Response('upstream', { status: a });
    if (a === OUTAGE) return Response.json(OUTAGE);
    if (a === undefined) return Response.json({ code: 12111010, message: '课程信息不存在', data: null });
    return Response.json({ code: 0, message: '', data: a });
  },
};
/** Yanhekt's gateway failure, verbatim: an HTTP 200 envelope, not a missing record. */
const OUTAGE = { code: 99151011, message: 'failed to invoke service', displayable: false, data: [], module: 'frame_client_request' };
const env = (bound = true) => ({ YANHEKT_DB: db, WEB: bound ? web : undefined }) as unknown as Env;
const sessionPath = (id: number) => `/v1/course/session?session_id=${id}&with_video=true`;

beforeEach(() => {
  db = testDb();
  seen = [];
  answers = {};
  addCourse(db, { id: 12345, name: '电路分析基础', sessions: [100101, 100102, 100103] });
});

describe('course details', () => {
  it('reads /v1/course through the web binding with the placeholder token, trimmed', async () => {
    answers['/v1/course?id=12345'] = {
      id: 12345,
      name_zh: '电路分析基础',
      name_en: '',
      college_name: '',
      college: { name: '信息与电子学院', name_en: 'School of Information and Electronics', image_url: 'https://coss.yanhekt.cn/images/colleges/xinxi.png' },
      image_url: '',
      professors: [{ name: '周五' }, '周五'],
      code: '1000001',
      type_name: '研究生课程',
      tags: [{ param: 'colleges', name: '信息与电子学院' }, { param: 'degrees', name: '研究生' }],
    };
    expect(await courseDetails(env(), 12345)).toEqual({
      id: 12345,
      nameZh: '电路分析基础',
      nameEn: null,
      code: '1000001',
      level: '研究生',
      college: '信息与电子学院',
      collegeEn: 'School of Information and Electronics',
      image: 'https://coss.yanhekt.cn/images/colleges/xinxi.png',
      teachers: ['周五'],
    });
    expect(seen).toEqual([{ path: '/api/yanhekt/v1/course?id=12345', auth: `Bearer ${PLACEHOLDER_TOKEN}` }]);
  });

  it('refuses a course the index does not hold without asking Yanhekt', async () => {
    expect(await courseDetails(env(), 1)).toMatchObject({ error: 'not-found' });
    expect(seen).toEqual([]);
  });

  it('tells an outage from a missing course, and a missing binding from both', async () => {
    expect(await courseDetails(env(), 12345)).toMatchObject({ error: 'not-found' });
    answers['/v1/course?id=12345'] = 502;
    expect(await courseDetails(env(), 12345)).toMatchObject({ error: 'yanhekt-unavailable' });
    expect(await courseDetails(env(false), 12345)).toMatchObject({ error: 'yanhekt-not-configured' });
  });

  it('treats the gateway failure envelope as an outage, not a missing course', async () => {
    answers['/v1/course?id=12345'] = OUTAGE;
    expect(await courseDetails(env(), 12345)).toMatchObject({ error: 'yanhekt-unavailable' });
  });
});

describe('session details', () => {
  it('reads each indexed session in index order and marks the ones Yanhekt lost', async () => {
    answers[sessionPath(100101)] = {
      id: 100101,
      course_id: 12345,
      title: '第1周 星期一 第1大节',
      week_number: 1,
      day: 1,
      started_at: '2026-09-07 08:00:00',
      ended_at: '2026-09-07 09:35:00',
      video_ids: [500001],
      live: { subtitle: '综教A101', target: 'https://clive8.yanhekt.cn/live/x.m3u8' },
      user_progress: [],
    };
    answers[sessionPath(100102)] = { id: 100102, course_id: 1, title: 'elsewhere' };
    answers[sessionPath(100103)] = 500;
    const page = await sessionDetails(env(), 12345, 0);
    expect(page).toEqual({
      course: 12345,
      total: 3,
      from: 0,
      next: null,
      sessions: [
        {
          id: 100101,
          title: '第1周 星期一 第1大节',
          week: 1,
          day: 1,
          startedAt: '2026-09-07 08:00:00',
          endedAt: '2026-09-07 09:35:00',
          room: '综教A101',
          recorded: true,
        },
        { id: 100102, error: 'gone' },
        { id: 100103, error: 'unavailable' },
      ],
    });
    expect(new Set(seen.map((s) => s.auth))).toEqual(new Set([`Bearer ${PLACEHOLDER_TOKEN}`]));
  });

  it('pages in batches', async () => {
    const ids = Array.from({ length: SESSION_BATCH + 5 }, (_, i) => 800000 + i);
    addCourse(db, { id: 5, name: '长课', sessions: ids });
    for (const id of ids) answers[sessionPath(id)] = { id, course_id: 5 };
    const first = await sessionDetails(env(), 5, 0);
    expect(first).toMatchObject({ total: ids.length, from: 0, next: SESSION_BATCH });
    expect(seen).toHaveLength(SESSION_BATCH);
    const second = await sessionDetails(env(), 5, SESSION_BATCH);
    expect(second).toMatchObject({ from: SESSION_BATCH, next: null });
    expect('sessions' in second && second.sessions.map((s) => s.id)).toEqual(ids.slice(SESSION_BATCH));
  });

  it('answers an outage when no session could be read', async () => {
    for (const id of [100101, 100102, 100103]) answers[sessionPath(id)] = 503;
    expect(await sessionDetails(env(), 12345, 0)).toMatchObject({ error: 'yanhekt-unavailable' });
  });

  it('treats the gateway failure envelope as an outage, not as gone sessions', async () => {
    for (const id of [100101, 100102, 100103]) answers[sessionPath(id)] = OUTAGE;
    expect(await sessionDetails(env(), 12345, 0)).toMatchObject({ error: 'yanhekt-unavailable' });
    answers[sessionPath(100101)] = { id: 100101, course_id: 12345 };
    const page = await sessionDetails(env(), 12345, 0);
    expect('sessions' in page && page.sessions.slice(1)).toEqual([
      { id: 100102, error: 'unavailable' },
      { id: 100103, error: 'unavailable' },
    ]);
  });

  it('keeps only well-formed fields', () => {
    expect(sessionFromRaw(1, { day: '9', started_at: 'soon', video_ids: [] })).toEqual({
      id: 1,
      title: null,
      week: null,
      day: null,
      startedAt: null,
      endedAt: null,
      room: null,
      recorded: false,
    });
  });
});
