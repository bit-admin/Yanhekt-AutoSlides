/**
 * Table layout. API fields are stored column-for-column under their API
 * names; any key we do not know lands in `extra` (JSON), so nothing the API
 * returns is dropped. Columns below the API block are ours (bookkeeping).
 *
 * Times from Yanhekt (`started_at`, …) are Beijing wall-clock TEXT, as sent.
 * Our own times (`*_at` in the bookkeeping block) are epoch milliseconds.
 */

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
/** Session keys stored elsewhere (nested objects) or meaningless anonymously. */
export const SESSION_SKIP = ['course', 'live', 'user_progress'];

export const LIVE_API: Columns = [
  ['id', 'INTEGER'],
  ['source_id', 'INTEGER'],
  ['source_type', 'INTEGER'],
  ['status', 'INTEGER'],
  ['type', 'INTEGER'],
  ['schedule_started_at', 'TEXT'],
  ['schedule_ended_at', 'TEXT'],
  ['started_at', 'TEXT'],
  ['ended_at', 'TEXT'],
  ['location', 'TEXT'],
  ['caster_id', 'TEXT'],
  ['caster_name', 'TEXT'],
  ['caster_stream', 'TEXT'],
  ['title', 'TEXT'],
  ['subtitle', 'TEXT'],
  ['views', 'INTEGER'],
  ['target', 'TEXT'],
  ['target_vga', 'TEXT'],
  ['target_room', 'TEXT'],
  ['img', 'TEXT'],
  ['visibility', 'INTEGER'],
  ['code_required', 'INTEGER'],
  ['code', 'TEXT'],
  ['state', 'INTEGER'],
  ['version', 'TEXT'],
  ['created_at', 'TEXT'],
  ['updated_at', 'TEXT'],
  ['is_record_room', 'INTEGER'],
];
/** Join artefact of the session query. */
export const LIVE_SKIP = ['laravel_through_key'];

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

/** Full DDL. Idempotent (IF NOT EXISTS). */
export const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS sessions (
${cols(SESSION_API, `  live_id INTEGER,
  first_seen_at INTEGER NOT NULL,
  fetched_at INTEGER NOT NULL,
  refreshed_at INTEGER,
  gone_at INTEGER`)}
);
CREATE INDEX IF NOT EXISTS idx_sessions_course ON sessions(course_id);
CREATE INDEX IF NOT EXISTS idx_sessions_started ON sessions(started_at);
CREATE INDEX IF NOT EXISTS idx_sessions_no_video ON sessions(ended_at) WHERE state = 1 AND video_ids = '[]' AND gone_at IS NULL;

CREATE TABLE IF NOT EXISTS lives (
${cols(LIVE_API, `  session_id INTEGER,
  fetched_at INTEGER NOT NULL`)}
);
CREATE INDEX IF NOT EXISTS idx_lives_session ON lives(session_id);

CREATE TABLE IF NOT EXISTS courses (
${cols(COURSE_API, `  professor_list TEXT,
  professor_names TEXT,
  first_seen_at INTEGER NOT NULL,
  detail_status TEXT,
  detail_attempts INTEGER NOT NULL DEFAULT 0,
  detail_fetched_at INTEGER`)}
);
CREATE INDEX IF NOT EXISTS idx_courses_term ON courses(school_year, semester);
CREATE INDEX IF NOT EXISTS idx_courses_name ON courses(name_zh);
CREATE INDEX IF NOT EXISTS idx_courses_pending ON courses(id) WHERE detail_status IS NULL OR detail_status = 'error';

CREATE TABLE IF NOT EXISTS videos (
${cols(VIDEO_API, `  session_id INTEGER,
  status TEXT NOT NULL,
  fetched_at INTEGER NOT NULL`)}
);
CREATE INDEX IF NOT EXISTS idx_videos_session ON videos(session_id);

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

/** Tables copied by `dump`, in dependency-free order. */
export const DUMP_TABLES = ['courses', 'sessions', 'lives', 'videos', 'pending_videos', 'gaps', 'failures', 'runs', 'crawl_state'];
