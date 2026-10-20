/**
 * The crawl loop. Two lanes walk session ids:
 *
 * - forward:  from INITIAL upward. Follows new sessions as Yanhekt creates
 *             them (about a week ahead, ~5k ids per teaching week). When it
 *             runs past the newest id it parks until the next night.
 * - backfill: from INITIAL-1 downward to FLOOR, newest terms first, so the
 *             most useful history lands first.
 *
 * Ids are dense but have holes (deleted ranges up to ~10k ids). After
 * `gapThreshold` misses in a row a lane probes ahead every `probeStep` ids;
 * if it finds a live id it skips the hole (recorded in `gaps`), otherwise
 * forward treats it as the frontier.
 *
 * Each round scans a batch of ids, then resolves the video/course backlog
 * that batch created, then (every few rounds) re-checks recent lectures that
 * had no video yet. Every round is one SQLite transaction, so a crash or
 * Ctrl-C never leaves the cursor ahead of the data.
 */

import type { Api, Budget, Json, Outcome } from './yanhekt.ts';
import type { CrawlState, LaneState, RunStats, Store } from './store.ts';
import { cnClock } from './time.ts';

export interface CrawlerConfig {
  initialSessionId: number;
  floorSessionId: number;
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

export type LaneName = 'forward' | 'backfill';

/** Network/server trouble: the round is committed up to here, then the run backs off. */
export class TransientError extends Error {}

export type RoundResult = 'ok' | 'idle' | 'budget' | 'aborted';

export interface CrawlerDeps {
  api: Api;
  budget: Budget;
  store: Store;
  config: CrawlerConfig;
  now: () => number;
  /** When the forward lane hits the frontier, park it until this time. */
  parkUntil: (nowMs: number) => number;
  signal?: AbortSignal;
  log?: (msg: string) => void;
}

export function initialState(c: Pick<CrawlerConfig, 'initialSessionId'>): CrawlState {
  return {
    forward: { cursor: c.initialSessionId, missRun: 0, missRunStart: null, parkedUntilMs: null, done: false },
    backfill: { cursor: c.initialSessionId - 1, missRun: 0, missRunStart: null, parkedUntilMs: null, done: false },
  };
}

const DIR: Record<LaneName, 1 | -1> = { forward: 1, backfill: -1 };

export class Crawler {
  readonly stats: RunStats = { requests: 0, sessionsFound: 0, sessionsMissing: 0, courses: 0, videos: 0 };
  state: CrawlState;
  private readonly d: CrawlerDeps;
  private unexpectedInRow = 0;
  private round = 0;

  constructor(deps: CrawlerDeps) {
    this.d = deps;
    this.state = deps.store.loadState(initialState(deps.config));
  }

  private log(msg: string): void {
    this.d.log?.(msg);
  }

  private stopped(): boolean {
    return this.d.signal?.aborted === true;
  }

  /** Run `fn` in one transaction. Transient errors keep what was done; anything else rolls back. */
  private async tx<T>(fn: () => Promise<T>): Promise<T> {
    const { store } = this.d;
    store.begin();
    try {
      const out = await fn();
      store.saveState(this.state);
      store.commit();
      return out;
    } catch (err) {
      if (err instanceof TransientError) {
        store.saveState(this.state);
        store.commit();
      } else {
        store.rollback();
        this.state = store.loadState(initialState(this.d.config));
      }
      throw err;
    } finally {
      this.stats.requests = this.d.budget.spent;
    }
  }

  /** One round: scan a batch, resolve its backlog, sometimes re-check recent sessions. */
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

  private activeLane(): LaneName | null {
    const { forward, backfill } = this.state;
    if (!(forward.parkedUntilMs != null && this.d.now() < forward.parkedUntilMs)) return 'forward';
    if (!backfill.done) return 'backfill';
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
      const name = this.activeLane();
      if (!name) return steps > 0 ? 'ok' : 'idle';
      const lane = this.state[name];

      if (name === 'backfill' && lane.cursor < config.floorSessionId) {
        lane.done = true;
        this.log(`backfill reached floor ${config.floorSessionId}`);
        continue;
      }
      if (!budget.canAfford(1)) return 'budget';

      if (lane.missRun >= config.gapThreshold) {
        const probed = await this.probe(name, lane);
        steps += probed;
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
        lane.missRun = 0;
        lane.missRunStart = null;
      }
      lane.cursor += DIR[name];
    }
    return 'ok';
  }

  /**
   * After a long missing run, look ahead at cursor ± k·step. Returns requests used.
   * On a hit at k, jump to the previous probe point (k-1) and scan linearly
   * from there; ids in between are recorded as a skipped gap.
   */
  private async probe(name: LaneName, lane: LaneState): Promise<number> {
    const { config, budget, store } = this.d;
    const dir = DIR[name];
    let used = 0;
    for (let k = 1; k <= config.probeCount; k++) {
      if (this.stopped() || !budget.canAfford(1)) return used; // state unchanged: probe again next time
      const id = lane.cursor + dir * k * config.probeStep;
      if (name === 'backfill' && id < config.floorSessionId) break;
      const o = await this.call(() => this.d.api.session(id));
      used += 1;
      if (o.kind === 'ok') {
        const resume = lane.cursor + dir * (k - 1) * config.probeStep;
        if (k > 1) {
          store.recordGap(name, lane.cursor, resume - dir, `skipped: no hit at probes 1..${k - 1}`, this.d.now());
        }
        this.log(`${name}: ${lane.missRun} misses from ${lane.missRunStart}; next id found at ${id}, resuming at ${resume}`);
        lane.cursor = resume;
        lane.missRun = 0;
        lane.missRunStart = null;
        return used;
      }
    }

    const span = config.probeCount * config.probeStep;
    if (name === 'forward') {
      // Nothing ahead: this is the newest id. Rewind to the start of the run
      // so ids created later in that range are not skipped, and park.
      const until = this.d.parkUntil(this.d.now());
      this.log(`forward: frontier at ${lane.missRunStart}; parked until ${cnClock(until)} (UTC+8)`);
      lane.cursor = lane.missRunStart ?? lane.cursor;
      lane.missRun = 0;
      lane.missRunStart = null;
      lane.parkedUntilMs = until;
    } else {
      const to = Math.max(config.floorSessionId, lane.cursor - span);
      store.recordGap(name, lane.cursor, to, `skipped: no hit in ${span} ids`, this.d.now());
      this.log(`backfill: nothing found in ${lane.cursor}..${to}; skipping`);
      lane.cursor = to - 1;
      lane.missRun = 0;
      lane.missRunStart = null;
    }
    return used;
  }

  /** Resolve course details and video URLs queued by scanned sessions. Returns requests used. */
  private async enrich(): Promise<number> {
    const { config, store, budget } = this.d;
    let used = 0;

    if (config.fetchCourseDetail) {
      for (const id of store.pendingCourses(config.batchSize)) {
        if (this.stopped() || !budget.canAfford(2)) return used;
        const c = await this.call(() => this.d.api.course(id));
        used += 1;
        if (c.kind === 'ok') {
          const p = await this.call(() => this.d.api.professors(id));
          used += 1;
          store.saveCourseDetail(c.data, p.kind === 'ok' ? p.data : null, this.d.now());
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
   * sees no video. Re-check ones that ended 2h..refreshDays ago, at most
   * once every 20h, until a video shows up.
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
