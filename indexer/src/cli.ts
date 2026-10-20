#!/usr/bin/env node
/**
 * yanhekt-indexer — local, no-auth Yanhekt session indexer.
 *
 *   node src/cli.ts run      wait for the nightly window, crawl until it closes, repeat
 *   node src/cli.ts now      crawl right now for --minutes (testing / catch-up)
 *   node src/cli.ts status   progress, coverage per term, recent runs
 *   node src/cli.ts dump     write SQL files for `wrangler d1 execute --file`
 *
 * Run `node src/cli.ts --help` for options.
 */

import { parseArgs } from 'node:util';
import { closeSync, openSync, readFileSync, unlinkSync, writeSync } from 'node:fs';
import { hostname } from 'node:os';
import { resolve } from 'node:path';
import { Crawler, TransientError, type CrawlerConfig } from './crawler.ts';
import { SqliteStore } from './store.ts';
import { cnClock, inWindow, nextWindowStartMs, windowEndMs } from './time.ts';
import { Budget, Pacer, YanhektClient, sleep } from './yanhekt.ts';
import { printStatus } from './status.ts';
import { dumpForD1 } from './dump.ts';

const DEFAULT_UA = 'AutoSlides-Indexer/0.1 (+https://github.com/bit-admin/Yanhekt-AutoSlides)';

const HELP = `yanhekt-indexer — walk Yanhekt session ids without logging in, store everything in SQLite.

Commands
  run       Wait for the window, crawl until it closes, then wait for the next night.
            Keep it running (tmux, systemd, launchd, Task Scheduler…).
  now       Crawl immediately, ignoring the window, for --minutes (default 10).
  status    Show progress, per-term coverage and recent runs.
  dump      Write the database as SQL files for Cloudflare D1 (--out DIR).

Options
  --db PATH             SQLite file (default ./data/yanhekt-index.db)
  --window 2-5          Crawl window in Beijing time (UTC+8), start-end hours (default 2-5)
  --once                run: exit after one window instead of waiting for the next
  --minutes N           now: how long to crawl (default 10)
  --interval-ms N       Time between request starts, min 250 (default 1000 = 1 req/s)
  --max-requests N      Cap per window / per 'now' run, 0 = no cap (default 0)
  --batch N             Session ids per round / transaction (default 25)
  --initial-id N        Where both lanes start on a fresh database (default 932000)
  --floor-id N          Backfill stops below this id (default 1)
  --no-videos           Do not call /v1/video (no stream URLs)
  --no-course-detail    Do not call /v1/course + professor list (nested course only)
  --gap-threshold N     Misses in a row before probing ahead (default 150)
  --probe-step N        Probe spacing (default 500)
  --probe-count N       Probes per gap (default 20)
  --refresh-days N      Re-check sessions without video that ended within N days (default 14)
  --user-agent S        User-Agent header (default identifies this project)
  --out DIR             dump: output directory (default ./d1-dump)
  --max-mb N            dump: max size of one SQL file (default 50)
  -q, --quiet           Only log round summaries and errors
  -h, --help
`;

const { values: opts, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    db: { type: 'string', default: './data/yanhekt-index.db' },
    window: { type: 'string', default: '2-5' },
    once: { type: 'boolean', default: false },
    minutes: { type: 'string', default: '10' },
    'interval-ms': { type: 'string', default: '1000' },
    'max-requests': { type: 'string', default: '0' },
    batch: { type: 'string', default: '25' },
    'initial-id': { type: 'string', default: '932000' },
    'floor-id': { type: 'string', default: '1' },
    'no-videos': { type: 'boolean', default: false },
    'no-course-detail': { type: 'boolean', default: false },
    'gap-threshold': { type: 'string', default: '150' },
    'probe-step': { type: 'string', default: '500' },
    'probe-count': { type: 'string', default: '20' },
    'refresh-days': { type: 'string', default: '14' },
    'user-agent': { type: 'string', default: DEFAULT_UA },
    out: { type: 'string', default: './d1-dump' },
    'max-mb': { type: 'string', default: '50' },
    quiet: { type: 'boolean', short: 'q', default: false },
    help: { type: 'boolean', short: 'h', default: false },
  },
});

function num(name: string, min: number, max: number): number {
  const raw = (opts as Record<string, unknown>)[name];
  const n = Number(raw);
  if (!Number.isFinite(n) || n < min || n > max) die(`--${name} must be a number between ${min} and ${max} (got ${String(raw)})`);
  return Math.trunc(n);
}

function die(msg: string): never {
  console.error(`error: ${msg}`);
  process.exit(2);
  throw new Error(msg); // unreachable; keeps `never` honest for the type checker
}

function log(msg: string): void {
  console.log(`[${cnClock(Date.now())} UTC+8] ${msg}`);
}

function parseWindow(s: string): [number, number] {
  const m = /^(\d{1,2})-(\d{1,2})$/.exec(s.trim());
  if (!m) die(`--window must look like 2-5 (got ${s})`);
  const a = Number(m[1]);
  const b = Number(m[2]);
  if (a > 23 || b > 24 || a === b) die(`--window hours out of range (got ${s})`);
  return [a, b];
}

/** One process per database. The lock file holds pid + host; a dead pid on this host is stale. */
function acquireLock(dbPath: string): () => void {
  const path = `${dbPath}.lock`;
  const me = JSON.stringify({ pid: process.pid, host: hostname(), started: new Date().toISOString() });
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const fd = openSync(path, 'wx');
      writeSync(fd, me);
      closeSync(fd);
      let released = false;
      return () => {
        if (released) return;
        released = true;
        try {
          unlinkSync(path);
        } catch {
          /* already gone */
        }
      };
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== 'EEXIST') throw err;
      let holder: { pid?: number; host?: string } = {};
      try {
        holder = JSON.parse(readFileSync(path, 'utf8'));
      } catch {
        /* unreadable: treat as stale */
      }
      const alive = holder.host === hostname() && typeof holder.pid === 'number' && pidAlive(holder.pid);
      if (alive || (holder.host && holder.host !== hostname())) {
        die(`${dbPath} is in use by pid ${holder.pid} on ${holder.host} (${path}). Delete the lock file if that process is gone.`);
      }
      unlinkSync(path);
    }
  }
  die(`could not lock ${dbPath}`);
}

function pidAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (err) {
    return (err as NodeJS.ErrnoException).code === 'EPERM';
  }
}

interface RunLimits {
  deadlineMs: number;
  maxRequests: number;
  parkUntil: (nowMs: number) => number;
}

/** Crawl until the deadline, the request cap, Ctrl-C, or repeated failures. */
async function crawl(store: SqliteStore, config: CrawlerConfig, limits: RunLimits, signal: AbortSignal, intervalMs: number) {
  const budget = new Budget(limits.maxRequests || Number.MAX_SAFE_INTEGER, limits.deadlineMs, intervalMs);
  const api = new YanhektClient({
    fetch,
    pacer: new Pacer(intervalMs, Date.now, (ms) => sleep(ms, signal)),
    userAgent: opts['user-agent'],
    timeoutMs: 15_000,
  });
  const crawler = new Crawler({
    api,
    budget,
    store,
    config,
    now: Date.now,
    parkUntil: limits.parkUntil,
    signal,
    log: opts.quiet ? undefined : log,
  });

  const runId = store.startRun(Date.now());
  const s = crawler.state;
  log(
    `start: forward at ${s.forward.cursor}${s.forward.parkedUntilMs && s.forward.parkedUntilMs > Date.now() ? ' (parked)' : ''}, ` +
      `backfill at ${s.backfill.cursor}${s.backfill.done ? ' (done)' : ''}; until ${cnClock(limits.deadlineMs)} UTC+8, ` +
      `${limits.maxRequests || 'no'} request cap, ${intervalMs} ms between requests`,
  );

  let reason = 'deadline';
  let failures = 0;
  let lastReport = Date.now();
  for (;;) {
    if (signal.aborted) {
      reason = 'interrupted';
      break;
    }
    if (!budget.canAfford(1)) {
      reason = budget.spent >= budget.maxRequests ? 'request cap' : 'deadline';
      break;
    }
    try {
      const r = await crawler.runRound();
      failures = 0;
      if (r === 'idle') {
        reason = 'nothing to do (frontier reached, backfill done)';
        break;
      }
      if (r === 'aborted') {
        reason = 'interrupted';
        break;
      }
      if (r === 'budget') continue; // loop head names the reason
    } catch (err) {
      if (!(err instanceof TransientError)) {
        store.finishRun(runId, crawler.stats, `crashed: ${String(err)}`, Date.now());
        throw err;
      }
      failures += 1;
      const backoff = Math.min(30_000 * 2 ** (failures - 1), 15 * 60_000);
      log(`problem talking to Yanhekt (${err.message}); attempt ${failures}/6, waiting ${Math.round(backoff / 1000)} s`);
      if (failures >= 6) {
        reason = `gave up after repeated errors: ${err.message}`;
        break;
      }
      if (Date.now() + backoff >= limits.deadlineMs) {
        reason = `deadline during backoff: ${err.message}`;
        break;
      }
      await sleep(backoff, signal);
    }
    if (Date.now() - lastReport >= 60_000) {
      lastReport = Date.now();
      const st = crawler.state;
      log(
        `progress: ${crawler.stats.requests} requests, ${crawler.stats.sessionsFound} sessions ` +
          `(${crawler.stats.sessionsMissing} missing), ${crawler.stats.videos} videos, ${crawler.stats.courses} courses; ` +
          `forward ${st.forward.cursor}, backfill ${st.backfill.cursor}`,
      );
    }
  }
  store.finishRun(runId, crawler.stats, reason, Date.now());
  log(
    `stop (${reason}): ${crawler.stats.requests} requests, ${crawler.stats.sessionsFound} sessions found, ` +
      `${crawler.stats.sessionsMissing} missing, ${crawler.stats.videos} videos, ${crawler.stats.courses} courses`,
  );
}

async function main(): Promise<void> {
  const cmd = positionals[0];
  if (opts.help || !cmd) {
    console.log(HELP);
    return;
  }

  const dbPath = resolve(opts.db);

  if (cmd === 'status') {
    const store = new SqliteStore(dbPath);
    printStatus(store.db);
    store.close();
    return;
  }
  if (cmd === 'dump') {
    const store = new SqliteStore(dbPath);
    dumpForD1(store.db, resolve(opts.out), num('max-mb', 1, 1000) * 1024 * 1024, log);
    store.close();
    return;
  }
  if (cmd !== 'run' && cmd !== 'now') die(`unknown command "${cmd}" (try --help)`);

  const [startHour, endHour] = parseWindow(opts.window);
  const intervalMs = num('interval-ms', 250, 600_000);
  const maxRequests = num('max-requests', 0, 1e9);
  const config: CrawlerConfig = {
    initialSessionId: num('initial-id', 1, 1e12),
    floorSessionId: num('floor-id', 1, 1e12),
    fetchVideos: !opts['no-videos'],
    fetchCourseDetail: !opts['no-course-detail'],
    batchSize: num('batch', 1, 1000),
    gapThreshold: num('gap-threshold', 10, 1e6),
    probeStep: num('probe-step', 10, 1e6),
    probeCount: num('probe-count', 1, 1000),
    refreshDays: num('refresh-days', 0, 365),
    refreshEveryRounds: 10,
    refreshPerRound: 5,
    maxUnexpectedInRow: 5,
  };

  const release = acquireLock(dbPath);
  const store = new SqliteStore(dbPath);
  const ac = new AbortController();
  let interrupts = 0;
  const onSignal = () => {
    interrupts += 1;
    if (interrupts > 1) {
      log('second interrupt: exiting now (the current round is rolled back)');
      store.rollback();
      release();
      process.exit(130);
    }
    log('stopping after the current request… (Ctrl-C again to quit immediately)');
    ac.abort();
  };
  process.on('SIGINT', onSignal);
  process.on('SIGTERM', onSignal);
  log(`database ${dbPath}`);

  try {
    if (cmd === 'now') {
      const minutes = num('minutes', 1, 24 * 60);
      await crawl(
        store,
        config,
        {
          deadlineMs: Date.now() + minutes * 60_000,
          maxRequests,
          parkUntil: (now) => now + 3600_000,
        },
        ac.signal,
        intervalMs,
      );
      return;
    }

    // run: sleep outside the window, crawl inside it.
    while (!ac.signal.aborted) {
      const now = Date.now();
      if (!inWindow(now, startHour, endHour)) {
        const next = nextWindowStartMs(now, startHour);
        log(`outside the ${startHour}:00–${endHour}:00 UTC+8 window; sleeping until ${cnClock(next)} UTC+8`);
        // Wake every 5 min to re-check the clock (survives laptop sleep).
        while (!ac.signal.aborted && !inWindow(Date.now(), startHour, endHour)) {
          await sleep(Math.min(5 * 60_000, Math.max(1000, next - Date.now())), ac.signal);
        }
        continue;
      }
      const end = windowEndMs(now, startHour, endHour);
      await crawl(
        store,
        config,
        { deadlineMs: end, maxRequests, parkUntil: (t) => nextWindowStartMs(t, startHour) },
        ac.signal,
        intervalMs,
      );
      if (opts.once) break;
      // Finished early (frontier + backfill done, or gave up): wait out this window.
      if (Date.now() < end) await sleep(end - Date.now(), ac.signal);
    }
  } finally {
    store.close();
    release();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
