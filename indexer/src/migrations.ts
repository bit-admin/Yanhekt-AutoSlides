// The local database's schema version, kept in SQLite's `user_version`.
//
// The database is the master copy of the index, and earlier terms can no
// longer be fetched again, so it is never rebuilt to change its shape: each
// change is one step here, run once, in a transaction with the version bump.
// `CREATE TABLE IF NOT EXISTS` alone cannot add a column to a table that is
// already there, which is why a later change must be a step, not an edit of
// the schema text. A database from a newer indexer is refused, not opened.
import type { DatabaseSync } from 'node:sqlite';
import { SCHEMA_SQL } from './schema.ts';

/**
 * Step `i` takes a database from version `i` to `i + 1`. Version 0 is a new
 * database or one made before versions were kept (both have, or get, the
 * tables of `SCHEMA_SQL`); step 0 creates whatever is missing and stamps it.
 * Add the next change as a new step at the end; never edit an old one.
 */
export const MIGRATIONS: ReadonlyArray<(db: DatabaseSync) => void> = [
  (db) => db.exec(SCHEMA_SQL),
];

export const SCHEMA_VERSION = MIGRATIONS.length;

export function schemaVersion(db: DatabaseSync): number {
  const row = db.prepare('PRAGMA user_version').get() as { user_version?: number } | undefined;
  return Number(row?.user_version ?? 0);
}

/** Bring `db` to `SCHEMA_VERSION`, one step per transaction. Answers the version it started at. */
export function migrate(db: DatabaseSync, steps: ReadonlyArray<(db: DatabaseSync) => void> = MIGRATIONS): number {
  const start = schemaVersion(db);
  if (start > steps.length) {
    throw new Error(`This database has schema version ${start}, newer than this indexer knows (${steps.length}). Update the indexer; the database was not changed.`);
  }
  for (let version = start; version < steps.length; version++) {
    db.exec('BEGIN IMMEDIATE');
    try {
      steps[version](db);
      db.exec(`PRAGMA user_version = ${version + 1}`);
      db.exec('COMMIT');
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    }
  }
  // Tables a step did not reach (none today) are still created, as before.
  db.exec(SCHEMA_SQL);
  return start;
}
