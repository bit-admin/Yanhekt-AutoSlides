import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { rangeLane } from './crawler.ts';
import { SqliteStore } from './store.ts';
import { config, drain, FakeApi, make } from './testkit.ts';

const count = (s: SqliteStore, sql: string) => Number(Object.values(s.db.prepare(sql).get() as object)[0]);

test('merge: adds new rows, upgrades thin courses, never downgrades, re-marks rows for upload', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'yhi-merge-'));
  try {
    const api = new FakeApi([...Array(40).keys()].map((i) => 1000 + i));
    // "Artifact": ids 1000..1029, with course detail.
    const art = new SqliteStore(join(dir, 'artifact.db'));
    await drain(make(api, [rangeLane(1000, 1029)], art).crawler);
    art.close();

    // Local: ids 1020..1039, without course detail (thin courses).
    const local = new SqliteStore(join(dir, 'local.db'));
    await drain(make(api, [rangeLane(1020, 1039)], local, { ...config, fetchCourseDetail: false }).crawler);
    assert.equal(count(local, "SELECT COUNT(*) FROM courses WHERE detail_status = 'ok'"), 0);

    const { rows, lanes } = local.mergeFrom(join(dir, 'artifact.db'), 5_000_000);
    assert.equal(count(local, 'SELECT COUNT(*) FROM sessions'), 40);
    assert.equal(count(local, "SELECT COUNT(*) FROM courses WHERE detail_status = 'ok'"), 7, 'thin courses upgraded');
    assert.ok(rows.sessions >= 20);
    assert.equal(lanes['range:1000:1029'].done, true);
    assert.equal(count(local, 'SELECT COUNT(*) FROM sessions WHERE id < 1020 AND changed_at = 5000000'), 20, 'merged rows re-marked for upload');

    // Merging a thinner file back must not downgrade the detailed courses.
    const thin = new SqliteStore(join(dir, 'thin.db'));
    await drain(make(api, [rangeLane(1000, 1005)], thin, { ...config, fetchCourseDetail: false }).crawler);
    thin.close();
    local.mergeFrom(join(dir, 'thin.db'), 6_000_000);
    assert.equal(count(local, "SELECT COUNT(*) FROM courses WHERE detail_status = 'ok'"), 7);
    local.close();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('merge: the later observation of a session wins, a gone mark included (SVC-10)', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'yhi-merge-gone-'));
  try {
    const api = new FakeApi([2000, 2001, 2002, 2003]);
    const build = async (name: string) => {
      const s = new SqliteStore(join(dir, name));
      await drain(make(api, [rangeLane(2000, 2003)], s).crawler);
      return s;
    };
    const set = (s: SqliteStore, id: number, fetched: number, gone: number | null, refreshed = fetched) =>
      s.db.prepare('UPDATE sessions SET fetched_at = ?, gone_at = ?, refreshed_at = ? WHERE id = ?').run(fetched, gone, refreshed, id);
    const goneAt = (s: SqliteStore, id: number) =>
      (s.db.prepare('SELECT gone_at FROM sessions WHERE id = ?').get(id) as { gone_at: number | null }).gone_at;

    // A: read at 100, found gone at 300.  B: read at 200 (still there then).
    // 2001: B read at 400, after A's gone mark: the newer read wins.
    // 2002: same times on both sides: the incoming row, as before.
    // 2003: A expired-checked at 500 (refreshed only): not gone, B's later read wins.
    const a = await build('a.db');
    set(a, 2000, 100, 300);
    set(a, 2001, 100, 300);
    set(a, 2002, 100, 300);
    set(a, 2003, 100, null, 500);
    a.close();
    const b = await build('b.db');
    set(b, 2000, 200, null);
    set(b, 2001, 400, null);
    set(b, 2002, 300, null);
    set(b, 2003, 200, null);
    b.close();

    // B into A: A's gone mark on 2000 is newer than B's read and stays.
    const intoA = new SqliteStore(join(dir, 'a.db'));
    intoA.mergeFrom(join(dir, 'b.db'), 9_000);
    assert.equal(goneAt(intoA, 2000), 300, 'older read does not revive a gone session');
    assert.equal(goneAt(intoA, 2001), null, 'newer read revives it');
    assert.equal(goneAt(intoA, 2002), null, 'a tie takes the incoming row');
    assert.equal(goneAt(intoA, 2003), null);
    intoA.close();

    // A into B: the gone mark travels when it is the later observation.
    const a2 = await build('a2.db');
    set(a2, 2000, 100, 300);
    a2.close();
    const b2 = await build('b2.db');
    set(b2, 2000, 200, null);
    b2.mergeFrom(join(dir, 'a2.db'), 9_000);
    assert.equal(goneAt(b2, 2000), 300, 'a later gone mark replaces an older read');
    b2.close();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
