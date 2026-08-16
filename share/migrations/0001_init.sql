-- AutoSlides Index v2. Identity is (course_id, session_id) only — Yanhekt
-- titles/professors/term are hydrated at read time from the public (no-auth)
-- course/session APIs, so we do not store publisher-supplied names.
--
-- Written only on publish (rare, human-initiated).

CREATE TABLE IF NOT EXISTS lectures (
  course_id     TEXT NOT NULL,
  session_id    TEXT NOT NULL,
  version_count INTEGER NOT NULL DEFAULT 0,
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL,
  PRIMARY KEY (course_id, session_id)
);

CREATE INDEX IF NOT EXISTS idx_lectures_course ON lectures(course_id);
CREATE INDEX IF NOT EXISTS idx_lectures_updated ON lectures(updated_at);

-- One row per distinct image-identity of a lecture. `fingerprint` is the
-- order-sensitive hash of the share payload's image list. `uploader_id` is the
-- Yanhekt user badge (moderation only; never exposed publicly).
CREATE TABLE IF NOT EXISTS versions (
  fingerprint   TEXT PRIMARY KEY,
  course_id     TEXT NOT NULL,
  session_id    TEXT NOT NULL,
  share_id      TEXT NOT NULL,
  image_count   INTEGER,
  reviewed      INTEGER NOT NULL DEFAULT 0,
  edited        INTEGER NOT NULL DEFAULT 0,
  uploader_id   TEXT NOT NULL,
  uploader_name TEXT,
  created_at    TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_versions_lecture ON versions(course_id, session_id);
CREATE INDEX IF NOT EXISTS idx_versions_course ON versions(course_id);
CREATE INDEX IF NOT EXISTS idx_versions_created ON versions(created_at);
