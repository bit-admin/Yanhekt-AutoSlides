import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import worker, {
  LOGIN_TOKEN_RE,
  fetchSignedMedia,
  isAllowedUpstream,
  parseSeconds,
  parseSessionId,
  rewriteM3u8,
} from './index';

const TOKEN = '0123456789abcdef0123456789abcdef';
const MEDIA = 'https://cvideo.yanhekt.cn/a/b/video.m3u8';

/** Map-backed stand-in for `caches.default` (workerd Cache API). */
function fakeCache() {
  const store = new Map<string, Response>();
  return {
    store,
    match: vi.fn(async (req: Request) => {
      const hit = store.get(req.url);
      return hit ? hit.clone() : undefined;
    }),
    put: vi.fn(async (req: Request, res: Response) => {
      store.set(req.url, res);
    }),
    delete: vi.fn(async (req: Request) => store.delete(req.url)),
  };
}

function fakeCtx() {
  const pending: Promise<unknown>[] = [];
  return {
    pending,
    waitUntil: (p: Promise<unknown>) => {
      pending.push(p.catch(() => {}));
    },
    passThroughOnException: () => {},
  } as unknown as ExecutionContext & { pending: Promise<unknown>[] };
}

function tokenResponse(token: string): Response {
  return new Response(JSON.stringify({ code: 0, data: { token, now: 1000, expired_at: 1600 } }), {
    headers: { 'Content-Type': 'application/json' },
  });
}

let cache: ReturnType<typeof fakeCache>;
const fetchSpy = vi.fn<(url: string, init?: RequestInit) => Promise<Response>>();

beforeEach(() => {
  cache = fakeCache();
  fetchSpy.mockReset();
  vi.stubGlobal('caches', { default: cache });
  vi.stubGlobal('fetch', fetchSpy);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('t= gate', () => {
  it('matches only 32-hex login tokens', () => {
    expect(LOGIN_TOKEN_RE.test(TOKEN)).toBe(true);
    expect(LOGIN_TOKEN_RE.test(TOKEN.toUpperCase())).toBe(true);
    expect(LOGIN_TOKEN_RE.test('zz')).toBe(false);
    expect(LOGIN_TOKEN_RE.test(TOKEN + 'a')).toBe(false);
  });

  it('403s a malformed token before touching the cache or upstream', async () => {
    const res = await worker.fetch(
      new Request(`https://relay.test/playlist?u=${encodeURIComponent(MEDIA)}&t=not-hex`),
      {},
      fakeCtx()
    );
    expect(res.status).toBe(403);
    expect(cache.match).not.toHaveBeenCalled();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('403s non-Yanhekt upstream hosts', async () => {
    expect(isAllowedUpstream('https://cvideo.yanhekt.cn/x.ts')).toBe(true);
    expect(isAllowedUpstream('https://evil.example/x.ts')).toBe(false);
    const res = await worker.fetch(
      new Request(`https://relay.test/segment?u=${encodeURIComponent('https://evil.example/x.ts')}&t=${TOKEN}`),
      {},
      fakeCtx()
    );
    expect(res.status).toBe(403);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe('fetchSignedMedia', () => {
  it('re-mints the token and re-signs after a 403', async () => {
    fetchSpy
      .mockResolvedValueOnce(tokenResponse('tok1'))
      .mockResolvedValueOnce(new Response('denied', { status: 403 }))
      .mockResolvedValueOnce(tokenResponse('tok2'))
      .mockResolvedValueOnce(new Response('ok', { status: 200 }));
    const ctx = fakeCtx();
    const res = await fetchSignedMedia(MEDIA, ctx, null);
    expect(res.status).toBe(200);
    const urls = fetchSpy.mock.calls.map((c) => c[0]);
    expect(urls[1]).toContain('Xvideo_Token=tok1');
    expect(urls[3]).toContain('Xvideo_Token=tok2');
    expect(cache.delete).toHaveBeenCalledTimes(1);
  });

  it('surfaces the final 403 after exhausting attempts', async () => {
    fetchSpy.mockImplementation(async (url: string) =>
      url.startsWith('https://cbiz.yanhekt.cn/') ? tokenResponse('tok') : new Response('denied', { status: 403 })
    );
    const res = await fetchSignedMedia(MEDIA, fakeCtx(), null);
    expect(res.status).toBe(403);
    const mediaCalls = fetchSpy.mock.calls.filter((c) => c[0].startsWith('https://cvideo.'));
    expect(mediaCalls).toHaveLength(3);
  });
});

describe('VOD cache', () => {
  it('&nocache=1 bypasses the segment cache on both read and write', async () => {
    fetchSpy.mockResolvedValueOnce(tokenResponse('tok')).mockResolvedValueOnce(new Response('bytes', { status: 200 }));
    const seg = 'https://cvideo.yanhekt.cn/a/b/0001.ts';
    const res = await worker.fetch(
      new Request(`https://relay.test/segment?u=${encodeURIComponent(seg)}&t=${TOKEN}&nocache=1`),
      {},
      fakeCtx()
    );
    expect(res.status).toBe(200);
    expect(await res.text()).toBe('bytes');
    // The token cache is still consulted; the segment cache is not.
    const segmentMatches = cache.match.mock.calls.filter((c) => c[0].url.includes('/seg/'));
    expect(segmentMatches).toHaveLength(0);
    expect(cache.put.mock.calls.filter((c) => c[0].url.includes('/seg/'))).toHaveLength(0);
  });

  it('serves a cached segment without any upstream fetch', async () => {
    const seg = 'https://cvideo.yanhekt.cn/a/b/0002.ts';
    fetchSpy.mockResolvedValueOnce(tokenResponse('tok')).mockResolvedValueOnce(new Response('bytes', { status: 200 }));
    const ctx = fakeCtx();
    const first = await worker.fetch(
      new Request(`https://relay.test/segment?u=${encodeURIComponent(seg)}&t=${TOKEN}`),
      {},
      ctx
    );
    expect(await first.text()).toBe('bytes');
    await Promise.all(ctx.pending);
    fetchSpy.mockClear();
    const second = await worker.fetch(
      new Request(`https://relay.test/segment?u=${encodeURIComponent(seg)}&t=${TOKEN}`),
      {},
      fakeCtx()
    );
    expect(second.status).toBe(200);
    expect(await second.text()).toBe('bytes');
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe('rewriteM3u8', () => {
  it('routes segment and playlist lines through the relay and propagates nocache', () => {
    const out = rewriteM3u8(
      '#EXTM3U\n#EXTINF:4,\n0001.ts\nsub/child.m3u8\n#EXT-X-KEY:METHOD=AES-128,URI="key.bin"\n',
      'https://cvideo.yanhekt.cn/a/b/video.m3u8',
      'https://relay.test',
      TOKEN,
      true
    );
    const lines = out.split('\n');
    expect(lines[2]).toBe(`https://relay.test/segment?u=${encodeURIComponent('https://cvideo.yanhekt.cn/a/b/0001.ts')}&t=${TOKEN}&nocache=1`);
    expect(lines[3]).toBe(`https://relay.test/playlist?u=${encodeURIComponent('https://cvideo.yanhekt.cn/a/b/sub/child.m3u8')}&t=${TOKEN}&nocache=1`);
    expect(lines[4]).toContain(`URI="https://relay.test/segment?u=${encodeURIComponent('https://cvideo.yanhekt.cn/a/b/key.bin')}`);
  });
});

describe('watch progress', () => {
  /** Cold segment fetch: token mint, then the media itself. */
  function primeSegmentFetch(): void {
    fetchSpy
      .mockResolvedValueOnce(tokenResponse('tok'))
      .mockResolvedValueOnce(new Response('bytes', { status: 200 }));
  }

  function progressCalls(): [string, RequestInit][] {
    return fetchSpy.mock.calls.filter(
      (c) => c[0] === 'https://cbiz.yanhekt.cn/v1/course/session/user/progress'
    ) as [string, RequestInit][];
  }

  it('accepts only integer session ids and playheads', () => {
    expect(parseSessionId('831116')).toBe('831116');
    expect(parseSessionId('83a116')).toBeNull();
    expect(parseSessionId('')).toBeNull();
    expect(parseSessionId(null)).toBeNull();
    expect(parseSeconds('3105')).toBe(3105);
    expect(parseSeconds('0')).toBeNull(); // the beginning is never worth reporting
    expect(parseSeconds('-5')).toBeNull();
    expect(parseSeconds('1e9')).toBeNull();
  });

  it('carries sid into every rewritten child url', () => {
    const out = rewriteM3u8(
      '#EXTM3U\n#EXTINF:4,\n0001.ts\nsub/child.m3u8\n',
      'https://cvideo.yanhekt.cn/a/b/video.m3u8',
      'https://relay.test',
      TOKEN,
      false,
      '831116'
    );
    const lines = out.split('\n');
    expect(lines[2]).toContain('&sid=831116');
    expect(lines[3]).toContain('&sid=831116'); // nested playlists keep reporting
    expect(rewriteM3u8('0001.ts\n', 'https://cvideo.yanhekt.cn/a/b/v.m3u8', 'https://relay.test', TOKEN, false)).not.toContain('sid=');
  });

  it('reports the playhead in the background, with the caller token as Bearer', async () => {
    primeSegmentFetch();
    const ctx = fakeCtx();
    const res = await worker.fetch(
      new Request(
        `https://relay.test/segment?u=${encodeURIComponent('https://cvideo.yanhekt.cn/a/b/1.ts')}&t=${TOKEN}&sid=100001&p=3105`
      ),
      {},
      ctx
    );
    // The segment streams back without waiting on the heartbeat's response.
    expect(res.status).toBe(200);
    expect(await res.text()).toBe('bytes');

    await Promise.all(ctx.pending);
    const [url, init] = progressCalls()[0];
    expect(url).toBe('https://cbiz.yanhekt.cn/v1/course/session/user/progress');
    expect(init.method).toBe('PUT');
    const headers = init.headers as Record<string, string>;
    expect(headers.Authorization).toBe(`Bearer ${TOKEN}`);
    expect(headers['Xclient-Signature']).toBe('72b77856f6df3f563ab6e658631cac3d');
    expect(JSON.parse(init.body as string)).toEqual({ session_id: '100001', seconds: 3105 });
  });

  it('reports nothing without sid, or with junk params', async () => {
    for (const query of ['', '&sid=100002', '&p=3105', '&sid=abc&p=3105', '&sid=100002&p=-1']) {
      fetchSpy.mockReset();
      primeSegmentFetch();
      const ctx = fakeCtx();
      const res = await worker.fetch(
        new Request(
          `https://relay.test/segment?u=${encodeURIComponent(`https://cvideo.yanhekt.cn/a/b/${query.length}.ts`)}&t=${TOKEN}&nocache=1${query}`
        ),
        {},
        ctx
      );
      expect(res.status).toBe(200); // never fatal — a bad param just means no report
      await Promise.all(ctx.pending);
      expect(progressCalls()).toHaveLength(0);
    }
  });

  it('reports nothing for a segment the viewer never got', async () => {
    // Every media attempt 403s, so the re-mint ladder exhausts and the viewer
    // gets a 403 — the token mint itself must keep succeeding.
    fetchSpy.mockImplementation(async (url: string) =>
      url.startsWith('https://cbiz.yanhekt.cn/v1/auth')
        ? tokenResponse('tok')
        : new Response('denied', { status: 403 })
    );
    const ctx = fakeCtx();
    const res = await worker.fetch(
      new Request(
        `https://relay.test/segment?u=${encodeURIComponent('https://cvideo.yanhekt.cn/a/b/gone.ts')}&t=${TOKEN}&sid=100006&p=60&nocache=1`
      ),
      {},
      ctx
    );
    expect(res.status).toBe(403);
    await Promise.all(ctx.pending);
    expect(progressCalls()).toHaveLength(0);
  });

  it('collapses the burst of fragment fetches hls.js issues at one playhead', async () => {
    const seg = 'https://cvideo.yanhekt.cn/a/b/burst.ts';
    for (let i = 0; i < 3; i++) {
      primeSegmentFetch();
      const ctx = fakeCtx();
      await worker.fetch(
        new Request(`https://relay.test/segment?u=${encodeURIComponent(seg)}&t=${TOKEN}&sid=100003&p=40&nocache=1`),
        {},
        ctx
      );
      await Promise.all(ctx.pending);
    }
    expect(progressCalls()).toHaveLength(1);
  });

  it('keeps the shared segment cache key free of sid and p', async () => {
    const seg = 'https://cvideo.yanhekt.cn/a/b/shared.ts';
    primeSegmentFetch();
    const first = fakeCtx();
    await worker.fetch(
      new Request(`https://relay.test/segment?u=${encodeURIComponent(seg)}&t=${TOKEN}&sid=100004&p=20`),
      {},
      first
    );
    await Promise.all(first.pending);
    fetchSpy.mockClear();

    // A different viewer at a different playhead must still hit the same entry.
    const second = fakeCtx();
    const res = await worker.fetch(
      new Request(`https://relay.test/segment?u=${encodeURIComponent(seg)}&t=${TOKEN}&sid=100005&p=980`),
      {},
      second
    );
    expect(await res.text()).toBe('bytes');
    await Promise.all(second.pending);
    // Only the progress PUT went upstream — no token mint, no media fetch.
    expect(fetchSpy.mock.calls).toHaveLength(1);
    expect(progressCalls()).toHaveLength(1);
  });
});
