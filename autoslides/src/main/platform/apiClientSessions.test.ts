import { describe, expect, it, vi } from 'vitest';

vi.mock('electron', () => ({ app: { getVersion: () => '0.0.0', isPackaged: false } }));
vi.mock('@main/infra/logger', () => ({ createLogger: () => ({ debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }) }));

import { ApiClient } from './apiClient';

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

  it('returns [] when both are empty', async () => {
    const { client, calls } = clientAnswering({ v2: { code: 0, data: [] }, v1: { code: 0, data: [] } });
    expect(await client.getCourseSessions('70101', 'tok')).toEqual([]);
    expect(calls).toHaveLength(2);
  });

  it('throws on a non-zero code from the fallback', async () => {
    const { client } = clientAnswering({ v2: { code: 0, data: [] }, v1: { code: 61101113, message: '用户未登录' } });
    await expect(client.getCourseSessions('70101', 'tok')).rejects.toThrow('用户未登录');
  });
});
