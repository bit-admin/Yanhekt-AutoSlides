/**
 * Cloudflare D1 upload over the HTTP API, so any device with an API token
 * can push its local index; no wrangler login needed.
 *
 *   POST https://api.cloudflare.com/client/v4/accounts/{account}/d1/database/{db}/query
 *   Authorization: Bearer <token>        (permission: Account → D1 → Edit)
 *   { "batch": [{ "sql": "…" }, …] }     (statements run as one batch)
 *
 * Uploads are incremental: every shared row carries `changed_at`, and the
 * last uploaded (changed_at, id) per table and per D1 database is kept in
 * crawl_state. Rows are merge-upserted (see SYNC_TABLES), so several devices
 * can upload overlapping data in any order.
 */

import { hostname } from 'node:os';
import { mergeStatement, SHARED_SCHEMA_SQL, statements, SYNC_TABLE_NAMES, type SyncTable } from './schema.ts';
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
  /** Max bytes of SQL per request (each statement must stay under D1's 100 KB). */
  maxRequestBytes: number;
  /** Max statements per request. */
  maxStatements: number;
  log: (msg: string) => void;
  signal?: AbortSignal;
}

export function defaultDevice(): string {
  return hostname();
}

/** Push rows changed since the last upload to D1. Returns rows sent per table. */
export async function upload(store: SqliteStore, d1: D1Exec, databaseId: string, opts: UploadOptions): Promise<Record<string, number>> {
  await d1.exec(statements(SHARED_SCHEMA_SQL));

  const sent: Record<string, number> = {};
  for (const table of SYNC_TABLE_NAMES) {
    sent[table] = await uploadTable(store, d1, databaseId, table, opts);
    if (opts.signal?.aborted) break;
  }

  // One progress row per device, so every device's position is visible remotely.
  const lanes = store.allLanes();
  await d1.exec([
    `INSERT INTO device_progress (device, lanes, totals, uploaded_at) VALUES (${sqlLiteral(opts.device)}, ` +
      `${sqlLiteral(JSON.stringify(lanes))}, ${sqlLiteral(JSON.stringify(store.totals()))}, ${Date.now()}) ` +
      'ON CONFLICT(device) DO UPDATE SET lanes = excluded.lanes, totals = excluded.totals, uploaded_at = excluded.uploaded_at',
  ]);
  return sent;
}

async function uploadTable(store: SqliteStore, d1: D1Exec, databaseId: string, table: SyncTable, opts: UploadOptions): Promise<number> {
  const key = `upload:${databaseId}:${table}`;
  const saved = store.getState(key);
  let mark = saved ? (JSON.parse(saved) as { t: number; id: number }) : { t: 0, id: 0 };
  const pending = Number(
    Object.values(
      store.db
        .prepare(`SELECT COUNT(*) FROM ${table} WHERE changed_at > ? OR (changed_at = ? AND id > ?)`)
        .get(mark.t, mark.t, mark.id) as object,
    )[0],
  );
  if (pending === 0) {
    opts.log(`upload: ${table}: up to date`);
    return 0;
  }
  opts.log(`upload: ${table}: ${pending} changed rows`);

  const page = store.db.prepare(
    `SELECT * FROM ${table} WHERE changed_at > ? OR (changed_at = ? AND id > ?) ORDER BY changed_at, id LIMIT 500`,
  );
  let sent = 0;
  let lastLog = Date.now();
  for (;;) {
    if (opts.signal?.aborted) break;
    const rows = page.all(mark.t, mark.t, mark.id) as Array<Record<string, unknown>>;
    if (rows.length === 0) break;

    let batch: string[] = [];
    let bytes = 0;
    let batchLast = mark;
    const flush = async () => {
      if (batch.length === 0) return;
      await d1.exec(batch);
      sent += batch.length;
      mark = batchLast;
      store.setState(key, JSON.stringify(mark)); // progress survives an interrupted upload
      batch = [];
      bytes = 0;
    };
    for (const row of rows) {
      const stmt = mergeStatement(table, row);
      const size = Buffer.byteLength(stmt);
      if (batch.length > 0 && (bytes + size > opts.maxRequestBytes || batch.length >= opts.maxStatements)) await flush();
      batch.push(stmt);
      bytes += size;
      batchLast = { t: Number(row.changed_at), id: Number(row.id) };
    }
    await flush();
    if (Date.now() - lastLog > 15_000) {
      lastLog = Date.now();
      opts.log(`upload: ${table}: ${sent}/${pending}`);
    }
  }
  opts.log(`upload: ${table}: sent ${sent} rows`);
  return sent;
}

/** Print what D1 holds and where every device is. */
export async function printRemoteStatus(d1: D1Exec): Promise<void> {
  const [counts] = await d1.exec([
    `SELECT (SELECT COUNT(*) FROM sessions) AS sessions, (SELECT COUNT(*) FROM courses) AS courses,
            (SELECT COUNT(*) FROM courses WHERE detail_status = 'ok') AS courses_detailed,
            (SELECT COUNT(*) FROM videos WHERE status = 'ok') AS videos,
            (SELECT MIN(id) FROM sessions) AS min_id, (SELECT MAX(id) FROM sessions) AS max_id`,
  ]);
  const c = counts?.results?.[0] ?? {};
  console.log('D1 totals');
  console.log(`  sessions ${c.sessions}  (ids ${c.min_id ?? '–'}–${c.max_id ?? '–'})`);
  console.log(`  courses  ${c.courses}  (with detail ${c.courses_detailed})`);
  console.log(`  videos   ${c.videos}`);

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

  const [terms] = await d1.exec([
    `SELECT c.school_year AS year, c.semester AS sem, COUNT(*) AS sessions, COUNT(DISTINCT s.course_id) AS courses,
            MIN(s.id) AS lo, MAX(s.id) AS hi
     FROM sessions s LEFT JOIN courses c ON c.id = s.course_id
     GROUP BY c.school_year, c.semester ORDER BY lo DESC`,
  ]);
  console.log('\nD1 coverage by term');
  for (const t of terms?.results ?? []) {
    const label = t.year ? `${t.year} 第${Number(t.sem) === 2 ? '二' : Number(t.sem) === 1 ? '一' : String(t.sem)}学期` : '(unknown)';
    console.log(`  ${label.padEnd(20)} ${String(t.sessions).padStart(7)} sessions  ${String(t.courses).padStart(5)} courses  ids ${t.lo}–${t.hi}`);
  }
}
