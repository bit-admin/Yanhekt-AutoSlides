import { afterEach, describe, expect, it, vi } from 'vitest';
import { getSessionById, ttlFor } from './api';

/**
 * GET_TTL_MS is scanned in order and the first matching prefix wins, so the
 * table's ordering is behaviour, not formatting. These cases pin the pairs
 * where one path is a prefix of another.
 */
describe('ttlFor', () => {
  it('never memoizes the hop that carries user_progress', () => {
    // /v1/course/session sits under the 5-minute /v1/course rule by string
    // prefix. Memoizing it would resurrect a stale playhead when a lecture is
    // reopened, so it must be matched by its own 0 entry first.
    expect(ttlFor('/v1/course/session?session_id=42&with_video=true')).toBe(0);
  });

  it('still memoizes course detail itself', () => {
    expect(ttlFor('/v1/course?id=9&with_professor_badges=true')).toBe(5 * 60 * 1000);
  });

  it('gives the subscription list its own shorter TTL, not /v1/course’s', () => {
    expect(ttlFor('/v1/course/subscription/list?page=1')).toBe(60 * 1000);
  });

  it('separates the v2 session list from the v1 progress hop', () => {
    expect(ttlFor('/v2/course/session/list?course_id=9')).toBe(5 * 60 * 1000);
    expect(ttlFor('/v1/course/session/list?course_id=9')).toBe(5 * 60 * 1000);
  });

  it('keeps the current term long and the live list short', () => {
    expect(ttlFor('/v1/tag/semester/default')).toBe(60 * 60 * 1000);
    expect(ttlFor('/v2/live/list?page=1&page_size=16')).toBe(30 * 1000);
  });

  it('falls back to coalesce-only for unlisted paths', () => {
    expect(ttlFor('/v1/user')).toBe(0);
    expect(ttlFor('/v1/video?id=7')).toBe(0);
  });
});

/** Answers each upstream path with a canned envelope; unknown paths fail the test. */
function stubYanhekt(routes: Record<string, unknown>) {
  vi.stubGlobal('fetch', async (url: string) => {
    const path = url.replace('/api/yanhekt', '').split('?')[0] + '?' + (url.split('?')[1] ?? '');
    const hit = Object.entries(routes).find(([prefix]) => path.startsWith(prefix));
    if (!hit) throw new Error(`unexpected request ${url}`);
    return new Response(JSON.stringify(hit[1]), { status: 200 });
  });
}

describe('getSessionById', () => {
  afterEach(() => vi.unstubAllGlobals());

  const session = {
    id: 801,
    course_id: 701,
    title: 'Week 1',
    week_number: 1,
    day: 3,
    started_at: '2025-09-17 09:55:00',
    ended_at: '2025-09-17 11:30:00',
  };

  it('builds a playable session from the session and video hops, no list', async () => {
    stubYanhekt({
      '/v1/course/session?session_id=801': { code: 0, data: { ...session, video_ids: [901] } },
      '/v1/video?id=901': { code: 0, data: { id: 901, main: 'https://v/main.m3u8', vga: 'https://v/vga.m3u8', duration: '5936' } },
    });
    const r = await getSessionById('801', 'a'.repeat(32));
    expect(r).toEqual({
      kind: 'found',
      courseId: '701',
      session: expect.objectContaining({
        session_id: '801',
        video_id: '901',
        id: '901',
        duration: 5936,
        main_url: 'https://v/main.m3u8',
        vga_url: 'https://v/vga.m3u8',
      }),
    });
  });

  it('reports a session that does not exist as missing', async () => {
    stubYanhekt({
      '/v1/course/session?session_id=802': { code: 12121010, message: 'service runtime exception', data: [] },
    });
    expect(await getSessionById('802', 'a'.repeat(32))).toEqual({ kind: 'missing' });
  });

  it('reports a session without a video as no-recording', async () => {
    stubYanhekt({
      '/v1/course/session?session_id=803': { code: 0, data: { ...session, id: 803, video_ids: [] } },
    });
    expect(await getSessionById('803', 'a'.repeat(32))).toEqual({ kind: 'no-recording', courseId: '701' });
  });
});
