/**
 * The crawl loop. Lanes walk session ids; each lane has a direction, an
 * optional end, and a rule for what to do at the newest id (the frontier).
 *
 * Default lanes (see `defaultLanes`):
 * - forward:  from INITIAL upward, following new sessions as Yanhekt creates
 *             them (about a week ahead, ~5k ids per teaching week). At the
 *             newest id it parks until the next night.
 * - backfill: from INITIAL-1 downward to FLOOR, newest terms first.
 * A range lane (`--from A --to B`) walks exactly A→B and then is done.
 *
 * Ids are dense but have holes (deleted ranges up to ~10k ids). After
 * `gapThreshold` misses in a row a lane probes ahead every `probeStep` ids;
 * if it finds a live id it skips the hole (recorded in `gaps`), otherwise an
 * upward lane has reached the newest id.
 *
 * Each round scans a batch of ids, then fetches what that batch queued
 * (course details; video URLs when enabled), then sometimes re-checks recent
 * lectures that had no video yet. Every step is one SQLite transaction, so a
 * crash or Ctrl-C never leaves a saved position ahead of saved data.
 */

import type { Api, Budget, Json, Outcome } from './yanhekt.ts';
import type { LaneState, RunStats, Store } from './store.ts';
import { cnClock } from './time.ts';

export interface LaneSpec {
  /** Stable name; progress is saved under it. */
  key: string;
  /** First id on a fresh start. */
  start: number;
  dir: 1 | -1;
  /** Last id to visit (inclusive), or null for "until the newest id". */
  end: number | null;
  /** At the newest id: park until the next night, or finish. */
  atFrontier: 'park' | 'finish';
}

export interface CrawlerConfig {
  fetchVideos: boolean;
  fetchCourseDetail: boolean;
  /** Session ids per round (= per transaction). */
  batchSize: number;
  gapThreshold: number;
  probeStep: number;
  probeCount: number;
  refreshDays: number;
  refreshEveryRounds: number;
  refreshPerRound: number;
  maxUnexpectedInRow: number;
}

/** Network/server trouble: work so far is committed, then the run backs off. */
export class TransientError extends Error {}

export type RoundResult = 'ok' | 'idle' | 'budget' | 'aborted';

export interface CrawlerDeps {
  api: Api;
  budget: Budget;
  store: Store;
  config: CrawlerConfig;
  lanes: LaneSpec[];
  now: () => number;
  /** When a parking lane hits the frontier, park it until this time. */
  parkUntil: (nowMs: number) => number;
  signal?: AbortSignal;
  log?: (msg: string) => void;
}

export function defaultLanes(initialId: number, floorId: number): LaneSpec[] {
  return [
    { key: 'forward', start: initialId, dir: 1, end: null, atFrontier: 'park' },
    { key: 'backfill', start: initialId - 1, dir: -1, end: floorId, atFrontier: 'finish' },
  ];
}

/** `--from A [--to B]`: exactly A→B, or A upward until the newest id. */
export function rangeLane(from: number, to: number | null): LaneSpec {
  return {
    key: `range:${from}:${to ?? 'newest'}`,
    start: from,
    dir: to != null && to < from ? -1 : 1,
    end: to,
    atFrontier: 'finish',
  };
}

export function freshLane(spec: LaneSpec): LaneState {
  return { cursor: spec.start, missRun: 0, missRunStart: null, parkedUntilMs: null, done: false };
}

/** Is `id` beyond the lane's end? */
function pastEnd(spec: LaneSpec, id: number): boolean {
  return spec.end != null && (spec.dir > 0 ? id > spec.end : id < spec.end);
}

export interface LaneProgress {
  spec: LaneSpec;
  state: LaneState;
  /** Cursor when this crawler was created. */
  runStartCursor: number;
}

export class Crawler {
  readonly stats: RunStats = { requests: 0, sessionsFound: 0, sessionsMissing: 0, courses: 0, videos: 0 };
  private readonly d: CrawlerDeps;
  private lanes = new Map<string, LaneState>();
  private readonly runStart = new Map<string, number>();
  private unexpectedInRow = 0;
  private round = 0;

  constructor(deps: CrawlerDeps) {
    this.d = deps;
    this.loadLanes();
    for (const spec of deps.lanes) this.runStart.set(spec.key, this.lane(spec).cursor);
  }

  private loadLanes(): void {
    this.lanes = new Map(this.d.lanes.map((s) => [s.key, this.d.store.loadLane(s.key) ?? freshLane(s)]));
  }

  private lane(spec: LaneSpec): LaneState {
    return this.lanes.get(spec.key)!;
  }

  progress(): LaneProgress[] {
    return this.d.lanes.map((spec) => ({ spec, state: { ...this.lane(spec) }, runStartCursor: this.runStart.get(spec.key)! }));
  }

  private log(msg: string): void {
    this.d.log?.(msg);
  }

  private stopped(): boolean {
    return this.d.signal?.aborted === true;
  }

  private saveLanes(): void {
    for (const spec of this.d.lanes) this.d.store.saveLane(spec.key, this.lane(spec));
  }

  /** Run `fn` in one transaction. Transient errors keep what was done; anything else rolls back. */
  private async tx<T>(fn: () => Promise<T>): Promise<T> {
    const { store } = this.d;
    store.begin();
    try {
      const out = await fn();
      this.saveLanes();
      store.commit();
      return out;
    } catch (err) {
      if (err instanceof TransientError) {
        this.saveLanes();
        store.commit();
      } else {
        store.rollback();
        this.loadLanes();
      }
      throw err;
    } finally {
      this.stats.requests = this.d.budget.spent;
    }
  }

  /** One round: scan a batch, fetch what it queued, sometimes re-check recent sessions. */
  async runRound(): Promise<RoundResult> {
    const n = this.round++;
    const scan = await this.tx(() => this.scanBatch());
    const enriched = await this.tx(() => this.enrich());
    let refreshed = 0;
    if (n % this.d.config.refreshEveryRounds === 0) refreshed = await this.tx(() => this.refresh());

    if (this.stopped()) return 'aborted';
    if (scan === 'budget' || !this.d.budget.canAfford(1)) return 'budget';
    if (scan === 'idle' && enriched === 0 && refreshed === 0) return 'idle';
    return 'ok';
  }

  private activeLane(): LaneSpec | null {
    const now = this.d.now();
    for (const spec of this.d.lanes) {
      const s = this.lane(spec);
      if (s.done) continue;
      if (s.parkedUntilMs != null && now < s.parkedUntilMs) continue;
      return spec;
    }
    return null;
  }

  private unexpected(kind: string, id: number, o: { code: string; message: string }): void {
    this.d.store.recordFailure(kind, id, o.code, o.message, this.d.now());
    this.log(`unexpected ${kind} ${id}: code ${o.code} ${o.message}`);
    if (++this.unexpectedInRow >= this.d.config.maxUnexpectedInRow) {
      this.unexpectedInRow = 0;
      throw new TransientError(`${this.d.config.maxUnexpectedInRow} unexpected codes in a row (last ${o.code})`);
    }
  }

  /** Every Yanhekt request goes through here: charge the budget, surface transient errors. */
  private async call<T>(fn: () => Promise<Outcome<T>>): Promise<Exclude<Outcome<T>, { kind: 'transient' }>> {
    this.d.budget.take();
    const o = await fn();
    if (o.kind === 'transient') throw new TransientError(o.reason);
    if (o.kind !== 'unexpected') this.unexpectedInRow = 0;
    return o;
  }

  /** Scan up to `batchSize` ids (probes count too). */
  private async scanBatch(): Promise<'ok' | 'idle' | 'budget'> {
    const { config, budget } = this.d;
    let steps = 0;
    while (steps < config.batchSize) {
      if (this.stopped()) return 'ok';
      const spec = this.activeLane();
      if (!spec) return steps > 0 ? 'ok' : 'idle';
      const lane = this.lane(spec);

      if (pastEnd(spec, lane.cursor)) {
        lane.done = true;
        this.log(`${spec.key}: reached ${spec.end}, done`);
        continue;
      }
      if (!budget.canAfford(1)) return 'budget';

      if (lane.missRun >= config.gapThreshold) {
        steps += await this.probe(spec, lane);
        continue;
      }

      const id = lane.cursor;
      const o = await this.call(() => this.d.api.session(id));
      steps += 1;
      if (o.kind === 'ok') {
        this.d.store.saveSession(o.data, this.d.now(), { refreshed: false, queueVideos: config.fetchVideos });
        this.stats.sessionsFound += 1;
        lane.missRun = 0;
        lane.missRunStart = null;
      } else if (o.kind === 'missing') {
        this.stats.sessionsMissing += 1;
        if (lane.missRun === 0) lane.missRunStart = id;
        lane.missRun += 1;
      } else {
        this.unexpected('session', id, o);
        // Yanhekt answers some ids that do not exist with an error code (2002)
        // instead of "not found", about one in four above the newest id. Count
        // them toward the miss run, or the lane never notices it has passed
        // the newest id and walks on through empty ids for hours.
        if (lane.missRun === 0) lane.missRunStart = id;
        lane.missRun += 1;
      }
      lane.cursor += spec.dir;
    }
    return 'ok';
  }

  /**
   * After a long missing run, look ahead at cursor ± k·step. Returns requests used.
   * On a hit at k, jump to the previous probe point (k-1) and scan linearly
   * from there; ids in between are recorded as a skipped gap.
   */
  private async probe(spec: LaneSpec, lane: LaneState): Promise<number> {
    const { config, budget, store } = this.d;
    const dir = spec.dir;
    let used = 0;
    let cut = false;
    for (let k = 1; k <= config.probeCount; k++) {
      const id = lane.cursor + dir * k * config.probeStep;
      if (pastEnd(spec, id)) {
        cut = true;
        break;
      }
      if (this.stopped() || !budget.canAfford(1)) return used; // state unchanged: probe again next time
      const o = await this.call(() => this.d.api.session(id));
      used += 1;
      if (o.kind === 'ok') {
        const resume = lane.cursor + dir * (k - 1) * config.probeStep;
        if (k > 1) store.recordGap(spec.key, lane.cursor, resume - dir, `skipped: no hit at probes 1..${k - 1}`, this.d.now());
        this.log(`${spec.key}: ${lane.missRun} misses from ${lane.missRunStart}; next id found at ${id}, resuming at ${resume}`);
        lane.cursor = resume;
        lane.missRun = 0;
        lane.missRunStart = null;
        return used;
      }
    }

    const reset = () => {
      lane.missRun = 0;
      lane.missRunStart = null;
    };
    if (cut) {
      // Probes ran into the lane's end without a hit: nothing left to find.
      store.recordGap(spec.key, lane.cursor, spec.end!, 'skipped: no hit before the end of the range', this.d.now());
      this.log(`${spec.key}: nothing found between ${lane.cursor} and ${spec.end}; done`);
      lane.cursor = spec.end! + dir;
      lane.done = true;
      reset();
    } else if (dir > 0) {
      // Nothing ahead: this is the newest id. Rewind to the start of the run
      // so ids created there later are not skipped, and never stay above the
      // newest stored session (a lane that overran the end comes back).
      const newest = store.maxSessionId();
      lane.cursor = lane.missRunStart ?? lane.cursor;
      if (newest + 1 >= spec.start) lane.cursor = Math.min(lane.cursor, newest + 1);
      reset();
      if (spec.atFrontier === 'park') {
        lane.parkedUntilMs = this.d.parkUntil(this.d.now());
        this.log(`${spec.key}: reached the newest id (${lane.cursor}); parked until ${cnClock(lane.parkedUntilMs)} UTC+8`);
      } else {
        lane.done = true;
        this.log(`${spec.key}: reached the newest id (${lane.cursor}); done`);
      }
    } else {
      const span = config.probeCount * config.probeStep;
      const to = lane.cursor - span;
      store.recordGap(spec.key, lane.cursor, to, `skipped: no hit in ${span} ids`, this.d.now());
      this.log(`${spec.key}: nothing found in ${lane.cursor}..${to}; skipping`);
      lane.cursor = to - 1;
      reset();
    }
    return used;
  }

  /** Fetch course details and (when enabled) video URLs queued so far. Returns requests used. */
  private async enrich(): Promise<number> {
    const { config, store, budget } = this.d;
    let used = 0;

    if (config.fetchCourseDetail) {
      for (const id of store.pendingCourses(config.batchSize)) {
        if (this.stopped() || !budget.canAfford(1)) return used;
        const c = await this.call(() => this.d.api.course(id));
        used += 1;
        if (c.kind === 'ok') {
          store.saveCourseDetail(c.data, this.d.now());
          this.stats.courses += 1;
        } else if (c.kind === 'missing') {
          store.markCourse(id, 'missing', this.d.now());
        } else {
          store.markCourse(id, 'error', this.d.now());
          this.unexpected('course', id, c);
        }
      }
    }

    if (config.fetchVideos) {
      for (const v of store.pendingVideos(config.batchSize * 2)) {
        if (this.stopped() || !budget.canAfford(1)) return used;
        const o = await this.call(() => this.d.api.video(v.videoId));
        used += 1;
        if (o.kind === 'ok') {
          store.saveVideo(o.data as Json, v.sessionId, this.d.now());
          this.stats.videos += 1;
        } else if (o.kind === 'missing') {
          store.markVideoMissing(v.videoId, v.sessionId, this.d.now());
        } else {
          store.bumpVideoAttempt(v.videoId, `${o.code} ${o.message}`);
          this.unexpected('video', v.videoId, o);
        }
      }
    }
    return used;
  }

  /**
   * Sessions are created about a week before they happen, so the first scan
   * sees no video id. Re-check ones that ended 2h..refreshDays ago, at most
   * once every 20h, until a video id shows up.
   */
  private async refresh(): Promise<number> {
    const { config, store, budget } = this.d;
    if (config.refreshDays <= 0 || config.refreshPerRound <= 0) return 0;
    const now = this.d.now();
    const ids = store.refreshCandidates(
      cnClock(now - 2 * 3600_000),
      cnClock(now - config.refreshDays * 24 * 3600_000),
      now - 20 * 3600_000,
      config.refreshPerRound,
    );
    let used = 0;
    for (const id of ids) {
      if (this.stopped() || !budget.canAfford(1)) return used;
      const o = await this.call(() => this.d.api.session(id));
      used += 1;
      if (o.kind === 'ok') store.saveSession(o.data, this.d.now(), { refreshed: true, queueVideos: config.fetchVideos });
      else if (o.kind === 'missing') store.markSessionGone(id, this.d.now());
      else this.unexpected('session', id, o);
    }
    return used;
  }
}
