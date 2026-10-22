/**
 * Cloudflare D1 upload over the HTTP API, so any device with an API token
 * can push its local index; no wrangler login needed.
 *
 *   POST https://api.cloudflare.com/client/v4/accounts/{account}/d1/database/{db}/query
 *   Authorization: Bearer <token>        (permission: Account → D1 → Edit)
 *   { "batch": [{ "sql": "…" }, …] }     (statements run as one batch)
 *
 * D1 holds a slim projection of the local database (d1model.ts), not a copy:
 * one row per course with its session ids, plus search grams. Uploads are
 * incremental per course: for each course, a hash of its D1 row and of its
 * grams is kept locally (`d1_sent`, per D1 database), and only courses whose
 * row or grams changed are sent; grams only when they changed. Rows are
 * merge-upserted, so several devices can upload overlapping data in any
 * order. Progress is saved after each request, so an interrupted upload (for
 * example D1's daily write limit) continues where it stopped.
 */

import { createHash } from 'node:crypto';
import { hostname } from 'node:os';
import {
  courseGramsStatement,
  courseRowStatement,
  D1_RESET_SQL,
  D1_SCHEMA_SQL,
  D1_SCHEMA_VERSION,
  dataVersionStatement,
  localSessionsReader,
  projectCourse,
} from './d1model.ts';
import { statements } from './schema.ts';
import { sqlLiteral } from './sql.ts';
import type { SqliteStore } from './store.ts';
import { sleep } from './yanhekt.ts';

export interface D1Target {
  accountId: string;
  databaseId: string;
  token: string;
}

/** Reads CF_ACCOUNT_ID, CF_D1_DATABASE_ID, CF_API_TOKEN. Null if any is missing. */
export function d1FromEnv(env: Record<string, string | undefined>): D1Target | null {
  const accountId = env.CF_ACCOUNT_ID?.trim();
  const databaseId = env.CF_D1_DATABASE_ID?.trim();
  const token = env.CF_API_TOKEN?.trim();
  return accountId && databaseId && token ? { accountId, databaseId, token } : null;
}

interface QueryResult {
  results?: Array<Record<string, unknown>>;
  success?: boolean;
  meta?: { rows_written?: number };
}

/** Anything that runs SQL text on D1. The HTTP client below; an in-memory SQLite in tests. */
export interface D1Exec {
  /** Run statements as one batch; one result per statement. */
  exec(sqls: string[]): Promise<QueryResult[]>;
}

export class D1Http implements D1Exec {
  private readonly url: string;
  private readonly token: string;
  private readonly fetchFn: typeof fetch;

  constructor(t: D1Target, fetchFn: typeof fetch = fetch) {
    this.url = `https://api.cloudflare.com/client/v4/accounts/${t.accountId}/d1/database/${t.databaseId}/query`;
    this.token = t.token;
    this.fetchFn = fetchFn;
  }

  /** Run SQL. Retries network errors, 429 and 5xx (3 tries); throws on SQL/auth errors. */
  async exec(sqls: string[]): Promise<QueryResult[]> {
    const payload = JSON.stringify(sqls.length === 1 ? { sql: sqls[0] } : { batch: sqls.map((sql) => ({ sql })) });
    let lastErr = '';
    for (let attempt = 0; attempt < 4; attempt++) {
      if (attempt > 0) await sleep(5_000 * 3 ** (attempt - 1));
      let res: Response;
      try {
        res = await this.fetchFn(this.url, {
          method: 'POST',
          headers: { Authorization: `Bearer ${this.token}`, 'Content-Type': 'application/json' },
          body: payload,
          signal: AbortSignal.timeout(60_000),
        });
      } catch (err) {
        lastErr = `network: ${err instanceof Error ? err.message : String(err)}`;
        continue;
      }
      const body = (await res.json().catch(() => null)) as {
        success?: boolean;
        result?: QueryResult[];
        errors?: Array<{ code?: number; message?: string }>;
      } | null;
      if (res.ok && body?.success) return body.result ?? [];
      const msg = body?.errors?.map((e) => `${e.code ?? ''} ${e.message ?? ''}`.trim()).join('; ') || `HTTP ${res.status}`;
      if (res.status === 429 || res.status >= 500) {
        lastErr = msg;
        continue;
      }
      throw new Error(`D1 rejected the request: ${msg}`);
    }
    throw new Error(`D1 unreachable after retries: ${lastErr}`);
  }
}

export interface UploadOptions {
  device: string;
  /** Drop every D1 table first and send everything again (needed after a layout change). */
  reset?: boolean;
  /** Max bytes of SQL per request (each statement must stay under D1's 100 KB). */
  maxRequestBytes: number;
  /** Max statements per request. */
  maxStatements: number;
  /**
   * Stop before more than this many D1 rows would be written (one per course
   * row, one per new search key); 0 = no limit. The free plan allows 100k a
   * day; the rest goes on the next run, which continues where this one stopped.
   */
  maxWrites?: number;
  log: (msg: string) => void;
  signal?: AbortSignal;
}

export function defaultDevice(): string {
  return hostname();
}

/** The D1 layout version, or null for an empty database, or 'old' for a layout from before versioning. */
async function remoteSchema(d1: D1Exec): Promise<number | 'old' | null> {
  const [r] = await d1.exec(["SELECT name FROM sqlite_schema WHERE type = 'table' AND name IN ('meta', 'courses')"]);
  const names = new Set((r?.results ?? []).map((x) => String(x.name)));
  if (names.has('meta')) {
    const [v] = await d1.exec(["SELECT value FROM meta WHERE key = 'schema'"]);
    return Number(v?.results?.[0]?.value ?? 0) || 'old';
  }
  return names.has('courses') ? 'old' : null;
}

export interface UploadResult {
  /** Courses whose row was sent. */
  courses: number;
  /** Courses whose search grams were sent. */
  grams: number;
  /** Rows written, as estimated for `maxWrites`. */
  writes: number;
  /** Courses still to send because `maxWrites` was reached. */
  left: number;
}

const hash = (text: string) => createHash('sha1').update(text).digest('hex').slice(0, 16);

const PAGE = 500;

/** Push every course that changed since this device's last upload to this D1 database. */
export async function upload(store: SqliteStore, d1: D1Exec, databaseId: string, opts: UploadOptions): Promise<UploadResult> {
  const db = store.db;
  if (opts.reset) {
    opts.log('upload: --reset: dropping every D1 table and sending everything again');
    await d1.exec(statements(D1_RESET_SQL));
    db.prepare('DELETE FROM d1_sent WHERE target = ?').run(databaseId);
  } else {
    const version = await remoteSchema(d1);
    if (version !== null && version !== D1_SCHEMA_VERSION) {
      throw new Error(
        `D1 has another layout (${version === 'old' ? 'from before layout versions' : `version ${version}`}; this indexer writes version ${D1_SCHEMA_VERSION}). ` +
          'Run `npm run upload -- --reset` to drop it and upload everything again.',
      );
    }
  }
  await d1.exec(statements(D1_SCHEMA_SQL));

  const sessionsOf = localSessionsReader(db);
  // Newest first: when the write budget runs out, the current term is in.
  const page = db.prepare(`SELECT * FROM courses WHERE id < ? ORDER BY id DESC LIMIT ${PAGE}`);
  const sentSig = db.prepare('SELECT row_sig, grams_sig FROM d1_sent WHERE target = ? AND course_id = ?');
  const saveSig = db.prepare(
    'INSERT INTO d1_sent (target, course_id, row_sig, grams_sig) VALUES (?, ?, ?, ?) ' +
      'ON CONFLICT(target, course_id) DO UPDATE SET row_sig = excluded.row_sig, grams_sig = excluded.grams_sig',
  );
  const total = Number(Object.values(db.prepare('SELECT COUNT(*) FROM courses').get() as object)[0]);
  opts.log(`upload: checking ${total} courses`);

  const result: UploadResult = { courses: 0, grams: 0, writes: 0, left: 0 };
  const budget = opts.maxWrites && opts.maxWrites > 0 ? opts.maxWrites : Infinity;
  let batch: string[] = [];
  let bytes = 0;
  let sigs: Array<[number, string, string, boolean, boolean]> = [];
  let lastLog = Date.now();
  const flush = async () => {
    if (batch.length === 0) return;
    await d1.exec(batch);
    // Saved only after D1 accepted the request, so nothing is skipped after a failure.
    db.exec('BEGIN');
    for (const [id, rowSig, gramsSig, row, grams] of sigs) {
      saveSig.run(databaseId, id, rowSig, gramsSig);
      if (row) result.courses += 1;
      if (grams) result.grams += 1;
    }
    db.exec('COMMIT');
    batch = [];
    bytes = 0;
    sigs = [];
    if (Date.now() - lastLog > 15_000) {
      lastLog = Date.now();
      opts.log(`upload: sent ${result.courses} courses so far`);
    }
  };

  let after = Number.MAX_SAFE_INTEGER;
  for (;;) {
    if (opts.signal?.aborted) break;
    const rows = page.all(after) as Array<Record<string, unknown>>;
    if (rows.length === 0) break;
    after = Number(rows[rows.length - 1].id);
    for (const local of rows) {
      const { row, grams, gone } = projectCourse(local, sessionsOf(Number(local.id)));
      const rowSig = hash(JSON.stringify([row, gone]));
      const gramsSig = hash(JSON.stringify([row.term, [...grams].sort()]));
      const prev = sentSig.get(databaseId, row.id) as { row_sig: string; grams_sig: string } | undefined;
      const stmts: string[] = [];
      const sendRow = prev?.row_sig !== rowSig;
      if (sendRow) stmts.push(courseRowStatement(row, gone));
      const gramsStmt = prev?.grams_sig !== gramsSig ? courseGramsStatement(row, grams) : null;
      if (gramsStmt) stmts.push(gramsStmt);
      if (stmts.length === 0) continue;
      const writes = (sendRow ? 1 : 0) + (gramsStmt ? grams.length : 0);
      // Once one course does not fit, send nothing older, so what D1 holds is the newest part.
      if (result.left > 0 || result.writes + writes > budget) {
        result.left += 1;
        continue;
      }
      result.writes += writes;
      const size = stmts.reduce((n, x) => n + Buffer.byteLength(x), 0);
      if (batch.length > 0 && (bytes + size > opts.maxRequestBytes || batch.length + stmts.length > opts.maxStatements)) {
        await flush();
      }
      batch.push(...stmts);
      bytes += size;
      sigs.push([row.id, rowSig, gramsSig, sendRow, gramsStmt !== null]);
    }
  }
  await flush();
  if (result.courses + result.grams > 0) await d1.exec([dataVersionStatement(Date.now())]);
  opts.log(`upload: sent ${result.courses} courses (${result.grams} with new search grams), about ${result.writes} rows written`);
  if (result.left > 0) {
    opts.log(`upload: stopped at the write budget (${budget}); ${result.left} courses left. Run upload again tomorrow to send them.`);
  }

  // One progress row per device, so every device's position is visible remotely.
  const lanes = store.allLanes();
  await d1.exec([
    `INSERT INTO device_progress (device, lanes, totals, uploaded_at) VALUES (${sqlLiteral(opts.device)}, ` +
      `${sqlLiteral(JSON.stringify(lanes))}, ${sqlLiteral(JSON.stringify(store.totals()))}, ${Date.now()}) ` +
      'ON CONFLICT(device) DO UPDATE SET lanes = excluded.lanes, totals = excluded.totals, uploaded_at = excluded.uploaded_at',
  ]);
  return result;
}

/** Print what D1 holds and where every device is. */
export async function printRemoteStatus(d1: D1Exec): Promise<void> {
  const version = await remoteSchema(d1);
  if (version === null) {
    console.log('D1 is empty (nothing uploaded yet).');
    return;
  }
  if (version !== D1_SCHEMA_VERSION) {
    console.log(`D1 has another layout (${version}); run \`npm run upload -- --reset\`.`);
    return;
  }
  // One pass over the course rows (about one row read per course).
  const [byTerm] = await d1.exec([
    `SELECT term, COUNT(*) AS courses, SUM(detail) AS detailed, SUM(json_array_length(session_ids)) AS sessions
       FROM courses GROUP BY term ORDER BY term DESC`,
  ]);
  const terms = byTerm?.results ?? [];
  const sum = (k: string) => terms.reduce((n, t) => n + Number(t[k] ?? 0), 0);
  console.log('D1 totals');
  console.log(`  courses  ${sum('courses')}  (with detail ${sum('detailed')})`);
  console.log(`  sessions ${sum('sessions')}`);

  const [devices] = await d1.exec(['SELECT device, lanes, totals, uploaded_at FROM device_progress ORDER BY uploaded_at DESC']);
  console.log('\nDevices (as of their last upload)');
  const rows = devices?.results ?? [];
  if (rows.length === 0) console.log('  (none)');
  for (const d of rows) {
    const when = new Date(Number(d.uploaded_at)).toISOString().replace('T', ' ').slice(0, 16);
    console.log(`  ${d.device}  uploaded ${when} UTC`);
    const lanes = JSON.parse(String(d.lanes)) as Record<string, { cursor: number; done: boolean; parkedUntilMs: number | null }>;
    for (const [k, l] of Object.entries(lanes)) {
      console.log(`    ${k.padEnd(28)} next id ${l.cursor}${l.done ? ' (done)' : ''}`);
    }
  }

  console.log('\nD1 coverage by term');
  for (const t of terms) {
    console.log(`  ${String(t.term ?? '(unknown)').padEnd(14)} ${String(t.sessions).padStart(7)} sessions  ${String(t.courses).padStart(5)} courses`);
  }
}
