-- AutoSlides Index schema. Written only on publish (rare, human-initiated), so it
-- stays comfortably inside the D1 free-plan write budget.

-- One row per (course, session) lecture. `search_text` is a lowercased haystack
-- (title/instructor/college/professors) queried with LIKE — the dataset is small
-- and search responses are edge-cached, so a scan is cheap and avoids the
-- maintenance cost of external-content FTS triggers.
CREATE TABLE IF NOT EXISTS lectures (
  course_id     TEXT NOT NULL,
  session_id    TEXT NOT NULL,
  course_title  TEXT,
  session_title TEXT,
  instructor    TEXT,
  professors    TEXT,            -- JSON array
  semester      TEXT,
  school_year   TEXT,
  college       TEXT,
  week_number   INTEGER,
  day           INTEGER,
  search_text   TEXT,
  version_count INTEGER NOT NULL DEFAULT 0,
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL,
  PRIMARY KEY (course_id, session_id)
);

CREATE INDEX IF NOT EXISTS idx_lectures_updated ON lectures(updated_at);

-- One row per distinct version of a lecture. `fingerprint` is the order-sensitive
-- hash of the image-identity list (from the v1 payload): same images + same order
-- collapse to one row (idempotent publish); a reorder or image change is a new
-- version. `uploader_id` is the Yanhekt user id (the recorded "badge").
CREATE TABLE IF NOT EXISTS versions (
  fingerprint   TEXT PRIMARY KEY,
  course_id     TEXT NOT NULL,
  session_id    TEXT NOT NULL,
  share_id      TEXT NOT NULL,           -- v1 shortlink id (/v1/s/<id>)
  title         TEXT,
  image_count   INTEGER,
  reviewed      INTEGER NOT NULL DEFAULT 0,  -- human reviewed the slides
  edited        INTEGER NOT NULL DEFAULT 0,  -- human edited (crop counts as edit)
  uploader_id   TEXT NOT NULL,
  uploader_name TEXT,
  created_at    TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_versions_lecture ON versions(course_id, session_id);
CREATE INDEX IF NOT EXISTS idx_versions_created ON versions(created_at);
