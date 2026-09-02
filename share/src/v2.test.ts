import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { encodeSharePayload, type SharePayload } from '../../autoslides/src/shared/shareLink';
import { fingerprintPayload, handlePublish } from './v2';
import { sha256Hex, type D1Database, type Env } from './lib/runtime';

const TOKEN = '0123456789abcdef0123456789abcdef';

function payload(overrides: Partial<SharePayload> = {}): SharePayload {
  return { v: 2, c: '62313', s: '751843', p: '2026/6', n: 7, h: 'abcdef1abcdef2abcdef3', ...overrides } as SharePayload;
}

/** Records every prepared SQL + bound args; `existingShareId` drives the duplicate branch. */
function fakeDb(existingShareId: string | null) {
  const calls: { sql: string; args: unknown[] }[] = [];
  const db = {
    prepare(sql: string) {
      const entry = { sql, args: [] as unknown[] };
      calls.push(entry);
      const stmt = {
        bind(...args: unknown[]) {
          entry.args = args;
          return stmt;
        },
        first: async () => (sql.startsWith('SELECT share_id') && existingShareId ? { share_id: existingShareId } : null),
        run: async () => ({ results: [], success: true }),
        all: async () => ({ results: [], success: true }),
      };
      return stmt;
    },
  };
  return { db: db as unknown as D1Database, calls };
}

function env(db: Env['INDEX_DB']): Env {
  const kv = new Map<string, string>();
  return {
    ASSETS: { fetch: async () => new Response('') },
    SHARE_KV: { get: async (k: string) => kv.get(k) ?? null, put: async (k: string, v: string) => void kv.set(k, v) },
    INDEX_DB: db,
  };
}

function publishRequest(fragment: string): Request {
  return new Request('https://share.test/v2/api/publish', {
    method: 'POST',
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ fragment, review: { reviewed: true } }),
  });
}

describe('fingerprintPayload', () => {
  it('hashes p|n|h|canonical-o and ignores overrides key order', async () => {
    const a = await fingerprintPayload(payload({ o: { '2': 'x', '10': 'y' } }));
    const b = await fingerprintPayload(payload({ o: { '10': 'y', '2': 'x' } }));
    expect(a).toBe(b);
    expect(a).toBe(await sha256Hex('2026/6|7|abcdef1abcdef2abcdef3|2:x,10:y'));
  });

  it('treats a missing o the same as an empty one, and ids/timeline do not affect it', async () => {
    const base = await fingerprintPayload(payload());
    expect(await fingerprintPayload(payload({ o: {} }))).toBe(base);
    expect(await fingerprintPayload(payload({ v: 3, t: '0:12,1:30', c: '1', s: '2' } as Partial<SharePayload>))).toBe(base);
    expect(await fingerprintPayload(payload({ h: 'different' }))).not.toBe(base);
  });
});

describe('handlePublish', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify({ code: 0, data: { badge: 'u1', nickname: 'Tester' } }), { status: 200 })),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('inserts a new version and bumps version_count for a new fingerprint', async () => {
    const { db, calls } = fakeDb(null);
    const res = await handlePublish(publishRequest(encodeSharePayload(payload())), env(db), 'https://share.test');
    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: boolean; duplicate: boolean };
    expect(body).toMatchObject({ ok: true, duplicate: false });
    const sqls = calls.map((c) => c.sql.replace(/\s+/g, ' ').trim());
    expect(sqls.some((s) => s.startsWith('INSERT INTO versions'))).toBe(true);
    expect(sqls.some((s) => s.includes('version_count = version_count + 1'))).toBe(true);
  });

  it('updates the existing version row without touching version_count for a known fingerprint', async () => {
    const { db, calls } = fakeDb('abc123');
    const res = await handlePublish(
      publishRequest(encodeSharePayload(payload({ v: 3, t: '0:12,1:30' } as Partial<SharePayload>))),
      env(db),
      'https://share.test',
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: boolean; duplicate: boolean; updated: boolean };
    expect(body).toMatchObject({ ok: true, duplicate: true, updated: true });
    const sqls = calls.map((c) => c.sql.replace(/\s+/g, ' ').trim());
    expect(sqls.some((s) => s.startsWith('UPDATE versions'))).toBe(true);
    expect(sqls.some((s) => s.includes('version_count'))).toBe(false);
    const update = calls.find((c) => c.sql.trim().startsWith('UPDATE versions'))!;
    // has_timeline is refreshed on the duplicate path (v3 payload carries `t`).
    expect(update.args[1]).toBe(1);
  });

  it('rejects when Yanhekt does not verify the token', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ code: 401 }), { status: 200 })));
    const { db, calls } = fakeDb(null);
    const res = await handlePublish(publishRequest(encodeSharePayload(payload())), env(db), 'https://share.test');
    expect(res.status).toBe(401);
    expect(calls).toHaveLength(0);
  });
});
