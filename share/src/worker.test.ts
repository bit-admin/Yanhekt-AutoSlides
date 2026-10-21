import { describe, expect, it } from 'vitest';
import worker from './worker';
import type { Env, ExecutionContext } from './lib/runtime';
import { dataVersion, forgetDataVersion } from './api/router';
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
  it('answers the retired v2 Index API with 503', async () => {
    for (const path of ['/v2/api/search?q=x', '/v2/api/stats', '/v2/api/lecture?courseId=1']) {
      const res = await call(path);
      expect(res.status).toBe(503);
      expect(await res.json()).toMatchObject({ error: 'retired' });
    }
    expect((await call('/v2/api/publish', { method: 'POST', body: '{}' })).status).toBe(503);
  });

  it('shows a placeholder at / until the new Index site exists', async () => {
    for (const path of ['/', '/?c=1&s=2']) {
      const res = await call(path);
      expect(res.status).toBe(503);
      expect(res.headers.get('Content-Type')).toContain('text/html');
    }
  });

  it('rejects bad /api requests before touching D1', async () => {
    expect(await (await call('/api/search')).json()).toMatchObject({ error: 'query-required', param: 'q' });
    expect((await call('/api/search?q=x')).status).toBe(400);
    expect((await call('/api/search?q=数学', { method: 'POST' })).status).toBe(405);
    expect(await (await call('/api/search?q=数学')).json()).toMatchObject({ error: 'term-required', param: 'term' });
    expect((await call('/api/courses/abc/sessions')).status).toBe(400);
    expect((await call('/api/courses/1/sessions', { method: 'POST' })).status).toBe(405);
    const missing = await call('/api/courses/1');
    expect(missing.status).toBe(404);
    expect(await missing.json()).toMatchObject({ error: 'not-found' });
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
