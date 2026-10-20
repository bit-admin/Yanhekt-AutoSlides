import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Crawler, TransientError, defaultLanes, rangeLane } from './crawler.ts';
import { SqliteStore } from './store.ts';
import { Budget } from './yanhekt.ts';
import { config, drain, FakeApi, make } from './testkit.ts';

const count = (store: SqliteStore, sql: string) => Number(Object.values(store.db.prepare(sql).get() as object)[0]);

test('default lanes: forward parks at the newest id, backfill skips a hole and reaches the floor', async () => {
  // ids 1..1029 exist except a deleted range 400..699; nothing above 1029.
  const ids = [...Array(1029).keys()].map((i) => i + 1).filter((i) => i < 400 || i >= 700);
  const api = new FakeApi(ids);
  const { crawler, store } = make(api, defaultLanes(1000, 1));

  assert.equal(await drain(crawler), 'idle');
  assert.equal(count(store, 'SELECT COUNT(*) FROM sessions'), ids.length);
  assert.equal(count(store, "SELECT COUNT(*) FROM courses WHERE detail_status = 'ok'"), 7);

  // Default: no video lookups at all, but video ids are kept on the session.
  assert.equal(api.calls.filter((c) => c[0] === 'v').length, 0);
  assert.equal(count(store, 'SELECT COUNT(*) FROM videos'), 0);
  assert.equal(count(store, "SELECT COUNT(*) FROM sessions WHERE video_ids <> '[]'"), ids.length);

  const [fwd, back] = crawler.progress();
  assert.equal(fwd.state.cursor, 1030, 'forward rewinds to the first missing id');
  assert.ok(fwd.state.parkedUntilMs);
  assert.equal(back.state.done, true);

  const holeCalls = api.calls.filter((c) => c[0] === 's' && Number(c.slice(1)) >= 400 && Number(c.slice(1)) < 700).length;
  assert.ok(holeCalls < 150, `walked ${holeCalls} ids of a 300-id hole`);
});

test('range lane: walks exactly from→to, either direction, and resumes', async () => {
  const ids = [...Array(200).keys()].map((i) => 900 + i); // 900..1099
  const api = new FakeApi(ids);
  const store = new SqliteStore(':memory:');

  const down = rangeLane(1050, 1000);
  assert.equal(down.dir, -1);
  const first = make(api, [down], store, { ...config, batchSize: 10 }).crawler;
  await first.runRound(); // 10 ids
  assert.equal(first.progress()[0].state.cursor, 1040);

  // A new process with the same --from/--to continues at 1040.
  const second = make(api, [down], store).crawler;
  assert.equal(second.progress()[0].state.cursor, 1040);
  assert.equal(await drain(second), 'idle');
  assert.equal(second.progress()[0].state.done, true);
  assert.equal(count(store, 'SELECT COUNT(*) FROM sessions'), 51);
  assert.equal(count(store, 'SELECT MIN(id) FROM sessions'), 1000);

  // Upward with no end: stops (not parks) at the newest id.
  const up = make(api, [rangeLane(1090, null)], store).crawler;
  assert.equal(await drain(up), 'idle');
  const st = up.progress()[0].state;
  assert.equal(st.done, true);
  assert.equal(st.cursor, 1100);
  assert.equal(st.parkedUntilMs, null);
});

test('rows keep every field: columns, extra, unescaped URLs, nested live, teachers from /v1/course', async () => {
  const api = new FakeApi([1000]);
  const { crawler, store } = make(api, [rangeLane(1000, 1000)]);
  await drain(crawler);
  const s = store.db.prepare('SELECT * FROM sessions WHERE id = 1000').get() as Record<string, unknown>;
  assert.equal(s.course_id, 506);
  assert.equal(s.video_ids, '[10000]');
  assert.equal(s.live_id, 101_000);
  assert.deepEqual(JSON.parse(String(s.extra)), { brand_new_field: 'kept in extra' });
  assert.ok(Number(s.changed_at) > 0);

  const l = store.db.prepare('SELECT * FROM lives WHERE id = 101000').get() as Record<string, unknown>;
  assert.equal(l.target, 'https://clive13.yanhekt.cn/live/1_Video1.m3u8');
  assert.equal(l.extra, null); // laravel_through_key dropped

  const c = store.db.prepare('SELECT * FROM courses WHERE id = 506').get() as Record<string, unknown>;
  assert.equal(c.detail_status, 'ok');
  assert.equal(c.professor_names, '裴老师、王老师');
  assert.equal(c.tags, '[{"id":100}]');
});

test('--videos later: stored video ids are queued and filled without rescanning', async () => {
  const api = new FakeApi([1000, 1001, 1002]);
  const store = new SqliteStore(':memory:');
  await drain(make(api, [rangeLane(1000, 1002)], store).crawler);
  assert.equal(count(store, 'SELECT COUNT(*) FROM videos'), 0);

  assert.equal(store.queueMissingVideos(1), 3);
  assert.equal(store.queueMissingVideos(1), 0, 'idempotent');
  api.calls = [];
  const filler = make(api, [], store, { ...config, fetchVideos: true }).crawler;
  assert.equal(await drain(filler), 'idle');
  assert.deepEqual(api.calls.sort(), ['v10000', 'v10010', 'v10020']);
  const v = store.db.prepare('SELECT * FROM videos WHERE id = 10010').get() as Record<string, unknown>;
  assert.equal(v.main, 'https://cvideo.yanhekt.cn/vod/10010/Video1.m3u8');
  assert.equal(v.session_id, 1001);
  assert.equal(v.duration, 8934);
  assert.equal(v.extra, null); // course_id/session_id 0 dropped
  assert.equal(count(store, 'SELECT COUNT(*) FROM pending_videos'), 0);
});

test('a transient error keeps finished work and retries the same id', async () => {
  const api = new FakeApi([...Array(60).keys()].map((i) => 1000 + i));
  api.failOn.add(1010);
  const store = new SqliteStore(':memory:');
  const lanes = [rangeLane(1000, null)];
  const { crawler } = make(api, lanes, store);

  await assert.rejects(crawler.runRound(), TransientError);
  assert.equal(store.loadLane(lanes[0].key)?.cursor, 1010, 'cursor committed with the 10 sessions before the error');
  assert.equal(count(store, 'SELECT COUNT(*) FROM sessions'), 10);

  api.failOn.clear();
  await drain(make(api, lanes, store).crawler);
  assert.equal(count(store, 'SELECT COUNT(*) FROM sessions'), 60);
});

test('budget cap stops the run', async () => {
  const api = new FakeApi([...Array(100).keys()].map((i) => 1000 + i));
  const store = new SqliteStore(':memory:');
  const budget = new Budget(30, Number.POSITIVE_INFINITY, 0);
  const crawler = new Crawler({ api, budget, store, config, lanes: defaultLanes(1000, 1), now: () => 0, parkUntil: (t) => t });
  let r;
  do r = await crawler.runRound();
  while (r === 'ok');
  assert.equal(r, 'budget');
  assert.equal(api.calls.length, 30);
});
