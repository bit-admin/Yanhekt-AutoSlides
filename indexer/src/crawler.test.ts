import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Crawler, TransientError, type CrawlerConfig } from './crawler.ts';
import { SqliteStore } from './store.ts';
import { Budget, type Api, type Json, type Outcome } from './yanhekt.ts';

const config: CrawlerConfig = {
  initialSessionId: 1000,
  floorSessionId: 1,
  fetchVideos: true,
  fetchCourseDetail: true,
  batchSize: 25,
  gapThreshold: 10,
  probeStep: 50,
  probeCount: 5,
  refreshDays: 14,
  refreshEveryRounds: 10,
  refreshPerRound: 5,
  maxUnexpectedInRow: 5,
};

function session(id: number): Json {
  const courseId = 500 + (id % 7);
  return {
    id,
    course_id: courseId,
    title: `第${id % 16}周`,
    day: 2,
    started_at: '2025-09-16 18:30:00',
    ended_at: '2025-09-16 20:55:00',
    state: 1,
    video_ids: [id * 10],
    digit_human: null,
    brand_new_field: 'kept in extra',
    course: { id: courseId, name_zh: `课程${courseId}`, school_year: '2025-2026', semester: 1, user_mapping_type: 0 },
    live: { id: id + 100_000, status: 3, target: 'https:\\/\\/clive13.yanhekt.cn\\/live/1_Video1.m3u8', laravel_through_key: id },
    user_progress: [],
  };
}

class FakeApi implements Api {
  calls: string[] = [];
  existing: Set<number>;
  failOn = new Set<number>();
  constructor(existing: Iterable<number>) {
    this.existing = new Set(existing);
  }
  async session(id: number): Promise<Outcome<Json>> {
    this.calls.push(`s${id}`);
    if (this.failOn.has(id)) return { kind: 'transient', reason: 'http 502' };
    return this.existing.has(id) ? { kind: 'ok', data: session(id) } : { kind: 'missing' };
  }
  async video(id: number): Promise<Outcome<Json>> {
    this.calls.push(`v${id}`);
    return { kind: 'ok', data: { id, course_id: 0, session_id: 0, main: `https:\\/\\/cvideo.yanhekt.cn\\/vod\\/${id}\\/Video1.m3u8`, duration: '8934' } };
  }
  async course(id: number): Promise<Outcome<Json>> {
    this.calls.push(`c${id}`);
    return { kind: 'ok', data: { id, name_zh: `课程${id}`, school_year: '2025-2026', semester: 1, professors: [], tags: [{ id: 100 }] } };
  }
  async professors(courseId: number): Promise<Outcome<unknown[]>> {
    this.calls.push(`p${courseId}`);
    return { kind: 'ok', data: [{ id: 1, name: '裴老师', badge: 'x' }] };
  }
}

function make(api: Api, store = new SqliteStore(':memory:'), cfg = config) {
  const budget = new Budget(Number.MAX_SAFE_INTEGER, Number.POSITIVE_INFINITY, 0);
  const crawler = new Crawler({ api, budget, store, config: cfg, now: () => 1_000_000, parkUntil: (t) => t + 3600_000 });
  return { crawler, store };
}

async function drain(crawler: Crawler, maxRounds = 500) {
  for (let i = 0; i < maxRounds; i++) {
    const r = await crawler.runRound();
    if (r !== 'ok') return r;
  }
  throw new Error('did not finish');
}

test('forward stops at the frontier, backfill skips a hole and reaches the floor', async () => {
  // ids 1..1029 exist except a deleted range 400..699; nothing above 1029.
  const ids = [...Array(1029).keys()].map((i) => i + 1).filter((i) => i < 400 || i >= 700);
  const api = new FakeApi(ids);
  const { crawler, store } = make(api);

  assert.equal(await drain(crawler), 'idle');

  const n = (sql: string) => Number(Object.values(store.db.prepare(sql).get() as object)[0]);
  assert.equal(n('SELECT COUNT(*) FROM sessions'), ids.length);
  assert.equal(n("SELECT COUNT(*) FROM videos WHERE status = 'ok'"), ids.length);
  assert.equal(n('SELECT COUNT(*) FROM pending_videos'), 0);
  assert.equal(n("SELECT COUNT(*) FROM courses WHERE detail_status = 'ok'"), 7);

  // Forward rewound to the first missing id and parked.
  assert.equal(crawler.state.forward.cursor, 1030);
  assert.ok(crawler.state.forward.parkedUntilMs);
  assert.equal(crawler.state.backfill.done, true);

  // The hole was probed over, not walked id by id.
  const holeCalls = api.calls.filter((c) => {
    const id = Number(c.slice(1));
    return c[0] === 's' && id >= 400 && id < 700;
  }).length;
  assert.ok(holeCalls < 150, `walked ${holeCalls} ids of a 300-id hole`);
  assert.ok(n('SELECT COUNT(*) FROM gaps') >= 1);
});

test('rows keep every field: columns, extra, unescaped URLs, nested live', async () => {
  const api = new FakeApi([1000]);
  const { crawler, store } = make(api, undefined, { ...config, initialSessionId: 1000, floorSessionId: 1000 });
  await drain(crawler);
  const s = store.db.prepare('SELECT * FROM sessions WHERE id = 1000').get() as Record<string, unknown>;
  assert.equal(s.course_id, 506);
  assert.equal(s.video_ids, '[10000]');
  assert.equal(s.live_id, 101_000);
  assert.deepEqual(JSON.parse(String(s.extra)), { brand_new_field: 'kept in extra' });

  const l = store.db.prepare('SELECT * FROM lives WHERE id = 101000').get() as Record<string, unknown>;
  assert.equal(l.target, 'https://clive13.yanhekt.cn/live/1_Video1.m3u8');
  assert.equal(l.session_id, 1000);
  assert.equal(l.extra, null); // laravel_through_key dropped

  const v = store.db.prepare('SELECT * FROM videos WHERE id = 10000').get() as Record<string, unknown>;
  assert.equal(v.main, 'https://cvideo.yanhekt.cn/vod/10000/Video1.m3u8');
  assert.equal(v.duration, 8934);
  assert.equal(v.session_id, 1000);
  assert.equal(v.extra, null); // course_id/session_id 0 dropped

  const c = store.db.prepare('SELECT * FROM courses WHERE id = 506').get() as Record<string, unknown>;
  assert.equal(c.detail_status, 'ok');
  assert.equal(c.professor_names, '裴老师');
  assert.equal(c.tags, '[{"id":100}]');
});

test('a transient error keeps finished work and retries the same id', async () => {
  const api = new FakeApi([...Array(60).keys()].map((i) => 1000 + i));
  api.failOn.add(1010);
  const store = new SqliteStore(':memory:');
  const { crawler } = make(api, store, { ...config, floorSessionId: 1000 });

  await assert.rejects(crawler.runRound(), TransientError);
  assert.equal(crawler.state.forward.cursor, 1010);
  const saved = JSON.parse((store.db.prepare("SELECT value FROM crawl_state WHERE key='lanes'").get() as { value: string }).value);
  assert.equal(saved.forward.cursor, 1010, 'cursor committed with the 10 sessions before the error');
  assert.equal(Number(Object.values(store.db.prepare('SELECT COUNT(*) FROM sessions').get() as object)[0]), 10);

  api.failOn.clear();
  // A new crawler on the same db resumes from the saved cursor.
  const again = make(api, store, { ...config, floorSessionId: 1000 }).crawler;
  await drain(again);
  assert.equal(Number(Object.values(store.db.prepare('SELECT COUNT(*) FROM sessions').get() as object)[0]), 60);
});

test('budget cap stops the run', async () => {
  const api = new FakeApi([...Array(100).keys()].map((i) => 1000 + i));
  const store = new SqliteStore(':memory:');
  const budget = new Budget(30, Number.POSITIVE_INFINITY, 0);
  const crawler = new Crawler({ api, budget, store, config, now: () => 0, parkUntil: (t) => t });
  let r;
  do r = await crawler.runRound();
  while (r === 'ok');
  assert.equal(r, 'budget');
  assert.equal(api.calls.length, 30);
});
