/** SQLite persistence (node:sqlite, synchronous). */

import { DatabaseSync, type StatementSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { asObject, professorNames, splitRow, videoIdsOf, type SqlValue } from './extract.ts';
import {
  COURSE_API,
  COURSE_SKIP,
  SCHEMA_SQL,
  SESSION_API,
  SESSION_SKIP,
  SYNC_TABLE_NAMES,
  SYNC_TABLES,
  VIDEO_API,
  VIDEO_ZERO_SKIP,
} from './schema.ts';
import type { Json } from './yanhekt.ts';

/** Position of one scan lane. Saved under `lane:<key>` in crawl_state. */
export interface LaneState {
  /** Next id to look at. */
  cursor: number;
  /** Consecutive missing ids just before `cursor`. */
  missRun: number;
  /** First id of that missing run. */
  missRunStart: number | null;
  /** Parked at the newest id until this time (lanes that park at the frontier). */
  parkedUntilMs: number | null;
  /** Reached its end (or the newest id, for lanes that finish there). */
  done: boolean;
}

export interface PendingVideo {
  videoId: number;
  sessionId: number;
}

export interface RunStats {
  requests: number;
  sessionsFound: number;
  sessionsMissing: number;
  courses: number;
  videos: number;
}

/** What the crawler needs from storage. */
export interface Store {
  begin(): void;
  commit(): void;
  rollback(): void;
  loadLane(key: string): LaneState | null;
  saveLane(key: string, state: LaneState): void;
  saveSession(raw: Json, nowMs: number, opts: { refreshed: boolean; queueVideos: boolean }): void;
  markSessionGone(id: number, nowMs: number): void;
  saveCourseDetail(raw: Json, nowMs: number): void;
  markCourse(id: number, status: 'missing' | 'error', nowMs: number): void;
  saveVideo(raw: Json, sessionId: number, nowMs: number): void;
  markVideoMissing(id: number, sessionId: number, nowMs: number): void;
  bumpVideoAttempt(id: number, error: string): void;
  recordGap(lane: string, fromId: number, toId: number, reason: string, nowMs: number): void;
  recordFailure(kind: string, id: number, code: string, message: string, nowMs: number): void;
  /** Highest stored session id, 0 when there are none. */
  maxSessionId(): number;
  pendingCourses(limit: number): number[];
  pendingVideos(limit: number): PendingVideo[];
  /** Sessions that ended in (afterCn, beforeCn], still have no video, and were not re-checked since `refreshedBeforeMs`. */
  refreshCandidates(beforeCn: string, afterCn: string, refreshedBeforeMs: number, limit: number): number[];
}

/** Attempts after which a failing course/video is left alone. */
export const MAX_ATTEMPTS = 3;

const q = (name: string) => `"${name}"`;

function upsertSql(table: string, columns: string[], update: string[] | 'nothing', extraSet: string[] = []): string {
  const head = `INSERT INTO ${table} (${columns.map(q).join(', ')}) VALUES (${columns.map(() => '?').join(', ')})`;
  if (update === 'nothing') return `${head} ON CONFLICT(id) DO NOTHING`;
  const sets = [...update.map((c) => `${q(c)} = excluded.${q(c)}`), ...extraSet];
  return `${head} ON CONFLICT(id) DO UPDATE SET ${sets.join(', ')}`;
}

const names = (cols: ReadonlyArray<readonly [string, string]>) => cols.map(([n]) => n);

export class SqliteStore implements Store {
  readonly db: DatabaseSync;
  private readonly stmts = new Map<string, StatementSync>();

  constructor(path: string) {
    if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
    this.db = new DatabaseSync(path);
    this.db.exec('PRAGMA journal_mode = WAL; PRAGMA synchronous = NORMAL; PRAGMA busy_timeout = 5000;');
    this.db.exec(SCHEMA_SQL);
  }

  close(): void {
    this.db.close();
  }

  private stmt(sql: string): StatementSync {
    let s = this.stmts.get(sql);
    if (!s) {
      s = this.db.prepare(sql);
      this.stmts.set(sql, s);
    }
    return s;
  }

  private run(sql: string, values: SqlValue[]): void {
    this.stmt(sql).run(...values);
  }

  begin(): void {
    this.db.exec('BEGIN');
  }

  commit(): void {
    this.db.exec('COMMIT');
  }

  rollback(): void {
    if (this.db.isTransaction) this.db.exec('ROLLBACK');
  }

  getState(key: string): string | null {
    const row = this.stmt('SELECT value FROM crawl_state WHERE key = ?').get(key) as { value: string } | undefined;
    return row ? row.value : null;
  }

  setState(key: string, value: string): void {
    this.run('INSERT INTO crawl_state (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value', [key, value]);
  }

  deleteState(key: string): void {
    this.run('DELETE FROM crawl_state WHERE key = ?', [key]);
  }

  loadLane(key: string): LaneState | null {
    const v = this.getState(`lane:${key}`);
    return v ? (JSON.parse(v) as LaneState) : null;
  }

  saveLane(key: string, state: LaneState): void {
    this.setState(`lane:${key}`, JSON.stringify(state));
  }

  /** Every saved lane, by key. */
  allLanes(): Record<string, LaneState> {
    const rows = this.stmt("SELECT key, value FROM crawl_state WHERE key LIKE 'lane:%' ORDER BY key").all() as Array<{
      key: string;
      value: string;
    }>;
    return Object.fromEntries(rows.map((r) => [r.key.slice('lane:'.length), JSON.parse(r.value) as LaneState]));
  }

  saveSession(raw: Json, nowMs: number, opts: { refreshed: boolean; queueVideos: boolean }): void {
    const id = Number(raw.id);
    const row = splitRow(raw, SESSION_API, SESSION_SKIP);
    const api = [...names(SESSION_API), 'extra'];
    const cols = [...api, 'first_seen_at', 'fetched_at', 'changed_at', 'refreshed_at', 'gone_at'];
    const sql = upsertSql('sessions', cols, [...api, 'fetched_at', 'changed_at'], [
      'refreshed_at = COALESCE(excluded.refreshed_at, sessions.refreshed_at)',
      'gone_at = NULL',
    ]);
    this.run(sql, [...api.map((c) => row[c]), nowMs, nowMs, nowMs, opts.refreshed ? nowMs : null, null]);

    // The nested course is a free, slightly thinner copy of /v1/course
    // (no teachers, tags or image). Insert it once; the detail fetch fills in the rest.
    const course = asObject(raw.course);
    if (course && course.id != null) {
      const crow = splitRow(course, COURSE_API, COURSE_SKIP);
      const capi = [...names(COURSE_API), 'extra'];
      this.run(upsertSql('courses', [...capi, 'first_seen_at', 'changed_at'], 'nothing'), [
        ...capi.map((c) => crow[c]),
        nowMs,
        nowMs,
      ]);
    }

    if (opts.queueVideos) {
      for (const vid of videoIdsOf(raw)) this.queueVideo(vid, id, nowMs);
    }
  }

  private queueVideo(videoId: number, sessionId: number, nowMs: number): void {
    this.run(
      `INSERT INTO pending_videos (video_id, session_id, added_at)
       SELECT ?, ?, ? WHERE NOT EXISTS (SELECT 1 FROM videos WHERE id = ?)
       ON CONFLICT(video_id) DO NOTHING`,
      [videoId, sessionId, nowMs, videoId],
    );
  }

  /** Queue every stored `video_ids` entry that has no video row yet. Returns how many were added. */
  queueMissingVideos(nowMs: number): number {
    const r = this.stmt(
      `INSERT INTO pending_videos (video_id, session_id, added_at)
       SELECT CAST(j.value AS INTEGER), s.id, ?
       FROM sessions s, json_each(s.video_ids) j
       WHERE s.video_ids <> '[]'
         AND NOT EXISTS (SELECT 1 FROM videos v WHERE v.id = CAST(j.value AS INTEGER))
       ON CONFLICT(video_id) DO NOTHING`,
    ).run(nowMs);
    return Number(r.changes);
  }

  markSessionGone(id: number, nowMs: number): void {
    this.run('UPDATE sessions SET gone_at = ?, refreshed_at = ?, changed_at = ? WHERE id = ?', [nowMs, nowMs, nowMs, id]);
  }

  saveCourseDetail(raw: Json, nowMs: number): void {
    const row = splitRow(raw, COURSE_API, COURSE_SKIP);
    const api = [...names(COURSE_API), 'extra'];
    const own = ['professor_names', 'first_seen_at', 'detail_status', 'detail_fetched_at', 'changed_at'];
    const sql = upsertSql('courses', [...api, ...own], [...api, 'professor_names', 'detail_status', 'detail_fetched_at', 'changed_at']);
    this.run(sql, [...api.map((c) => row[c]), professorNames(raw.professors).join('、') || null, nowMs, 'ok', nowMs, nowMs]);
  }

  markCourse(id: number, status: 'missing' | 'error', nowMs: number): void {
    this.run(
      `UPDATE courses SET detail_status = ?, detail_attempts = detail_attempts + 1,
         detail_fetched_at = ?, changed_at = ? WHERE id = ?`,
      [status, nowMs, nowMs, id],
    );
  }

  saveVideo(raw: Json, sessionId: number, nowMs: number): void {
    const skip = VIDEO_ZERO_SKIP.filter((k) => raw[k] == null || Number(raw[k]) === 0);
    const row = splitRow(raw, VIDEO_API, skip);
    const api = [...names(VIDEO_API), 'extra'];
    const cols = [...api, 'session_id', 'status', 'fetched_at', 'changed_at'];
    this.run(upsertSql('videos', cols, cols.slice(1)), [...api.map((c) => row[c]), sessionId, 'ok', nowMs, nowMs]);
    this.run('DELETE FROM pending_videos WHERE video_id = ?', [Number(raw.id)]);
  }

  markVideoMissing(id: number, sessionId: number, nowMs: number): void {
    const cols = ['id', 'session_id', 'status', 'fetched_at', 'changed_at'];
    this.run(upsertSql('videos', cols, cols.slice(1)), [id, sessionId, 'missing', nowMs, nowMs]);
    this.run('DELETE FROM pending_videos WHERE video_id = ?', [id]);
  }

  bumpVideoAttempt(id: number, error: string): void {
    this.run('UPDATE pending_videos SET attempts = attempts + 1, last_error = ? WHERE video_id = ?', [error, id]);
  }

  recordGap(lane: string, fromId: number, toId: number, reason: string, nowMs: number): void {
    this.run('INSERT INTO gaps (lane, from_id, to_id, reason, recorded_at) VALUES (?, ?, ?, ?, ?)', [
      lane,
      Math.min(fromId, toId),
      Math.max(fromId, toId),
      reason,
      nowMs,
    ]);
  }

  recordFailure(kind: string, id: number, code: string, message: string, nowMs: number): void {
    this.run(
      `INSERT INTO failures (kind, id, code, message, attempts, last_at) VALUES (?, ?, ?, ?, 1, ?)
       ON CONFLICT(kind, id) DO UPDATE SET attempts = attempts + 1, code = excluded.code,
         message = excluded.message, last_at = excluded.last_at`,
      [kind, id, code, message, nowMs],
    );
  }

  pendingCourses(limit: number): number[] {
    const rows = this.stmt(
      `SELECT id FROM courses
       WHERE detail_status IS NULL OR (detail_status = 'error' AND detail_attempts < ${MAX_ATTEMPTS})
       ORDER BY id DESC LIMIT ?`,
    ).all(limit) as Array<{ id: number }>;
    return rows.map((r) => r.id);
  }

  pendingVideos(limit: number): PendingVideo[] {
    const rows = this.stmt(
      `SELECT video_id, session_id FROM pending_videos WHERE attempts < ${MAX_ATTEMPTS} ORDER BY video_id DESC LIMIT ?`,
    ).all(limit) as Array<{ video_id: number; session_id: number }>;
    return rows.map((r) => ({ videoId: r.video_id, sessionId: r.session_id }));
  }

  refreshCandidates(beforeCn: string, afterCn: string, refreshedBeforeMs: number, limit: number): number[] {
    const rows = this.stmt(
      `SELECT id FROM sessions
       WHERE state = 1 AND video_ids = '[]' AND gone_at IS NULL
         AND ended_at <= ? AND ended_at > ?
         AND (refreshed_at IS NULL OR refreshed_at < ?)
       ORDER BY ended_at DESC LIMIT ?`,
    ).all(beforeCn, afterCn, refreshedBeforeMs, limit) as Array<{ id: number }>;
    return rows.map((r) => r.id);
  }

  /** Small summary used by `status`, end-of-run reports and the D1 progress row. */
  maxSessionId(): number {
    return Number((this.stmt('SELECT COALESCE(MAX(id), 0) AS n FROM sessions').get() as { n: number }).n);
  }

  totals(): Record<string, number> {
    const n = (sql: string) => Number(Object.values(this.stmt(sql).get() as object)[0] ?? 0);
    return {
      sessions: n('SELECT COUNT(*) FROM sessions'),
      sessionsWithVideo: n("SELECT COUNT(*) FROM sessions WHERE video_ids <> '[]'"),
      courses: n('SELECT COUNT(*) FROM courses'),
      coursesDetailed: n("SELECT COUNT(*) FROM courses WHERE detail_status = 'ok'"),
      videos: n("SELECT COUNT(*) FROM videos WHERE status = 'ok'"),
      videosQueued: n('SELECT COUNT(*) FROM pending_videos'),
      minSessionId: n('SELECT COALESCE(MIN(id), 0) FROM sessions'),
      maxSessionId: n('SELECT COALESCE(MAX(id), 0) FROM sessions'),
    };
  }

  /**
   * Merge another index file (e.g. a GitHub Actions artifact) into this one,
   * with the same rules as a D1 upload. Merged rows get `changed_at = nowMs`
   * so the next `upload` from this device includes them. Returns rows
   * inserted or updated per table, and the other file's lane positions.
   */
  mergeFrom(path: string, nowMs: number): { rows: Record<string, number>; lanes: Record<string, LaneState> } {
    const cols = (schema: string, table: string) =>
      (this.db.prepare(`PRAGMA ${schema}.table_info(${table})`).all() as Array<{ name: string }>).map((c) => c.name);
    this.db.prepare('ATTACH DATABASE ? AS src').run(path);
    try {
      const rows: Record<string, number> = {};
      this.begin();
      try {
        for (const table of SYNC_TABLE_NAMES) {
          const theirs = new Set(cols('src', table));
          if (theirs.size === 0) {
            rows[table] = 0;
            continue;
          }
          const shared = cols('main', table).filter((c) => theirs.has(c));
          const rule = SYNC_TABLES[table];
          const select = shared.map((c) => (c === 'changed_at' ? '? AS changed_at' : q(c))).join(', ');
          const sets = shared.filter((c) => c !== 'id' && !(rule.keep as readonly string[]).includes(c)).map((c) => `${q(c)} = excluded.${q(c)}`);
          const r = this.db
            .prepare(
              `INSERT INTO main.${table} (${shared.map(q).join(', ')}) SELECT ${select} FROM src.${table} WHERE true
               ON CONFLICT(id) DO UPDATE SET ${sets.join(', ')} WHERE ${rule.where}`,
            )
            .run(nowMs);
          rows[table] = Number(r.changes);
        }
        this.commit();
      } catch (err) {
        this.rollback();
        throw err;
      }
      const lanes = Object.fromEntries(
        (this.db.prepare("SELECT key, value FROM src.crawl_state WHERE key LIKE 'lane:%'").all() as Array<{ key: string; value: string }>).map(
          (r) => [r.key.slice('lane:'.length), JSON.parse(r.value) as LaneState],
        ),
      );
      return { rows, lanes };
    } finally {
      this.db.exec('DETACH DATABASE src');
    }
  }

  startRun(nowMs: number): number {
    const r = this.stmt('INSERT INTO runs (started_at) VALUES (?)').run(nowMs);
    return Number(r.lastInsertRowid);
  }

  finishRun(id: number, stats: RunStats, reason: string, nowMs: number): void {
    this.run(
      `UPDATE runs SET ended_at = ?, requests = ?, sessions_found = ?, sessions_missing = ?,
         courses = ?, videos = ?, stop_reason = ? WHERE id = ?`,
      [nowMs, stats.requests, stats.sessionsFound, stats.sessionsMissing, stats.courses, stats.videos, reason, id],
    );
  }
}
