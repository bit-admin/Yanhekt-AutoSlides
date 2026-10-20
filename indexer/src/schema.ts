/**
 * Table layout. API fields are stored column-for-column under their API
 * names; any key we do not know lands in `extra` (JSON). A few keys are
 * dropped on purpose (the `*_SKIP` lists). Columns after the API block are ours.
 *
 * Times from Yanhekt (`started_at`, …) are Beijing wall-clock TEXT, as sent.
 * Our own times (`first_seen_at`, `fetched_at`, `changed_at`, …) are epoch ms.
 *
 * Two groups of tables:
 * - shared (SYNC_TABLES + device_progress): uploaded to Cloudflare D1. Every
 *   write sets `changed_at`, which is what makes uploads incremental.
 * - local (queues, logs, crawl positions): stay on the device.
 */

import { sqlLiteral } from './sql.ts';

export type ColType = 'INTEGER' | 'TEXT';
export type Columns = ReadonlyArray<readonly [name: string, type: ColType]>;

export const SESSION_API: Columns = [
  ['id', 'INTEGER'],
  ['course_id', 'INTEGER'],
  ['number', 'TEXT'],
  ['section_group', 'INTEGER'],
  ['section_group_title', 'TEXT'],
  ['chapter', 'TEXT'],
  ['title', 'TEXT'],
  ['week_number', 'INTEGER'],
  ['day', 'INTEGER'],
  ['started_at', 'TEXT'],
  ['ended_at', 'TEXT'],
  ['section_start', 'INTEGER'],
  ['section_end', 'INTEGER'],
  ['professor_id', 'INTEGER'],
  ['badge', 'TEXT'],
  ['location', 'TEXT'],
  ['university_id', 'INTEGER'],
  ['state', 'INTEGER'],
  ['weight', 'INTEGER'],
  ['parent_id', 'INTEGER'],
  ['digit_human', 'TEXT'],
  ['video_ids', 'TEXT'],
];
/**
 * Session keys not kept in the session row: `course` is stored in `courses`;
 * `live` (the live-broadcast record) is not stored at all, since its stream
 * URLs only work during the lecture; `user_progress` is empty anonymously.
 */
export const SESSION_SKIP = ['course', 'live', 'user_progress'];

export const COURSE_API: Columns = [
  ['id', 'INTEGER'],
  ['number', 'TEXT'],
  ['name_zh', 'TEXT'],
  ['name_en', 'TEXT'],
  ['code', 'TEXT'],
  ['school_year', 'TEXT'],
  ['semester', 'INTEGER'],
  ['university_id', 'INTEGER'],
  ['university_code', 'INTEGER'],
  ['college_id', 'INTEGER'],
  ['college_code', 'TEXT'],
  ['college_name', 'TEXT'],
  ['image_url', 'TEXT'],
  ['lx_url', 'TEXT'],
  ['lx_state', 'INTEGER'],
  ['orientation', 'INTEGER'],
  ['type', 'INTEGER'],
  ['visibility', 'INTEGER'],
  ['views', 'INTEGER'],
  ['session_count', 'INTEGER'],
  ['session_ongoing', 'INTEGER'],
  ['state', 'INTEGER'],
  ['video_status', 'INTEGER'],
  ['is_record_room', 'INTEGER'],
  ['type_name', 'TEXT'],
  ['graph', 'TEXT'],
  ['introduction', 'TEXT'],
  ['professors', 'TEXT'],
  ['professor_badges', 'TEXT'],
  ['college', 'TEXT'],
  ['tags', 'TEXT'],
];
/** Per-viewer field; always 0 anonymously. */
export const COURSE_SKIP = ['user_mapping_type'];

export const VIDEO_API: Columns = [
  ['id', 'INTEGER'],
  ['type', 'INTEGER'],
  ['format', 'TEXT'],
  ['path', 'TEXT'],
  ['main', 'TEXT'],
  ['main_origin', 'TEXT'],
  ['vga', 'TEXT'],
  ['vga_origin', 'TEXT'],
  ['room', 'TEXT'],
  ['room_origin', 'TEXT'],
  ['audio', 'TEXT'],
  ['audio_origin', 'TEXT'],
  ['duration', 'INTEGER'],
  ['start_main', 'INTEGER'],
  ['start_vga', 'INTEGER'],
  ['start_room', 'INTEGER'],
  ['created_at', 'TEXT'],
  ['updated_at', 'TEXT'],
];
/**
 * `/v1/video` always answers course_id 0 / session_id 0. They are dropped
 * when 0 (kept in `extra` otherwise); `videos.session_id` is ours instead.
 */
export const VIDEO_ZERO_SKIP = ['course_id', 'session_id'];

function cols(api: Columns, own: string): string {
  const lines = api.map(([n, t]) => `  "${n}" ${t}${n === 'id' ? ' PRIMARY KEY' : ''}`);
  return [...lines, '  extra TEXT', own].join(',\n');
}

/** Tables that are uploaded to D1 (and created there). */
export const SHARED_SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS sessions (
${cols(SESSION_API, `  first_seen_at INTEGER NOT NULL,
  fetched_at INTEGER NOT NULL,
  refreshed_at INTEGER,
  gone_at INTEGER,
  changed_at INTEGER NOT NULL`)}
);
CREATE INDEX IF NOT EXISTS idx_sessions_course ON sessions(course_id);
CREATE INDEX IF NOT EXISTS idx_sessions_started ON sessions(started_at);
CREATE INDEX IF NOT EXISTS idx_sessions_changed ON sessions(changed_at, id);
CREATE INDEX IF NOT EXISTS idx_sessions_no_video ON sessions(ended_at) WHERE state = 1 AND video_ids = '[]' AND gone_at IS NULL;

CREATE TABLE IF NOT EXISTS courses (
${cols(COURSE_API, `  professor_names TEXT,
  first_seen_at INTEGER NOT NULL,
  detail_status TEXT,
  detail_attempts INTEGER NOT NULL DEFAULT 0,
  detail_fetched_at INTEGER,
  changed_at INTEGER NOT NULL`)}
);
CREATE INDEX IF NOT EXISTS idx_courses_term ON courses(school_year, semester);
CREATE INDEX IF NOT EXISTS idx_courses_name ON courses(name_zh);
CREATE INDEX IF NOT EXISTS idx_courses_changed ON courses(changed_at, id);
CREATE INDEX IF NOT EXISTS idx_courses_pending ON courses(id) WHERE detail_status IS NULL OR detail_status = 'error';

CREATE TABLE IF NOT EXISTS videos (
${cols(VIDEO_API, `  session_id INTEGER,
  status TEXT NOT NULL,
  fetched_at INTEGER NOT NULL,
  changed_at INTEGER NOT NULL`)}
);
CREATE INDEX IF NOT EXISTS idx_videos_session ON videos(session_id);
CREATE INDEX IF NOT EXISTS idx_videos_changed ON videos(changed_at, id);

CREATE TABLE IF NOT EXISTS device_progress (
  device TEXT PRIMARY KEY,
  lanes TEXT NOT NULL,
  totals TEXT NOT NULL,
  uploaded_at INTEGER NOT NULL
);
`;

/** Device-only tables. */
export const LOCAL_SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS pending_videos (
  video_id INTEGER PRIMARY KEY,
  session_id INTEGER NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  added_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS gaps (
  lane TEXT NOT NULL,
  from_id INTEGER NOT NULL,
  to_id INTEGER NOT NULL,
  reason TEXT NOT NULL,
  recorded_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS failures (
  kind TEXT NOT NULL,
  id INTEGER NOT NULL,
  code TEXT,
  message TEXT,
  attempts INTEGER NOT NULL DEFAULT 1,
  last_at INTEGER NOT NULL,
  PRIMARY KEY (kind, id)
);

CREATE TABLE IF NOT EXISTS runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  started_at INTEGER NOT NULL,
  ended_at INTEGER,
  requests INTEGER NOT NULL DEFAULT 0,
  sessions_found INTEGER NOT NULL DEFAULT 0,
  sessions_missing INTEGER NOT NULL DEFAULT 0,
  courses INTEGER NOT NULL DEFAULT 0,
  videos INTEGER NOT NULL DEFAULT 0,
  stop_reason TEXT
);

CREATE TABLE IF NOT EXISTS crawl_state (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
`;

export const SCHEMA_SQL = SHARED_SCHEMA_SQL + LOCAL_SCHEMA_SQL;

/** Individual statements of a schema string (D1 accepts them joined, but this keeps requests small). */
export function statements(sql: string): string[] {
  return sql
    .split(/;\s*\n/)
    .map((s) => s.trim().replace(/;$/, ''))
    .filter((s) => s.length > 0);
}

/**
 * How two copies of the same row are merged when several devices upload.
 * The incoming row (`excluded`) replaces the stored one only when it is at
 * least as good: a fuller status first, then the newer fetch.
 */
const courseRank = (t: string) => `(CASE ${t}.detail_status WHEN 'ok' THEN 2 WHEN 'missing' THEN 1 ELSE 0 END)`;
const videoRank = (t: string) => `(CASE ${t}.status WHEN 'ok' THEN 1 ELSE 0 END)`;

export const SYNC_TABLES = {
  courses: {
    keep: ['first_seen_at'],
    where: `${courseRank('excluded')} > ${courseRank('courses')} OR (${courseRank('excluded')} = ${courseRank('courses')} AND excluded.changed_at >= courses.changed_at)`,
  },
  sessions: {
    keep: ['first_seen_at'],
    where: 'excluded.fetched_at >= sessions.fetched_at',
  },
  videos: {
    keep: [] as string[],
    where: `${videoRank('excluded')} > ${videoRank('videos')} OR (${videoRank('excluded')} = ${videoRank('videos')} AND excluded.fetched_at >= videos.fetched_at)`,
  },
} as const;

export type SyncTable = keyof typeof SYNC_TABLES;
export const SYNC_TABLE_NAMES = Object.keys(SYNC_TABLES) as SyncTable[];

/** One self-contained merge-upsert statement (literals inlined) for D1. */
export function mergeStatement(table: SyncTable, row: Record<string, unknown>): string {
  const rule = SYNC_TABLES[table];
  const columns = Object.keys(row);
  const sets = columns
    .filter((c) => c !== 'id' && !(rule.keep as readonly string[]).includes(c))
    .map((c) => `"${c}" = excluded."${c}"`);
  return (
    `INSERT INTO ${table} (${columns.map((c) => `"${c}"`).join(', ')}) VALUES (${columns
      .map((c) => sqlLiteral(row[c]))
      .join(', ')}) ` + `ON CONFLICT(id) DO UPDATE SET ${sets.join(', ')} WHERE ${rule.where}`
  );
}
