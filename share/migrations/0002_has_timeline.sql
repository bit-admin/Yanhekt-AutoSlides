-- v3 share payloads can carry a compact slide timeline. Same image identity
-- (fingerprint) is updated in place; this flag is what the Index UI reads.
ALTER TABLE versions ADD COLUMN has_timeline INTEGER NOT NULL DEFAULT 0;
