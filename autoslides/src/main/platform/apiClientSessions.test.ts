import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('electron', () => ({ app: { getName: () => 'AutoSlides', getVersion: () => '0.0.0', isPackaged: false } }));
vi.mock('@main/infra/logger', () => ({ createLogger: () => ({ debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }) }));

import { ApiClient } from './apiClient';
import { clearIndexMemo } from './indexClient';

const ROW = {
  id: 850101,
  title: '第1周',
  week_number: 1,
  day: 3,
  started_at: '2025-09-17 09:55:00',
  ended_at: '2025-09-17 11:30:00',
  videos: [{ id: 450101, main: 'm.m3u8', vga: 'v.m3u8', duration: '5936' }],
};

function clientAnswering(byVersion: Record<'v1' | 'v2', unknown>) {
  const client = new ApiClient();
  const calls: string[] = [];
  const makeRequest = vi.fn(async (_method: string, url: string) => {
    calls.push(url);
    return url.includes('/v2/') ? byVersion.v2 : byVersion.v1;
  });
  (client as unknown as { makeRequest: typeof makeRequest }).makeRequest = makeRequest;
  return { client, calls };
}

describe('getCourseSessions', () => {
  it('uses /v2 when it has rows and never asks /v1', async () => {
    const { client, calls } = clientAnswering({ v2: { code: 0, data: [ROW] }, v1: { code: 0, data: [] } });
    const sessions = await client.getCourseSessions('70101', 'tok');
    expect(sessions.map((s) => s.session_id)).toEqual([850101]);
    expect(calls).toHaveLength(1);
  });

  it('falls back to the /v1 twin when /v2 is empty', async () => {
    const { client, calls } = clientAnswering({ v2: { code: 0, data: [] }, v1: { code: 0, data: [ROW] } });
    const sessions = await client.getCourseSessions('70101', 'tok');
    expect(calls[1]).toBe('https://cbiz.yanhekt.cn/v1/course/session/list?course_id=70101');
    expect(sessions[0]).toMatchObject({ session_id: 850101, video_id: 450101, duration: 5936, main_url: 'm.m3u8' });
  });

  it('returns [] when both are empty and the Index has no sessions', async () => {
    clearIndexMemo();
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ course: 70101, sessions: [] }))));
    const { client, calls } = clientAnswering({ v2: { code: 0, data: [] }, v1: { code: 0, data: [] } });
    expect(await client.getCourseSessions('70101', 'tok')).toEqual([]);
    expect(calls).toHaveLength(2);
    vi.unstubAllGlobals();
  });

  it('throws on a non-zero code from the fallback', async () => {
    const { client } = clientAnswering({ v2: { code: 0, data: [] }, v1: { code: 61101113, message: '用户未登录' } });
    await expect(client.getCourseSessions('70101', 'tok')).rejects.toThrow('用户未登录');
  });
});

describe('getLiveSessionId', () => {
  const answering = (body: unknown) => {
    const client = new ApiClient();
    const calls: string[] = [];
    (client as unknown as { makeRequest: (m: string, url: string) => Promise<unknown> }).makeRequest =
      async (_m, url) => { calls.push(url); return body; };
    return { client, calls };
  };

  it('reads session.id and the course number off /v1/live detail, with both with_* flags', async () => {
    const { client, calls } = answering({
      code: 0,
      data: { id: 788727, session: { id: 920698, course_id: 70101 }, course: { id: 70101, number: 'K-0001' } },
    });
    expect(await client.getLiveDetail('788727', 'tok')).toEqual({ sessionId: '920698', courseNumber: 'K-0001' });
    expect(calls[0]).toBe('https://cbiz.yanhekt.cn/v1/live?id=788727&with_session=true&with_course=true');
  });

  it('leaves out what is missing, and a number of another course', async () => {
    expect(await answering({ code: 12131011, message: '直播不存在' }).client.getLiveDetail('1', 'tok')).toBeNull();
    expect(await answering({ code: 0, data: { session: null, course: null } }).client.getLiveDetail('1', 'tok'))
      .toEqual({ sessionId: null, courseNumber: null });
    expect(await answering({
      code: 0, data: { session: { id: 1, course_id: 70101 }, course: { id: 70102, number: 'K-0002' } },
    }).client.getLiveDetail('1', 'tok')).toEqual({ sessionId: '1', courseNumber: null });
  });
});

describe('getCourseSessions → Index fallback', () => {
  const DETAIL = {
    id: 850102, course_id: 70101, title: '第2周', week_number: 2, day: '3',
    started_at: '2025-09-24 09:55:00', ended_at: '2025-09-24 11:30:00', video_ids: [450102],
  };

  function setup(indexAnswer: () => Promise<Response>, cbiz: (url: string) => unknown) {
    clearIndexMemo();
    const fetchMock = vi.fn(indexAnswer);
    vi.stubGlobal('fetch', fetchMock);
    const client = new ApiClient();
    const calls: Array<{ url: string; opts?: { allowAnonymous?: boolean } }> = [];
    (client as unknown as { makeRequest: unknown }).makeRequest = async (
      _m: string, url: string, _t: string, _d: unknown, opts?: { allowAnonymous?: boolean },
    ) => { calls.push({ url, opts }); return cbiz(url); };
    return { client, calls, fetchMock };
  }

  const json = (body: unknown, status = 200) =>
    async () => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

  afterEach(() => vi.unstubAllGlobals());

  it('reads the Index ids with the app User-Agent, then each session and its video', async () => {
    const { client, calls, fetchMock } = setup(json({ course: 70101, sessions: [850102] }), (url) => {
      if (url.includes('/session/list')) return { code: 0, data: [] };
      if (url.includes('session_id=850102')) return { code: 0, data: DETAIL };
      if (url.includes('/v1/video?id=450102')) return { code: 0, data: { id: 450102, main: 'm.m3u8', vga: 'v.m3u8', duration: '5936' } };
      throw new Error(`unexpected ${url}`);
    });

    const sessions = await client.getCourseSessions('70101', 'tok');

    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://share.ruc.edu.kg/api/courses/70101/sessions');
    expect((init.headers as Record<string, string>)['User-Agent']).toBe(`AutoSlides/0.0.0 (${({ win32: 'Windows', darwin: 'macOS', linux: 'Linux' } as Record<string, string>)[process.platform] ?? process.platform}; ${process.arch})`);
    expect(calls.filter((c) => !c.url.includes('/list')).every((c) => c.opts?.allowAnonymous)).toBe(true);
    expect(sessions).toEqual([
      expect.objectContaining({ session_id: '850102', video_id: '450102', duration: 5936, main_url: 'm.m3u8', vga_url: 'v.m3u8', day: 3 }),
    ]);
  });

  it('keeps only sessions with a stream (the Index also lists future sessions)', async () => {
    const { client, calls } = setup(json({ sessions: [1, 2, 3, 4] }), (url) => {
      if (url.includes('/session/list')) return { code: 0, data: [] };
      const sid = /session_id=(\d+)/.exec(url)?.[1];
      if (sid === '1') return { code: 0, data: { ...DETAIL, id: 1, video_ids: [10] } };
      if (sid === '2') return { code: 0, data: { ...DETAIL, id: 2, video_ids: [] } }; // future
      if (sid === '3') return { code: 0, data: { ...DETAIL, id: 3, video_ids: [30] } };
      if (sid === '4') return { code: 0, data: { ...DETAIL, id: 4, video_ids: [40] } };
      if (url.endsWith('id=10')) return { code: 0, data: { id: 10, vga: 'v.m3u8' } };
      if (url.endsWith('id=30')) return { code: 0, data: { id: 30, main: ' ', vga: '' } }; // no stream yet
      if (url.endsWith('id=40')) throw new Error('timeout');
      throw new Error(`unexpected ${url}`);
    });
    expect((await client.getCourseSessions('70101', 'tok')).map((s) => s.session_id)).toEqual(['1']);
    expect(calls.some((c) => c.url.includes('/v1/video?id=') && c.url.endsWith('=2'))).toBe(false);
  });

  it('drops sessions of another course and ones that fail to read', async () => {
    const { client } = setup(json({ sessions: [1, 2, 3] }), (url) => {
      if (url.includes('/session/list')) return { code: 0, data: [] };
      if (url.includes('session_id=1')) return { code: 0, data: { ...DETAIL, id: 1, video_ids: [10] } };
      if (url.includes('session_id=2')) return { code: 0, data: { ...DETAIL, id: 2, course_id: 99, video_ids: [20] } };
      if (url.includes('/v1/video?id=')) return { code: 0, data: { id: 1, main: 'm.m3u8' } };
      return { code: 12111010, message: 'gone' };
    });
    expect((await client.getCourseSessions('70101', 'tok')).map((s) => s.session_id)).toEqual(['1']);
  });

  it('answers [] when the Index fails (not JSON, 404, offline)', async () => {
    const list = () => ({ code: 0, data: [] });
    expect(await setup(async () => new Response('<html></html>', { status: 403 }), list).client.getCourseSessions('70101', 'tok')).toEqual([]);
    expect(await setup(json({ error: 'not-found' }, 404), list).client.getCourseSessions('70101', 'tok')).toEqual([]);
    expect(await setup(async () => { throw new TypeError('fetch failed'); }, list).client.getCourseSessions('70101', 'tok')).toEqual([]);
  });

  it('never asks the Index when a list has rows', async () => {
    const { client, fetchMock } = setup(json({ sessions: [] }), (url) =>
      url.includes('/v1/') ? { code: 0, data: [ROW] } : { code: 0, data: [] });
    expect(await client.getCourseSessions('70101', 'tok')).toHaveLength(1);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
