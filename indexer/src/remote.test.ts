import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { rangeLane } from './crawler.ts';
import { config, drain, FakeApi, make } from './testkit.ts';
import { D1Http, upload, type D1Exec } from './remote.ts';
import { SqliteStore } from './store.ts';

/** Stands in for D1: runs the batches on an in-memory SQLite (D1 is SQLite). */
class FakeD1 implements D1Exec {
  db = new DatabaseSync(':memory:');
  requests = 0;
  statements = 0;
  statementsLog: string[] = [];
  async exec(sqls: string[]) {
    this.requests += 1;
    this.statements += sqls.length;
    this.statementsLog.push(...sqls);
    return sqls.map((sql) => {
      const st = this.db.prepare(sql);
      return st.columns().length > 0 ? { results: st.all() as Array<Record<string, unknown>>, success: true } : (st.run(), { success: true });
    });
  }
  n(sql: string) {
    return Number(Object.values(this.db.prepare(sql).get() as object)[0]);
  }
}

const opts = { device: 'test', maxRequestBytes: 50_000, maxStatements: 40, log: () => {} };

const sessionTotal = (d1: FakeD1) => d1.n('SELECT COALESCE(SUM(json_array_length(session_ids)), 0) FROM courses');

test('upload sends only courses that changed', async () => {
  const api = new FakeApi([...Array(100).keys()].map((i) => 1000 + i));
  const store = new SqliteStore(':memory:');
  await drain(make(api, [rangeLane(1000, 1049)], store).crawler);

  const d1 = new FakeD1();
  const first = await upload(store, d1, 'db1', opts);
  assert.deepEqual(first, { courses: 7, grams: 7 });
  assert.equal(sessionTotal(d1), 50);
  const version = d1.n("SELECT value FROM meta WHERE key = 'data'");
  assert.ok(version > 0);

  // Nothing changed: nothing re-sent, and the data version stays.
  assert.deepEqual(await upload(store, d1, 'db1', opts), { courses: 0, grams: 0 });

  // More sessions of the same courses: the course rows go again, their grams do not.
  await drain(make(api, [rangeLane(1050, 1099)], store).crawler);
  assert.deepEqual(await upload(store, d1, 'db1', opts), { courses: 7, grams: 0 });
  assert.equal(sessionTotal(d1), 100);
  assert.deepEqual(
    JSON.parse(String((d1.db.prepare('SELECT session_ids FROM courses WHERE id = 506').get() as { session_ids: string }).session_ids)).slice(0, 3),
    [1000, 1007, 1014],
  );

  const prog = d1.db.prepare("SELECT * FROM device_progress WHERE device = 'test'").get() as Record<string, string>;
  assert.ok(JSON.parse(prog.lanes)['range:1050:1099']);
  assert.equal(JSON.parse(prog.totals).sessions, 100);

  // A different D1 database starts from scratch.
  assert.deepEqual(await upload(store, new FakeD1(), 'db2', opts), { courses: 7, grams: 7 });
});

test('two devices merge: full course detail wins over the thin copy, whatever the order', async () => {
  const api = new FakeApi([1000, 1001]);
  // Device A: no course detail (thin nested copy only).
  const a = new SqliteStore(':memory:');
  await drain(make(api, [rangeLane(1000, 1001)], a, { ...config, fetchCourseDetail: false }).crawler);
  // Device B: with detail.
  const b = new SqliteStore(':memory:');
  await drain(make(api, [rangeLane(1000, 1001)], b).crawler);

  for (const [i, order] of [[a, b], [b, a]].entries()) {
    // A fresh D1 database each pass (upload positions are tracked per database id).
    const d1 = new FakeD1();
    await upload(order[0], d1, `db${i}`, { ...opts, device: 'one' });
    await upload(order[1], d1, `db${i}`, { ...opts, device: 'two' });
    const c = d1.db.prepare('SELECT detail, teachers FROM courses WHERE id = 506').get() as Record<string, unknown>;
    assert.equal(c.detail, 1);
    assert.deepEqual(JSON.parse(String(c.teachers)), ['裴老师', '王老师']);
    assert.equal(d1.n('SELECT COUNT(*) FROM device_progress'), 2);
  }
});

test('D1Http sends batches with the token and surfaces SQL errors', async () => {
  const seen: Array<{ url: string; init: RequestInit }> = [];
  const ok = async (url: string | URL | Request, init?: RequestInit) => {
    seen.push({ url: String(url), init: init! });
    return new Response(JSON.stringify({ success: true, result: [{ results: [], success: true }] }), { status: 200 });
  };
  const d1 = new D1Http({ accountId: 'acc', databaseId: 'db', token: 'tok' }, ok as typeof fetch);
  await d1.exec(['SELECT 1', 'SELECT 2']);
  assert.equal(seen[0].url, 'https://api.cloudflare.com/client/v4/accounts/acc/d1/database/db/query');
  assert.equal((seen[0].init.headers as Record<string, string>).Authorization, 'Bearer tok');
  assert.deepEqual(JSON.parse(String(seen[0].init.body)), { batch: [{ sql: 'SELECT 1' }, { sql: 'SELECT 2' }] });
  await d1.exec(['SELECT 3']);
  assert.deepEqual(JSON.parse(String(seen[1].init.body)), { sql: 'SELECT 3' });

  const bad = async () =>
    new Response(JSON.stringify({ success: false, errors: [{ code: 7500, message: 'no such table: x' }] }), { status: 400 });
  await assert.rejects(new D1Http({ accountId: 'a', databaseId: 'b', token: 'c' }, bad as typeof fetch).exec(['SELECT * FROM x']), /no such table/);
});

test('D1 layout: no sessions or videos tables, an old layout needs --reset', async () => {
  const store = new SqliteStore(':memory:');
  await drain(make(new FakeApi([1000, 1007]), [rangeLane(1000, 1007)], store, { ...config, fetchVideos: true }).crawler);

  const d1 = new FakeD1();
  await upload(store, d1, 'db1', opts);
  assert.equal(d1.n("SELECT COUNT(*) FROM sqlite_schema WHERE name IN ('videos', 'sessions')"), 0);
  assert.equal(d1.n("SELECT value FROM meta WHERE key = 'schema'"), 3);
  // Sessions 1000 and 1007 share course 506 (500 + id % 7).
  assert.equal(d1.n('SELECT json_array_length(session_ids) FROM courses WHERE id = 506'), 2);

  const legacy = new FakeD1();
  legacy.db.exec('CREATE TABLE courses (id INTEGER PRIMARY KEY, name_zh TEXT)');
  await assert.rejects(upload(store, legacy, 'db2', opts), /--reset/);
  assert.deepEqual(await upload(store, legacy, 'db2', { ...opts, reset: true }), { courses: 1, grams: 1 });
  // --reset also forgets what this device sent there, so everything goes again.
  assert.deepEqual(await upload(store, legacy, 'db2', { ...opts, reset: true }), { courses: 1, grams: 1 });
});

test('an interrupted upload continues where it stopped', async () => {
  const store = new SqliteStore(':memory:');
  await drain(make(new FakeApi([...Array(21).keys()].map((i) => 1000 + i)), [rangeLane(1000, 1020)], store).crawler);

  const d1 = new FakeD1();
  const real = d1.exec.bind(d1);
  let courseRequests = 0;
  d1.exec = async (sqls: string[]) => {
    if (sqls.some((s) => s.startsWith('INSERT INTO courses')) && ++courseRequests === 2) throw new Error('daily limit');
    return real(sqls);
  };
  // Two statements per course, four per request: the second request fails.
  const small = { ...opts, maxStatements: 4 };
  await assert.rejects(upload(store, d1, 'db1', small), /daily limit/);
  assert.equal(d1.n('SELECT COUNT(*) FROM courses'), 2);

  assert.deepEqual(await upload(store, d1, 'db1', small), { courses: 5, grams: 5 });
  assert.equal(sessionTotal(d1), 21);
});
