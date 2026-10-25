#!/usr/bin/env node
/**
 * yanhekt-indexer — local, no-auth Yanhekt session indexer. See README.md.
 */

import { parseArgs } from 'node:util';
import { appendFileSync, closeSync, existsSync, mkdirSync, openSync, readFileSync, unlinkSync, writeFileSync, writeSync } from 'node:fs';
import { homedir, hostname } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { Crawler, TransientError, clampForward, defaultLanes, rangeLane, type CrawlerConfig, type LaneSpec } from './crawler.ts';
import { SqliteStore } from './store.ts';
import { cnClock, inWindow, nextWindowStartMs, windowEndMs } from './time.ts';
import { Budget, Pacer, YanhektClient, sleep } from './yanhekt.ts';
import { laneLines, printStatus } from './status.ts';
import { dumpForD1 } from './dump.ts';
import { D1Http, d1FromEnv, printRemoteStatus, upload, type D1Exec } from './remote.ts';
import { WranglerD1 } from './wranglerD1.ts';
import { exportTerms, DEFAULT_MIN_TERM } from './export.ts';
import { bundleRelease, currentTerm, DEFAULT_TAG, NoRelease, pullRelease, pushRelease } from './release.ts';
import type { SigningKey } from './clientIndex.ts';
import { createPrivateKey, type KeyObject } from 'node:crypto';

const DEFAULT_UA = 'AutoSlides-Indexer/0.2 (+https://github.com/bit-admin/Yanhekt-AutoSlides)';

const HELP = `yanhekt-indexer — walk Yanhekt session ids without logging in, store them in SQLite, upload to D1.

Commands
  run       Wait for the nightly window, crawl until it closes, repeat every night.
  now       Crawl immediately for --minutes (default 10), ignoring the window.
  status    Local progress. With --remote: what D1 holds and where every device is.
  upload    Send rows changed since the last upload to Cloudflare D1 (its slim layout, not a copy).
  merge F…  Merge other index files (e.g. GitHub Actions artifacts) into this one.
  dump      Write the D1 layout as SQL files (alternative to upload; also for a local D1).
  export    Write the per-term JSON files (the release's slim layout) to --out.
  release pull   Download and decrypt the release's database to --db (which must not exist).
  release push   Encrypt and publish --db and its term files to the release.
  release bundle Download the signed client manifest and the term files before --before
                 to --out (default ./bundle), for the desktop app build. No --db.

What to crawl
  (default)             forward from --initial-id to the newest id, and backfill down to --floor-id
  --backfill-only       only the backfill lane (older terms first); forward stays where it is
  --forward-only        only the forward lane (new sessions); 'now' ends once it has caught up
  --from A [--to B]     only ids A→B (either direction), or A upward to the newest id.
                        Re-running the same command continues where it stopped.
  --restart             forget the saved position of the selected lane(s) and start over
  --videos              also fetch recorded URLs (/v1/video), including for sessions stored earlier
  --only-videos         only fetch recorded URLs for stored sessions; no scanning
  --no-course-detail    skip /v1/course (keeps the thinner course copy that comes with each session)

Pace and schedule
  --window 2-5          crawl window, Beijing time (UTC+8), start-end hours (default 2-5)
  --once                run: exit after one window
  --minutes N           now: how long to crawl (default 10)
  --interval-ms N       time between request starts, min 250 (default 1000 = 1 req/s)
  --max-requests N      cap per window / per 'now' run, 0 = none (default 0)
  --batch N             session ids per round / transaction (default 25)
  --initial-id N        default lanes' starting point on a fresh database (default 932000)
  --floor-id N          backfill stops below this id (default 1)

Upload (needs CF_ACCOUNT_ID, CF_D1_DATABASE_ID, CF_API_TOKEN, e.g. in .env)
  --upload              run/now: upload after each crawl
  --device NAME         name shown in the D1 progress table (default: hostname)
  --remote              status: show D1 instead of the local database
  --reset               upload/dump: drop every D1 table first and send everything
                        (needed once after the D1 layout changes)
  --wrangler            upload / status --remote: go through 'wrangler d1 execute --remote'
                        (wrangler's login) instead of CF_API_TOKEN; slower
  --wrangler-db NAME    database name for --wrangler (default yanhekt-index)
  --wrangler-cwd DIR    where 'npx wrangler' runs for --wrangler (default ../share)
  --max-writes N        upload: stop before writing more than N D1 rows, newest courses
                        first; 0 = no limit (default 90000, under the free plan's
                        100k a day; the next upload sends the rest)

Release (a GitHub pre-release; needs the gh CLI, signed in)
  --tag NAME            release tag (default ${DEFAULT_TAG}; never one starting with v)
  --min-term TERM       oldest term in the JSON files (default ${DEFAULT_MIN_TERM})
  --passphrase-file F   private passphrase: database, private manifest (default:
                        $INDEX_ARTIFACT_PASSPHRASE, else ~/.config/autoslides/index-passphrase.txt)
  --client-passphrase-file F   client passphrase: client manifest, term files; the app has it
                        (default: $INDEX_CLIENT_PASSPHRASE, else
                        ~/.config/autoslides/index-client-passphrase.txt)
  --signing-key-file F  push: ed25519 key that signs the client manifest (default:
                        $INDEX_SIGNING_KEY as PEM text, else ~/.config/autoslides/index-signing-key.pem)
  --keys F              bundle: public keys to accept (the app's indexSigningKeys.json)
  --before TERM         bundle: terms before this one (default: the current term, Beijing time)

Other
  --db PATH             SQLite file (default ./data/yanhekt-index.db)
  --out DIR / --max-mb N   dump: output directory (default ./d1-dump) / file size (default 50)
  --user-agent S        User-Agent header (default identifies this project)
  -q, --quiet           only progress lines and errors
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
    from: { type: 'string' },
    to: { type: 'string' },
    restart: { type: 'boolean', default: false },
    'backfill-only': { type: 'boolean', default: false },
    'forward-only': { type: 'boolean', default: false },
    tag: { type: 'string', default: DEFAULT_TAG },
    'min-term': { type: 'string', default: DEFAULT_MIN_TERM },
    'passphrase-file': { type: 'string' },
    'client-passphrase-file': { type: 'string' },
    'signing-key-file': { type: 'string' },
    keys: { type: 'string' },
    before: { type: 'string' },
    videos: { type: 'boolean', default: false },
    'only-videos': { type: 'boolean', default: false },
    'no-course-detail': { type: 'boolean', default: false },
    'gap-threshold': { type: 'string', default: '150' },
    'probe-step': { type: 'string', default: '500' },
    'probe-count': { type: 'string', default: '20' },
    'refresh-days': { type: 'string', default: '14' },
    upload: { type: 'boolean', default: false },
    device: { type: 'string' },
    remote: { type: 'boolean', default: false },
    reset: { type: 'boolean', default: false },
    'max-writes': { type: 'string', default: '90000' },
    wrangler: { type: 'boolean', default: false },
    'wrangler-db': { type: 'string', default: 'yanhekt-index' },
    'wrangler-cwd': { type: 'string', default: '../share' },
    'user-agent': { type: 'string', default: DEFAULT_UA },
    out: { type: 'string', default: './d1-dump' },
    'max-mb': { type: 'string', default: '50' },
    quiet: { type: 'boolean', short: 'q', default: false },
    help: { type: 'boolean', short: 'h', default: false },
  },
});

function die(msg: string): never {
  console.error(`error: ${msg}`);
  process.exit(2);
  throw new Error(msg); // unreachable; keeps `never` honest for the type checker
}

function num(name: string, min: number, max: number): number {
  const raw = (opts as Record<string, unknown>)[name];
  const n = Number(raw);
  if (raw === undefined || !Number.isFinite(n) || n < min || n > max) {
    die(`--${name} must be a number between ${min} and ${max} (got ${String(raw)})`);
  }
  return Math.trunc(n);
}

function log(msg: string): void {
  console.log(`[${cnClock(Date.now())} UTC+8] ${msg}`);
}

/** In GitHub Actions, also write to the job summary page (markdown). */
function jobSummary(markdown: string): void {
  const file = process.env.GITHUB_STEP_SUMMARY;
  if (!file) return;
  try {
    appendFileSync(file, `${markdown}\n`);
  } catch {
    /* summary is best-effort */
  }
}

/** A release secret: the --flag file, else the environment variable, else the usual file on this Mac. */
function secret(flag: string | undefined, envName: string, homeFile: string): string | null {
  const fromFile = (f: string) => readFileSync(f, 'utf8').replace(/\r?\n$/, '');
  if (flag) return fromFile(resolve(flag));
  const env = process.env[envName];
  if (env && env.trim()) return env.replace(/\r?\n$/, '');
  const home = join(homedir(), '.config', 'autoslides', homeFile);
  return existsSync(home) ? fromFile(home) : null;
}

function passphrase(): string {
  return secret(opts['passphrase-file'], 'INDEX_ARTIFACT_PASSPHRASE', 'index-passphrase.txt')
    ?? die('no passphrase: pass --passphrase-file or set INDEX_ARTIFACT_PASSPHRASE');
}

function clientPassphrase(): string {
  return secret(opts['client-passphrase-file'], 'INDEX_CLIENT_PASSPHRASE', 'index-client-passphrase.txt')
    ?? die('no client passphrase: pass --client-passphrase-file or set INDEX_CLIENT_PASSPHRASE');
}

function signingKey(): KeyObject {
  const pem = secret(opts['signing-key-file'], 'INDEX_SIGNING_KEY', 'index-signing-key.pem')
    ?? die('no signing key: pass --signing-key-file or set INDEX_SIGNING_KEY');
  return createPrivateKey(pem);
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
  mkdirSync(dirname(path), { recursive: true }); // fresh checkout: data/ does not exist yet
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
      const sameHost = holder.host === hostname();
      if ((sameHost && typeof holder.pid === 'number' && pidAlive(holder.pid)) || (holder.host && !sameHost)) {
        die(`${dbPath} is in use by pid ${holder.pid} on ${holder.host}. Stop that process first (or delete ${path} if it is gone).`);
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

/** The D1 client and its id (the key of `d1_sent`): wrangler's login with --wrangler, else the API token. */
function d1Client(): { d1: D1Exec; databaseId: string; done: () => void } {
  if (opts.wrangler) {
    const name = opts['wrangler-db'];
    const w = new WranglerD1(name, resolve(opts['wrangler-cwd']));
    return { d1: w, databaseId: process.env.CF_D1_DATABASE_ID?.trim() || name, done: () => w.close() };
  }
  const t = d1Target();
  return { d1: new D1Http(t), databaseId: t.databaseId, done: () => {} };
}

function d1Target() {
  const t = d1FromEnv(process.env);
  if (!t) die('set CF_ACCOUNT_ID, CF_D1_DATABASE_ID and CF_API_TOKEN (see .env.example)');
  return t;
}

async function doUpload(store: SqliteStore, signal: AbortSignal, reset = false): Promise<void> {
  const { d1, databaseId, done } = d1Client();
  let sent;
  try {
    sent = await upload(store, d1, databaseId, {
      device: opts.device?.trim() || hostname(),
      reset,
      // A wrangler call costs a process start; send bigger files.
      maxRequestBytes: opts.wrangler ? 4_000_000 : 800_000,
      maxStatements: opts.wrangler ? 1000 : 200,
      maxWrites: num('max-writes', 0, 1e9),
      log,
      signal,
    });
  } finally {
    done();
  }
  log(`upload done: ${sent.courses} courses, ${sent.grams} with new grams, ~${sent.writes} rows written${sent.left ? `, ${sent.left} left for the next upload` : ''}`);
}

interface CrawlResult {
  reason: string;
  /** Nothing left to do for these lanes (range finished, or frontier + backfill done). */
  idle: boolean;
}

/** Crawl until the deadline, the request cap, Ctrl-C, nothing left, or repeated failures. */
async function crawl(
  store: SqliteStore,
  config: CrawlerConfig,
  lanes: LaneSpec[],
  limits: { deadlineMs: number; maxRequests: number; parkUntil: (nowMs: number) => number },
  signal: AbortSignal,
  intervalMs: number,
): Promise<CrawlResult> {
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
    lanes,
    now: Date.now,
    parkUntil: limits.parkUntil,
    signal,
    log: opts.quiet ? undefined : log,
  });

  const runId = store.startRun(Date.now());
  log(`start: until ${cnClock(limits.deadlineMs)} UTC+8, ${limits.maxRequests || 'no'} request cap, ${intervalMs} ms between requests`);
  for (const line of laneLines(crawler.progress(), Date.now())) log(`  ${line}`);

  let reason = 'deadline';
  let idle = false;
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
        reason = 'nothing left to do';
        idle = true;
        break;
      }
      if (r === 'aborted') {
        reason = 'interrupted';
        break;
      }
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
      const s = crawler.stats;
      log(`progress: ${s.requests} requests, ${s.sessionsFound} sessions (${s.sessionsMissing} missing), ${s.courses} courses, ${s.videos} videos`);
    }
  }
  store.finishRun(runId, crawler.stats, reason, Date.now());

  // End-of-run report: what happened, where each lane is, how to continue.
  const s = crawler.stats;
  const t = store.totals();
  log(`stop (${reason}): ${s.requests} requests, ${s.sessionsFound} sessions found, ${s.sessionsMissing} missing, ${s.courses} courses, ${s.videos} videos`);
  for (const line of laneLines(crawler.progress(), Date.now())) log(`  ${line}`);
  log(`  database: ${t.sessions} sessions (ids ${t.minSessionId}–${t.maxSessionId}), ${t.courses} courses, ${t.videos} video URLs, ${t.videosQueued} queued`);
  const range = lanes.find((l) => l.key.startsWith('range:'));
  if (range && !idle) {
    log(`  to continue: run the same command again (--from ${range.start}${range.end != null ? ` --to ${range.end}` : ''}); it resumes at the saved position`);
  }
  jobSummary(
    [
      `### Crawl stopped: ${reason}`,
      '',
      `${s.requests} requests · ${s.sessionsFound} sessions found · ${s.sessionsMissing} missing · ${s.courses} courses · ${s.videos} video URLs`,
      '',
      '```',
      ...laneLines(crawler.progress(), Date.now()),
      `database: ${t.sessions} sessions (ids ${t.minSessionId}–${t.maxSessionId}), ${t.courses} courses, ${t.videos} video URLs`,
      '```',
    ].join('\n'),
  );
  return { reason, idle };
}

async function main(): Promise<void> {
  const cmd = positionals[0];
  if (opts.help || !cmd) {
    console.log(HELP);
    return;
  }
  const dbPath = resolve(opts.db);

  if (cmd === 'status') {
    if (opts.remote) {
      const c = d1Client();
      await printRemoteStatus(c.d1);
      c.done();
      return;
    }
    const store = new SqliteStore(dbPath);
    printStatus(store);
    store.close();
    return;
  }
  if (cmd === 'export') {
    const store = new SqliteStore(dbPath);
    const files = exportTerms(store.db, opts['min-term']);
    store.close();
    const out = resolve(opts.out === './d1-dump' ? './export' : opts.out);
    mkdirSync(out, { recursive: true });
    for (const f of files) {
      writeFileSync(join(out, `${f.term}.json`), f.json);
      log(`${f.term}: ${f.courses} courses, ${f.sessions} sessions → ${join(out, `${f.term}.json`)}`);
    }
    return;
  }
  if (cmd === 'release') {
    const sub = positionals[1];
    if (sub !== 'pull' && sub !== 'push' && sub !== 'bundle') die('release needs pull, push or bundle');
    if (/^v/i.test(opts.tag)) die('a release tag starting with v would trigger the app release workflow');
    if (sub === 'bundle') {
      if (!opts.keys) die('release bundle needs --keys (the app\'s indexSigningKeys.json)');
      const keys = (JSON.parse(readFileSync(resolve(opts.keys), 'utf8')) as { keys: SigningKey[] }).keys;
      const before = opts.before ?? currentTerm();
      if (!/^\d{4}-\d{4}-[12]$/.test(before)) die(`--before must look like 2026-2027-1 (got ${before})`);
      const out = resolve(opts.out === './d1-dump' ? './bundle' : opts.out);
      try {
        await bundleRelease(opts.tag, out, { clientPassphrase: clientPassphrase(), keys, before }, log);
      } catch (err) {
        if (err instanceof NoRelease) {
          console.error(`error: ${err.message}`);
          process.exit(3);
        }
        throw err;
      }
      return;
    }
    const pass = passphrase();
    if (sub === 'pull') {
      mkdirSync(dirname(dbPath), { recursive: true });
      try {
        pullRelease(opts.tag, dbPath, pass, log);
      } catch (err) {
        if (err instanceof NoRelease) {
          console.error(`error: ${err.message}`);
          process.exit(3);
        }
        throw err;
      }
      return;
    }
    if (!existsSync(dbPath)) die(`no such database: ${dbPath}`);
    const release = acquireLock(dbPath);
    try {
      pushRelease(opts.tag, dbPath, { passphrase: pass, clientPassphrase: clientPassphrase(), signingKey: signingKey() }, opts['min-term'], log);
    } finally {
      release();
    }
    return;
  }
  if (cmd === 'dump') {
    const store = new SqliteStore(dbPath);
    const files = dumpForD1(store.db, resolve(opts.out), num('max-mb', 1, 1000) * 1024 * 1024, log, { reset: opts.reset });
    store.close();
    if (files.length > 0) log(`apply in order: for f in ${resolve(opts.out)}/*.sql; do npx wrangler d1 execute <db> --local|--remote --file="$f"; done`);
    return;
  }
  if (cmd !== 'run' && cmd !== 'now' && cmd !== 'upload' && cmd !== 'merge') die(`unknown command "${cmd}" (try --help)`);
  if ((opts.upload || cmd === 'upload') && !opts.wrangler) d1Target(); // fail fast on missing credentials

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

  try {
    if (cmd === 'upload') {
      await doUpload(store, ac.signal, opts.reset);
      return;
    }
    if (cmd === 'merge') {
      const files = positionals.slice(1).map((f: string) => resolve(f));
      if (files.length === 0) die('merge needs at least one file: merge <other.db> [more.db …]');
      for (const f of files) {
        if (!existsSync(f)) die(`no such file: ${f}`);
        if (f === dbPath) die('cannot merge a database into itself');
        const { rows, lanes } = store.mergeFrom(f, Date.now());
        log(`merged ${f}: ${Object.entries(rows).map(([k, v]) => `${v} ${k}`).join(', ')} (inserted or improved)`);
        for (const [key, l] of Object.entries(lanes)) log(`  its lane ${key}: next id ${l.cursor}${l.done ? ' (done)' : ''}`);
      }
      const t = store.totals();
      log(`database now: ${t.sessions} sessions (ids ${t.minSessionId}–${t.maxSessionId}), ${t.courses} courses, ${t.videos} video URLs`);
      return;
    }

    log(`database ${dbPath}`);
    const [startHour, endHour] = parseWindow(opts.window);
    const intervalMs = num('interval-ms', 250, 600_000);
    const maxRequests = num('max-requests', 0, 1e9);
    const onlyVideos = opts['only-videos'];
    const config: CrawlerConfig = {
      fetchVideos: opts.videos || onlyVideos,
      fetchCourseDetail: !opts['no-course-detail'],
      batchSize: num('batch', 1, 1000),
      gapThreshold: num('gap-threshold', 10, 1e6),
      probeStep: num('probe-step', 10, 1e6),
      probeCount: num('probe-count', 1, 1000),
      refreshDays: onlyVideos ? 0 : num('refresh-days', 0, 365),
      refreshEveryRounds: 10,
      refreshPerRound: 5,
      maxUnexpectedInRow: 5,
      sessionTries: 3,
      retryPerRound: 10,
      retryAfterMs: 3600_000,
    };

    let lanes: LaneSpec[];
    if (onlyVideos) lanes = [];
    else if (opts.from !== undefined) lanes = [rangeLane(num('from', 1, 1e12), opts.to !== undefined ? num('to', 1, 1e12) : null)];
    else if (opts.to !== undefined) die('--to needs --from');
    else {
      lanes = defaultLanes(num('initial-id', 2, 1e12), num('floor-id', 1, 1e12));
      if (opts['backfill-only']) lanes = lanes.filter((l) => l.key === 'backfill');
      if (opts['forward-only']) lanes = lanes.filter((l) => l.key === 'forward');
    }
    if (opts['backfill-only'] && opts['forward-only']) die('--backfill-only and --forward-only exclude each other');
    for (const flag of ['backfill-only', 'forward-only'] as const) {
      if (opts[flag] && (onlyVideos || opts.from !== undefined)) die(`--${flag} goes with the default lanes, not --from or --only-videos`);
    }

    if (!onlyVideos && opts.from === undefined) {
      const moved = clampForward(store, num('initial-id', 2, 1e12));
      if (moved) log(`forward: saved position ${moved.from} was past the newest stored session; moved back to ${moved.to}`);
    }
    if (opts.restart) {
      for (const l of lanes) store.deleteState(`lane:${l.key}`);
      log(`restart: cleared saved position of ${lanes.map((l) => l.key).join(', ') || '(no lanes)'}`);
    }
    if (config.fetchVideos) {
      const queued = store.queueMissingVideos(Date.now());
      if (queued > 0) log(`queued ${queued} stored video ids that have no URL yet`);
    }

    const finished = (r: CrawlResult) => r.idle && (onlyVideos || opts.from !== undefined || opts['forward-only']);

    if (cmd === 'now') {
      const minutes = num('minutes', 1, 24 * 60);
      await crawl(
        store,
        config,
        lanes,
        { deadlineMs: Date.now() + minutes * 60_000, maxRequests, parkUntil: (now) => now + 3600_000 },
        ac.signal,
        intervalMs,
      );
      if (opts.upload && !ac.signal.aborted) await doUpload(store, ac.signal);
      return;
    }

    // run: sleep outside the window, crawl inside it, every night.
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
      const r = await crawl(
        store,
        config,
        lanes,
        { deadlineMs: end, maxRequests, parkUntil: (t) => nextWindowStartMs(t, startHour) },
        ac.signal,
        intervalMs,
      );
      if (opts.upload && !ac.signal.aborted) await doUpload(store, ac.signal);
      if (finished(r)) {
        log('all selected work is done; exiting');
        break;
      }
      if (opts.once) break;
      // Finished early tonight (newest id reached, backfill done, or gave up): wait out the window.
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
