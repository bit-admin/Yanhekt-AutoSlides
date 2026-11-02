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

  it.each([12121028, '12121028'])('tries /v1 when /v2 reports expiry code %s', async (code) => {
    const { client, calls } = clientAnswering({ v2: { code, message: '课程已过期' }, v1: { code: 0, data: [ROW] } });
    const sessions = await client.getCourseSessions('70101', 'tok');
    expect(sessions[0]).toMatchObject({ session_id: 850101, main_url: 'm.m3u8', vga_url: 'v.m3u8' });
    expect(calls).toEqual([
      'https://cbiz.yanhekt.cn/v2/course/session/list?course_id=70101',
      'https://cbiz.yanhekt.cn/v1/course/session/list?course_id=70101',
    ]);
  });

  it('does not hide expiry from /v1 or fall through to the Index', async () => {
    const { client } = clientAnswering({ v2: { code: 12121028, message: '课程已过期' }, v1: { code: 12121028, message: '课程已过期' } });
    const index = vi.fn(async () => []);
    client.setSessionIdSource(index);
    await expect(client.getCourseSessions('70101', 'tok')).rejects.toThrow('课程已过期');
    expect(index).not.toHaveBeenCalled();
  });

  it.each([
    { code: 13001001, message: 'invalid token' },
    { code: 99151011, message: 'upstream unavailable' },
    { code: 61101113, message: '课程已过期' },
  ])('does not fall back on another /v2 failure ($code)', async (answer) => {
    const { client, calls } = clientAnswering({ v2: answer, v1: { code: 0, data: [ROW] } });
    await expect(client.getCourseSessions('70101', 'tok')).rejects.toThrow(answer.message);
    expect(calls).toHaveLength(1);
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

describe('getCourseInfo expired metadata', () => {
  function setup(
    courseAnswer: unknown,
    sessionAnswer: unknown = { code: 0, data: [ROW] },
    v2Answer: unknown = { code: 0, data: [] },
  ) {
    const client = new ApiClient();
    const makeRequest = vi.fn(async (_method: string, url: string) => {
      if (url.includes('/v2/course/session/list')) return v2Answer;
      if (url.includes('/v1/course/session/list')) return sessionAnswer;
      if (url.includes('/v1/course?')) return courseAnswer;
      throw new Error(`unexpected request ${url}`);
    });
    (client as unknown as { makeRequest: typeof makeRequest }).makeRequest = makeRequest;
    client.setSessionIdSource(async () => []);
    return { client, makeRequest };
  }

  it.each([12121028, '12121028'])('loads embedded session URLs after expiry code %s', async (code) => {
    const { client, makeRequest } = setup({ code, message: '课程已过期', data: null });

    const info = await client.getCourseInfo('70101', 'tok');

    expect(info).toMatchObject({ course_id: '70101', title: '', professor: '' });
    expect(info.videos).toEqual([
      expect.objectContaining({ session_id: 850101, video_id: 450101, main_url: 'm.m3u8', vga_url: 'v.m3u8' }),
    ]);
    expect(makeRequest.mock.calls.map(([, url]) => new URL(url).pathname)).toEqual([
      '/v1/course', '/v2/course/session/list', '/v1/course/session/list',
    ]);
    expect(makeRequest).toHaveBeenNthCalledWith(2, 'GET', expect.any(String), 'tok');
    expect(makeRequest).toHaveBeenNthCalledWith(3, 'GET', expect.any(String), 'tok');
  });

  it.each([12121028, '12121028'])('loads /v1 recordings when metadata AND /v2 return expiry code %s', async (code) => {
    const expired = { code, message: '课程已过期', data: null };
    const { client, makeRequest } = setup(expired, { code: 0, data: [ROW] }, expired);
    const info = await client.getCourseInfo('70101', 'tok');
    expect(info.videos[0]).toMatchObject({ main_url: 'm.m3u8', vga_url: 'v.m3u8' });
    expect(makeRequest.mock.calls.map(([, url]) => new URL(url).pathname)).toEqual([
      '/v1/course', '/v2/course/session/list', '/v1/course/session/list',
    ]);
  });

  it.each([12121028, '12121028'])('represents expired metadata as unavailable for enrichment (%s)', async (code) => {
    const { client, makeRequest } = setup({ code, message: '课程已过期' });
    await expect(client.getCourseDetailIfAvailable('70101', 'tok')).resolves.toBeNull();
    expect(makeRequest).toHaveBeenCalledTimes(1);
  });

  it('does not suppress other failures during optional enrichment', async () => {
    const { client } = setup({ code: 13001001, message: 'invalid token' });
    await expect(client.getCourseDetailIfAvailable('70101', 'tok')).rejects.toThrow('Authentication failed');
  });

  it('keeps successful course metadata unchanged', async () => {
    const { client } = setup({ code: 0, data: { name_zh: '测试课程', name_en: 'Test Course', professors: [{ name: 'Test Teacher' }] } });
    expect(await client.getCourseInfo('70101', 'tok')).toMatchObject({
      title: '测试课程', title_en: 'Test Course', professor: 'Test Teacher', professors: ['Test Teacher'],
    });
  });

  it.each([
    { code: 12111010, message: 'not found' },
    { code: 13001001, message: 'invalid token' },
    { code: 99151011, message: 'upstream unavailable' },
    { code: 61101113, message: '课程已过期' },
  ])('does not suppress other course errors ($code)', async (answer) => {
    const { client, makeRequest } = setup(answer);
    await expect(client.getCourseInfo('70101', 'tok')).rejects.toThrow();
    expect(makeRequest).toHaveBeenCalledTimes(1);
  });

  it('does not suppress a course request failure', async () => {
    const { client, makeRequest } = setup(null);
    makeRequest.mockRejectedValueOnce(new Error('connection failed'));
    await expect(client.getCourseInfo('70101', 'tok')).rejects.toThrow('connection failed');
    expect(makeRequest).toHaveBeenCalledTimes(1);
  });

  it('still surfaces a failed session list after course expiry', async () => {
    const { client } = setup({ code: 12121028, message: '课程已过期' }, { code: 13001001, message: 'invalid token' });
    await expect(client.getCourseInfo('70101', 'tok')).rejects.toThrow('invalid token');
  });

  it('still accepts an empty session list after course expiry', async () => {
    const { client } = setup({ code: 12121028, message: '课程已过期' }, { code: 0, data: [] });
    expect((await client.getCourseInfo('70101', 'tok')).videos).toEqual([]);
  });

  it('keeps metadata-only reads strict so existing enrichment fallbacks still run', async () => {
    const { client, makeRequest } = setup({ code: 12121028, message: '课程已过期' });
    await expect(client.getCourseDetail('70101', 'tok')).rejects.toThrow('课程已过期');
    expect(makeRequest).toHaveBeenCalledTimes(1);
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

describe('expired courses skip the by-id Index fallback', () => {
  it('answers [] without reading Index sessions when /v2 expired and /v1 is empty', async () => {
    const { client, calls } = clientAnswering({ v2: { code: 12121028, message: '课程已过期' }, v1: { code: 0, data: [] } });
    const index = vi.fn(async () => ['850101']);
    client.setSessionIdSource(index);
    expect(await client.getCourseSessions('70101', 'tok')).toEqual([]);
    expect(index).not.toHaveBeenCalled();
    expect(calls).toHaveLength(2);
  });
});

describe('getSessionDownloadInfo for an expired course', () => {
  const EXPIRED = { code: 12121028, message: '课程已过期' };
  const LIST_ROW = { ...ROW, videos: [{ ...ROW.videos[0], audio: 'a.aac' }] };
  const HINT = { id: '70101', name: '示例课程', number: 'C123', teachers: ['某老师'], term: '2024-2025-1' };

  function client(answer: (url: string, token: string) => unknown) {
    const c = new ApiClient();
    const calls: Array<{ url: string; token: string }> = [];
    (c as unknown as { makeRequest: unknown }).makeRequest = vi.fn(async (_m: string, url: string, token: string) => {
      calls.push({ url, token });
      return answer(url, token);
    });
    const facts = { courseOfSession: vi.fn(async (_id: string) => HINT as typeof HINT | null), course: vi.fn(async () => null) };
    c.setLocalCourseFacts(facts);
    return { c, calls, facts };
  }
  const expiredUpstream = (url: string) =>
    url.includes('/v1/course/session/list') ? { code: 0, data: [{ ...LIST_ROW, id: 850100 }, LIST_ROW] } : EXPIRED;

  it('finds the course in the local index and the session in its signed-in /v1 list', async () => {
    const { c, calls, facts } = client(expiredUpstream);
    const listToken = vi.fn(() => 'tok');
    const info = await c.getSessionDownloadInfo('850101', '', listToken);
    expect(facts.courseOfSession).toHaveBeenCalledWith('850101');
    expect(calls.map((x) => x.url)).toEqual([
      'https://cbiz.yanhekt.cn/v1/course/session?session_id=850101&with_video=true',
      'https://cbiz.yanhekt.cn/v1/course/session/list?course_id=70101',
    ]);
    expect(calls[0].token).toBe('');
    expect(calls[1].token).toBe('tok');
    expect(info.session).toMatchObject({ session_id: '850101', video_id: '450101', main_url: 'm.m3u8', vga_url: 'v.m3u8', duration: 5936 });
    expect(info.course).toEqual({ id: '70101', title: '示例课程', number: 'C123', school_year: '2024-2025', semester: 1 });
    expect(info.audioUrl).toBe('a.aac');
  });

  it('does not ask for a token for a current-term session', async () => {
    const { c } = client((url) => url.includes('/v1/video')
      ? { code: 0, data: { id: 450101, main: 'm', vga: 'v' } }
      : { code: 0, data: { id: 850101, course_id: 70101, title: 't', video_ids: [450101] } });
    const listToken = vi.fn(() => 'tok');
    await c.getSessionDownloadInfo('850101', '', listToken);
    expect(listToken).not.toHaveBeenCalled();
  });

  it('uses the course id from session detail when only /v1/video expired', async () => {
    const { c, calls } = client((url) => url.includes('/v1/course/session?')
      ? { code: 0, data: { id: 850101, course_id: 70109, title: 't', video_ids: [450101] } }
      : expiredUpstream(url));
    const info = await c.getSessionDownloadInfo('850101', 'tok');
    expect(calls.at(-1)?.url).toBe('https://cbiz.yanhekt.cn/v1/course/session/list?course_id=70109');
    // The index hint names another course, so its facts are not used.
    expect(info.course).toEqual({ id: '70109', title: '', number: undefined });
  });

  it('is `expired` when the local index does not list the session', async () => {
    const { c, facts } = client(expiredUpstream);
    facts.courseOfSession.mockResolvedValue(null);
    await expect(c.getSessionDownloadInfo('850101', 'tok')).rejects.toMatchObject({ name: 'YanhektLookupError', kind: 'expired' });
  });

  it('is `auth_required` without a token, before asking the list', async () => {
    const { c, calls } = client(expiredUpstream);
    await expect(c.getSessionDownloadInfo('850101', '')).rejects.toMatchObject({ kind: 'auth_required' });
    expect(calls).toHaveLength(1);
  });

  it('is `expired` when the course list does not give the session', async () => {
    const { c } = client((url) => url.includes('/session/list') ? { code: 0, data: [] } : EXPIRED);
    await expect(c.getSessionDownloadInfo('850101', 'tok')).rejects.toMatchObject({ kind: 'expired' });
  });

  it('is `no_recording` when the list row has no stream', async () => {
    const { c } = client((url) => url.includes('/session/list') ? { code: 0, data: [{ ...ROW, videos: [] }] } : EXPIRED);
    await expect(c.getSessionDownloadInfo('850101', 'tok')).rejects.toMatchObject({ kind: 'no_recording' });
  });

  it('still reports a wrong id as not found', async () => {
    const { c } = client(() => ({ code: 12121010, message: '课时不存在' }));
    await expect(c.getSessionDownloadInfo('850101', 'tok')).rejects.toMatchObject({ kind: 'not_found' });
  });
});

describe('getCourseDetailOrIndex', () => {
  it('fills an expired course from the local index', async () => {
    const c = new ApiClient();
    (c as unknown as { makeRequest: unknown }).makeRequest = vi.fn(async () => ({ code: 12121028, message: '课程已过期' }));
    c.setLocalCourseFacts({
      courseOfSession: async () => null,
      course: async () => ({ id: '70101', name: '示例课程', number: null, teachers: ['甲', '乙'], term: '2023-2024-2' }),
    });
    expect(await c.getCourseDetailOrIndex('70101', '')).toEqual({
      course_id: '70101', title: '示例课程', professor: '甲', professors: ['甲', '乙'], number: undefined, school_year: '2023-2024', semester: 2,
    });
  });

  it('is empty facts when the index lacks it too', async () => {
    const c = new ApiClient();
    (c as unknown as { makeRequest: unknown }).makeRequest = vi.fn(async () => ({ code: '12121028', message: '课程已过期' }));
    expect(await c.getCourseDetailOrIndex('70101', '')).toEqual({ course_id: '70101', title: '', professor: '' });
  });
});
