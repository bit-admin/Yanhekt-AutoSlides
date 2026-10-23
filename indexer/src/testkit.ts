/** Shared test helpers (not a test file itself). */
import { Crawler, type CrawlerConfig, type LaneSpec } from './crawler.ts';
import { SqliteStore } from './store.ts';
import { Budget, type Api, type Json, type Outcome } from './yanhekt.ts';

export const config: CrawlerConfig = {
  fetchVideos: false,
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

export function session(id: number): Json {
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

export class FakeApi implements Api {
  calls: string[] = [];
  existing: Set<number>;
  failOn = new Set<number>();
  /** Ids answered with code 2002, as Yanhekt does for some ids that do not exist. */
  errorOn = new Set<number>();
  constructor(existing: Iterable<number>) {
    this.existing = new Set(existing);
  }
  async session(id: number): Promise<Outcome<Json>> {
    this.calls.push(`s${id}`);
    if (this.failOn.has(id)) return { kind: 'transient', reason: 'http 502' };
    if (this.errorOn.has(id)) return { kind: 'unexpected', code: '2002', message: 'service runtime exception' };
    return this.existing.has(id) ? { kind: 'ok', data: session(id) } : { kind: 'missing' };
  }
  async video(id: number): Promise<Outcome<Json>> {
    this.calls.push(`v${id}`);
    return {
      kind: 'ok',
      data: { id, course_id: 0, session_id: 0, main: `https:\\/\\/cvideo.yanhekt.cn\\/vod\\/${id}\\/Video1.m3u8`, duration: '8934' },
    };
  }
  async course(id: number): Promise<Outcome<Json>> {
    this.calls.push(`c${id}`);
    return {
      kind: 'ok',
      data: {
        id,
        name_zh: `课程${id}`,
        school_year: '2025-2026',
        semester: 1,
        professors: [{ id: 1, name: '裴老师', badge: 'x' }, { id: 2, name: '王老师' }],
        tags: [{ id: 100 }],
      },
    };
  }
}

export function make(api: Api, lanes: LaneSpec[], store = new SqliteStore(':memory:'), cfg = config) {
  const budget = new Budget(Number.MAX_SAFE_INTEGER, Number.POSITIVE_INFINITY, 0);
  const crawler = new Crawler({ api, budget, store, config: cfg, lanes, now: () => 1_000_000, parkUntil: (t) => t + 3600_000 });
  return { crawler, store };
}

export async function drain(crawler: Crawler, maxRounds = 500) {
  for (let i = 0; i < maxRounds; i++) {
    const r = await crawler.runRound();
    if (r !== 'ok') return r;
  }
  throw new Error('did not finish');
}

