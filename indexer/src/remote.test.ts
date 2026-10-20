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
  async exec(sqls: string[]) {
    this.requests += 1;
    this.statements += sqls.length;
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

test('upload is incremental and resumable', async () => {
  const api = new FakeApi([...Array(100).keys()].map((i) => 1000 + i));
  const store = new SqliteStore(':memory:');
  await drain(make(api, [rangeLane(1000, 1049)], store).crawler);

  const d1 = new FakeD1();
  const first = await upload(store, d1, 'db1', opts);
  assert.equal(first.sessions, 50);
  assert.equal(first.courses, 7);
  assert.equal(first.lives, 50);
  assert.equal(d1.n('SELECT COUNT(*) FROM sessions'), 50);
  assert.ok(d1.requests > 3, 'split into several requests');

  // Nothing changed: nothing re-sent.
  const again = await upload(store, d1, 'db1', opts);
  assert.equal(again.sessions, 0);

  // More crawling: only the new rows go up.
  await drain(make(api, [rangeLane(1050, 1099)], store).crawler);
  const third = await upload(store, d1, 'db1', opts);
  assert.equal(third.sessions, 50);
  assert.equal(d1.n('SELECT COUNT(*) FROM sessions'), 100);

  const prog = d1.db.prepare("SELECT * FROM device_progress WHERE device = 'test'").get() as Record<string, string>;
  assert.ok(JSON.parse(prog.lanes)['range:1050:1099']);
  assert.equal(JSON.parse(prog.totals).sessions, 100);

  // A different D1 database starts from scratch.
  const other = new FakeD1();
  assert.equal((await upload(store, other, 'db2', opts)).sessions, 100);
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
    const c = d1.db.prepare('SELECT detail_status, professor_names FROM courses WHERE id = 506').get() as Record<string, unknown>;
    assert.equal(c.detail_status, 'ok');
    assert.equal(c.professor_names, '裴老师、王老师');
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
