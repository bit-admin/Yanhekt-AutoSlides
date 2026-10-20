/** SQLite persistence (node:sqlite, synchronous). */

import { DatabaseSync, type StatementSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { asObject, professorNames, splitRow, toSql, videoIdsOf, type SqlValue } from './extract.ts';
import {
  COURSE_API,
  COURSE_SKIP,
  LIVE_API,
  LIVE_SKIP,
  SCHEMA_SQL,
  SESSION_API,
  SESSION_SKIP,
  VIDEO_API,
  VIDEO_ZERO_SKIP,
} from './schema.ts';
import type { Json } from './yanhekt.ts';

export interface LaneState {
  /** Next id to look at. */
  cursor: number;
  /** Consecutive missing ids just before `cursor`. */
  missRun: number;
  /** First id of that missing run. */
  missRunStart: number | null;
  /** Forward lane only: parked at the frontier until this time. */
  parkedUntilMs: number | null;
  /** Backfill lane only: reached the floor. */
  done: boolean;
}

export interface CrawlState {
  forward: LaneState;
  backfill: LaneState;
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

/** What the crawler needs from storage. Implemented by SqliteStore; faked in tests. */
export interface Store {
  begin(): void;
  commit(): void;
  rollback(): void;
  loadState(fallback: CrawlState): CrawlState;
  saveState(state: CrawlState): void;
  saveSession(raw: Json, nowMs: number, opts: { refreshed: boolean; queueVideos: boolean }): void;
  markSessionGone(id: number, nowMs: number): void;
  saveCourseDetail(raw: Json, professors: unknown[] | null, nowMs: number): void;
  markCourse(id: number, status: 'missing' | 'error', nowMs: number): void;
  saveVideo(raw: Json, sessionId: number, nowMs: number): void;
  markVideoMissing(id: number, sessionId: number, nowMs: number): void;
  bumpVideoAttempt(id: number, error: string): void;
  recordGap(lane: string, fromId: number, toId: number, reason: string, nowMs: number): void;
  recordFailure(kind: string, id: number, code: string, message: string, nowMs: number): void;
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

  loadState(fallback: CrawlState): CrawlState {
    const row = this.stmt('SELECT value FROM crawl_state WHERE key = ?').get('lanes') as { value: string } | undefined;
    if (!row) return structuredClone(fallback);
    const saved = JSON.parse(row.value) as Partial<CrawlState>;
    return {
      forward: { ...fallback.forward, ...saved.forward },
      backfill: { ...fallback.backfill, ...saved.backfill },
    };
  }

  saveState(state: CrawlState): void {
    this.run('INSERT INTO crawl_state (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value', [
      'lanes',
      JSON.stringify(state),
    ]);
  }

  saveSession(raw: Json, nowMs: number, opts: { refreshed: boolean; queueVideos: boolean }): void {
    const id = Number(raw.id);
    const live = asObject(raw.live);
    const liveId = live && live.id != null ? Number(live.id) : null;

    const row = splitRow(raw, SESSION_API, SESSION_SKIP);
    const api = [...names(SESSION_API), 'extra'];
    const cols = [...api, 'live_id', 'first_seen_at', 'fetched_at', 'refreshed_at', 'gone_at'];
    const sql = upsertSql('sessions', cols, [...api, 'live_id', 'fetched_at'], [
      'refreshed_at = COALESCE(excluded.refreshed_at, sessions.refreshed_at)',
      'gone_at = NULL',
    ]);
    this.run(sql, [...api.map((c) => row[c]), liveId, nowMs, nowMs, opts.refreshed ? nowMs : null, null]);

    if (live && liveId != null) {
      const lrow = splitRow(live, LIVE_API, LIVE_SKIP);
      const lapi = [...names(LIVE_API), 'extra'];
      const lcols = [...lapi, 'session_id', 'fetched_at'];
      this.run(upsertSql('lives', lcols, lcols.slice(1)), [...lapi.map((c) => lrow[c]), id, nowMs]);
    }

    // The nested course is a free, slightly thinner copy of /v1/course.
    // Insert it once; the detail fetch later fills in the rest.
    const course = asObject(raw.course);
    if (course && course.id != null) {
      const crow = splitRow(course, COURSE_API, COURSE_SKIP);
      const capi = [...names(COURSE_API), 'extra'];
      this.run(upsertSql('courses', [...capi, 'first_seen_at'], 'nothing'), [...capi.map((c) => crow[c]), nowMs]);
    }

    if (opts.queueVideos) {
      for (const vid of videoIdsOf(raw)) {
        this.run(
          `INSERT INTO pending_videos (video_id, session_id, added_at)
           SELECT ?, ?, ? WHERE NOT EXISTS (SELECT 1 FROM videos WHERE id = ?)
           ON CONFLICT(video_id) DO NOTHING`,
          [vid, id, nowMs, vid],
        );
      }
    }
  }

  markSessionGone(id: number, nowMs: number): void {
    this.run('UPDATE sessions SET gone_at = ?, refreshed_at = ? WHERE id = ?', [nowMs, nowMs, id]);
  }

  saveCourseDetail(raw: Json, professors: unknown[] | null, nowMs: number): void {
    const row = splitRow(raw, COURSE_API, COURSE_SKIP);
    const api = [...names(COURSE_API), 'extra'];
    const own = ['professor_list', 'professor_names', 'first_seen_at', 'detail_status', 'detail_fetched_at'];
    const list = professors ?? (Array.isArray(raw.professors) ? raw.professors : []);
    const sql = upsertSql('courses', [...api, ...own], [...api, 'professor_list', 'professor_names', 'detail_status', 'detail_fetched_at']);
    this.run(sql, [
      ...api.map((c) => row[c]),
      professors ? toSql(professors) : null,
      professorNames(list).join('、') || null,
      nowMs,
      'ok',
      nowMs,
    ]);
  }

  markCourse(id: number, status: 'missing' | 'error', nowMs: number): void {
    this.run(
      'UPDATE courses SET detail_status = ?, detail_attempts = detail_attempts + 1, detail_fetched_at = ? WHERE id = ?',
      [status, nowMs, id],
    );
  }

  saveVideo(raw: Json, sessionId: number, nowMs: number): void {
    const skip = VIDEO_ZERO_SKIP.filter((k) => raw[k] == null || Number(raw[k]) === 0);
    const row = splitRow(raw, VIDEO_API, skip);
    const api = [...names(VIDEO_API), 'extra'];
    const cols = [...api, 'session_id', 'status', 'fetched_at'];
    this.run(upsertSql('videos', cols, cols.slice(1)), [...api.map((c) => row[c]), sessionId, 'ok', nowMs]);
    this.run('DELETE FROM pending_videos WHERE video_id = ?', [Number(raw.id)]);
  }

  markVideoMissing(id: number, sessionId: number, nowMs: number): void {
    this.run(upsertSql('videos', ['id', 'session_id', 'status', 'fetched_at'], ['session_id', 'status', 'fetched_at']), [
      id,
      sessionId,
      'missing',
      nowMs,
    ]);
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
