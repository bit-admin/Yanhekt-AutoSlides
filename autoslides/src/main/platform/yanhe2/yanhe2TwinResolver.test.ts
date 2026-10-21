import { describe, expect, it, vi } from 'vitest';

vi.mock('@main/infra/logger', () => ({ createLogger: () => ({ debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }) }));

import { Yanhe2TwinResolver } from './yanhe2TwinResolver';
import { yanhe2SessionTitle } from './yanhe2Twin';

// 2026-09-21 15:15 Beijing.
const START = Date.UTC(2026, 8, 21, 7, 15) / 1000;
const KEY = { courseCode: 'K-0001', startAt: START, courseTitle: '泛函分析', sessionTitle: '2026-09-21 第8-10节' };
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
  return new Yanhe2TwinResolver(yanhe2Service as never, apiClient as never, configService as never);
}

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
