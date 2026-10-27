import { describe, expect, it } from 'vitest';
import worker from './worker';
import type { Env, ExecutionContext } from './lib/runtime';
import { dataVersion, forgetDataVersion, termList } from './api/router';
import { setDataVersion, testDb } from './api/testDb';

const env = {
  ASSETS: { fetch: async () => new Response('asset', { status: 404 }) },
  SHARE_KV: { get: async () => null, put: async () => {} },
  YANHEKT_DB: {
    prepare: () => {
      throw new Error('D1 should not be reached');
    },
    batch: async () => [],
  },
} as unknown as Env;
const ctx: ExecutionContext = { waitUntil: () => {} };
const call = (path: string, init?: RequestInit) => worker.fetch(new Request(`https://share.test${path}`, init), env, ctx);

describe('worker routing', () => {
  it('answers the retired v2 Index API with 410 Gone', async () => {
    for (const path of ['/v2/api/search?q=x', '/v2/api/stats', '/v2/api/lecture?courseId=1']) {
      const res = await call(path);
      expect(res.status).toBe(410);
      expect(await res.json()).toMatchObject({ error: 'retired' });
    }
    expect((await call('/v2/api/publish', { method: 'POST', body: '{}' })).status).toBe(410);
  });

  it('serves the Index site shell for its client-routed pages', async () => {
    const seen: string[] = [];
    const siteEnv = { ...env, ASSETS: { fetch: async (r: Request) => (seen.push(new URL(r.url).pathname), new Response('shell')) } } as Env;
    for (const path of ['/search?q=x&term=2026-2027-1', '/course/12345', '/course/12345/']) {
      const res = await worker.fetch(new Request(`https://share.test${path}`), siteEnv, ctx);
      expect(await res.text()).toBe('shell');
    }
    expect(seen).toEqual(['/', '/', '/']);
    expect(await (await call('/course/abc')).text()).toBe('asset');
  });

  it('rejects bad /api requests before touching D1', async () => {
    expect(await (await call('/api/search')).json()).toMatchObject({ error: 'query-required', param: 'q' });
    expect((await call('/api/search?q=x')).status).toBe(400);
    expect((await call('/api/search?q=数学', { method: 'POST' })).status).toBe(405);
    expect(await (await call('/api/search?q=数学')).json()).toMatchObject({ error: 'term-required', param: 'term' });
    // A term outside INDEX_TERMS (here: none set at all) is refused without D1.
    const unindexed = await call('/api/search?q=数学&term=2024-2025-1');
    expect(unindexed.status).toBe(400);
    expect(await unindexed.json()).toMatchObject({ error: 'term-not-indexed', param: 'term' });
    const listed = { ...env, INDEX_TERMS: '2026-2027-1' } as Env;
    const other = await worker.fetch(new Request('https://share.test/api/search?q=数学&term=2025-2026-1'), listed, ctx);
    expect(await other.json()).toMatchObject({ error: 'term-not-indexed' });
    expect((await call('/api/courses/abc/sessions')).status).toBe(400);
    expect((await call('/api/courses/1/sessions', { method: 'POST' })).status).toBe(405);
    expect((await call('/api/courses/abc/yanhekt')).status).toBe(400);
    expect(await (await call('/api/courses/1/yanhekt/sessions?from=x')).json()).toMatchObject({ error: 'bad-param', param: 'from' });
    expect((await call('/api/courses/1/yanhekt/other')).status).toBe(404);
    const missing = await call('/api/courses/1');
    expect(missing.status).toBe(404);
    expect(await missing.json()).toMatchObject({ error: 'not-found' });
  });

  it('refuses app requests without a well-formed Bearer token, before touching D1', async () => {
    const app = 'AutoSlides/5.3.0 (macOS; arm64)';
    for (const path of ['/api/search?q=数学&term=2026-2027-1', '/api/courses/1/sessions', '/api/terms']) {
      for (const auth of [undefined, 'Bearer ', 'Bearer abc', `Basic ${'a'.repeat(32)}`, `Bearer ${'g'.repeat(32)}`]) {
        const headers: Record<string, string> = { 'User-Agent': app };
        if (auth !== undefined) headers.Authorization = auth;
        const res = await call(path, { headers });
        expect(res.status).toBe(403);
        expect(await res.json()).toMatchObject({ error: 'token-required' });
      }
    }
    // A well-formed token passes the gate (and reaches the usual checks).
    const signedIn = await call('/api/search?q=数学', { headers: { 'User-Agent': app, Authorization: `Bearer ${'0a'.repeat(16)}` } });
    expect(await signedIn.json()).toMatchObject({ error: 'term-required' });
    // Browsers and the web Worker's binding send no token and are not gated.
    expect(await (await call('/api/search?q=数学', { headers: { 'User-Agent': 'Mozilla/5.0' } })).json()).toMatchObject({ error: 'term-required' });
    expect(await (await call('/api/search?q=数学')).json()).toMatchObject({ error: 'term-required' });
    // Share links are not gated yet (released apps send no token there).
    expect(await (await call('/v1/whatever', { headers: { 'User-Agent': app } })).text()).toBe('asset');
  });

  it('leaves other paths to the asset layer', async () => {
    expect(await (await call('/v1/whatever')).text()).toBe('asset');
  });
});

describe('data version', () => {
  it('is read once a minute per instance', async () => {
    forgetDataVersion();
    const db = testDb();
    setDataVersion(db, 7);
    expect(await dataVersion(db, 0)).toBe('7');
    setDataVersion(db, 8);
    expect(await dataVersion(db, 59_000)).toBe('7');
    expect(await dataVersion(db, 61_000)).toBe('8');
    forgetDataVersion();
  });
});

describe('term list', () => {
  it('comes from INDEX_TERMS, newest first, with the data version as the update time', () => {
    expect(termList({ INDEX_TERMS: ' 2025-2026-1, 2026-2027-1,bogus,,2025-2026-2,2026-2027-1' }, '1760000000000')).toEqual({
      updatedAt: 1_760_000_000_000,
      terms: ['2026-2027-1', '2025-2026-2', '2025-2026-1'],
    });
    expect(termList({}, '0')).toEqual({ updatedAt: null, terms: [] });
  });

  it('is answered without D1 when the data version cannot be read', async () => {
    forgetDataVersion();
    const res = await worker.fetch(new Request('https://share.test/api/terms'), { ...env, INDEX_TERMS: '2026-2027-1' } as Env, ctx);
    expect(await res.json()).toEqual({ updatedAt: null, terms: ['2026-2027-1'] });
    forgetDataVersion();
  });
});
