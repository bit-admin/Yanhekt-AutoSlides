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
