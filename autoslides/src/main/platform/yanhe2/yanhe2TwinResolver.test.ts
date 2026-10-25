import { describe, expect, it, vi } from 'vitest';

vi.mock('@main/infra/logger', () => ({ createLogger: () => ({ debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }) }));

import { twinMetadataSource, Yanhe2TwinResolver } from './yanhe2TwinResolver';
import { yanhe2SessionTitle } from './yanhe2Twin';

// 2026-09-21 15:15 Beijing.
const START = Date.UTC(2026, 8, 21, 7, 15) / 1000;
const KEY = { courseCode: 'K-0001', startAt: START, term: '2026-2027-1', courseTitle: '泛函分析', sessionTitle: '2026-09-21 第8-10节' };
const COURSE = { id: 80101, number: 'K-0001', name_zh: '泛函分析（Yanhekt）' };
const SESSION = { session_id: 900101, title: '第4周 星期一 第5大节', started_at: '2026-09-21 15:15:00' };

function resolver(options: { token?: string; courses?: unknown[]; sessions?: unknown[]; listError?: unknown } = {}) {
  const yanhe2Service = { getTwinKey: vi.fn(async () => ({ kind: 'ok', data: KEY })) };
  const apiClient = {
    getCourseList: vi.fn(async () => {
      if (options.listError) throw options.listError;
      return { data: options.courses ?? [COURSE] };
    }),
    getCourseSessions: vi.fn(async () => options.sessions ?? [SESSION]),
  };
  const configService = { getAuthToken: () => ('token' in options ? options.token : 'cbiz-token') };
  // As CourseLookup does for the current term with the Yanhekt source: the list, the code checked.
  const courseLookup = {
    findCourse: vi.fn(async (by: { number: string }, _term: string | null, token: string | null) => {
      if (!token) return null;
      const listed = await apiClient.getCourseList();
      const rows = (listed.data as Array<{ number?: string }>).filter((row) => row.number === by.number);
      return rows.length === 1 ? rows[0] : null;
    }),
  };
  lastLookup = courseLookup;
  return new Yanhe2TwinResolver(yanhe2Service as never, apiClient as never, configService as never, courseLookup as never);
}

let lastLookup: { findCourse: ReturnType<typeof vi.fn> } | null = null;

const query = { courseId: '1', subId: '2' };

describe('yanhe2SessionTitle', () => {
  it('is the Beijing date and the lessons, never the date twice', () => {
    // aita's own sub_title shape: the date is already in it.
    expect(yanhe2SessionTitle(START, '2026-09-21第8-10节')).toBe('2026-09-21 第8-10节');
    expect(yanhe2SessionTitle(START, '2026-09-21第3节')).toBe('2026-09-21 第3节');
    expect(yanhe2SessionTitle(0, '2026-09-21第8-10节')).toBe('第8-10节');
    // No lessons to read: as sent, else the date.
    expect(yanhe2SessionTitle(START, '专题讲座')).toBe('专题讲座');
    expect(yanhe2SessionTitle(START, '')).toBe('2026-09-21');
  });
});

describe('Yanhe2TwinResolver.find', () => {
  it('names the Yanhekt course and session when both are found', async () => {
    const found = await resolver().find('1120000000', query);
    // The course is looked up by code, in the Yanhe 2.0 course's own term.
    expect(lastLookup?.findCourse).toHaveBeenCalledWith({ number: 'K-0001' }, '2026-2027-1', 'cbiz-token');
    expect(found.kind === 'ok' && found.data.target).toEqual({
      courseId: '80101', courseTitle: '泛函分析（Yanhekt）', sessionId: '900101', sessionTitle: '第4周 星期一 第5大节',
    });
  });

  it('drops the session id and keeps the course when Yanhekt has no session at that time', async () => {
    const found = await resolver({ sessions: [] }).find('1120000000', query);
    expect(found.kind === 'ok' && found.data.target).toEqual({
      courseId: '80101', courseTitle: '泛函分析（Yanhekt）', sessionId: '', sessionTitle: '2026-09-21 第8-10节',
    });
  });

  it('falls back to Yanhe 2.0 titles and no ids when the course is missing or Yanhekt is signed out', async () => {
    const expected = { courseId: '', courseTitle: '泛函分析', sessionId: '', sessionTitle: '2026-09-21 第8-10节' };
    const missing = await resolver({ courses: [] }).find('1120000000', query);
    expect(missing.kind === 'ok' && missing.data.target).toEqual(expected);
    const signedOut = await resolver({ token: '' }).find('1120000000', query);
    expect(signedOut.kind === 'ok' && signedOut.data.target).toEqual(expected);
  });

  it('stops on a network failure rather than dropping the ids', async () => {
    const error = Object.assign(new Error('socket hang up'), { isAxiosError: true });
    expect(await resolver({ listError: error }).find('1120000000', query)).toEqual({ kind: 'network' });
  });
});

describe('twinMetadataSource', () => {
  it('keeps the registrar number from Yanhe 2.0, with or without the Yanhekt course', async () => {
    const found = await resolver().find('1120000000', query);
    expect(found.kind).toBe('ok');
    if (found.kind !== 'ok') return;
    expect(found.data.courseNumber).toBe('K-0001');
    expect(twinMetadataSource(found.data)).toMatchObject({
      courseId: '80101', courseNumber: 'K-0001', sessionId: '900101', sessionTitle: '第4周 星期一 第5大节',
    });

    const missing = await resolver({ courses: [] }).find('1120000000', query);
    if (missing.kind !== 'ok') throw new Error('expected ok');
    expect(twinMetadataSource(missing.data)).toEqual({
      courseTitle: '泛函分析', courseNumber: 'K-0001', sessionTitle: '2026-09-21 第8-10节',
    });
  });

  it("falls back to the Yanhekt course's number when Yanhe 2.0 gave none", () => {
    const source = twinMetadataSource({
      course: COURSE as never,
      session: null,
      target: { courseId: '80101', courseTitle: '泛函分析', sessionId: '', sessionTitle: '2026-09-21 第8-10节' },
      courseNumber: '',
    });
    expect(source.courseNumber).toBe('K-0001');
    expect(source.sessionId).toBeUndefined();
  });
});
