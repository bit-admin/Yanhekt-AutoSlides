import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { migrate, SCHEMA_VERSION, schemaVersion } from './migrations.ts';
import { SCHEMA_SQL } from './schema.ts';
import { SqliteStore } from './store.ts';

const tables = (db: DatabaseSync) =>
  (db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name").all() as Array<{ name: string }>).map((r) => r.name);

test('a new database gets every table and the current version', () => {
  const db = new DatabaseSync(':memory:');
  assert.equal(migrate(db), 0);
  assert.equal(schemaVersion(db), SCHEMA_VERSION);
  assert.ok(tables(db).includes('sessions'));
  assert.ok(tables(db).includes('d1_sent'));
});

test('a database made before versions were kept is stamped and keeps its rows', () => {
  const db = new DatabaseSync(':memory:');
  db.exec(SCHEMA_SQL);
  db.exec("INSERT INTO crawl_state (key, value) VALUES ('probe', 'kept')");
  migrate(db);
  assert.equal(schemaVersion(db), SCHEMA_VERSION);
  assert.equal((db.prepare("SELECT value FROM crawl_state WHERE key = 'probe'").get() as { value: string }).value, 'kept');
});

test('opening again changes nothing', () => {
  const db = new DatabaseSync(':memory:');
  migrate(db);
  assert.equal(migrate(db), SCHEMA_VERSION);
  assert.equal(schemaVersion(db), SCHEMA_VERSION);
});

test('a database from a newer indexer is refused and left as it was', () => {
  const db = new DatabaseSync(':memory:');
  db.exec(`PRAGMA user_version = ${SCHEMA_VERSION + 1}`);
  assert.throws(() => migrate(db), /newer than this indexer/);
  assert.deepEqual(tables(db), []);
  assert.equal(schemaVersion(db), SCHEMA_VERSION + 1);
});

test('a step that fails leaves the database at the version before it', () => {
  const db = new DatabaseSync(':memory:');
  const steps = [
    (d: DatabaseSync) => d.exec('CREATE TABLE a (x)'),
    (d: DatabaseSync) => {
      d.exec('CREATE TABLE b (x)');
      throw new Error('interrupted');
    },
  ];
  assert.throws(() => migrate(db, steps), /interrupted/);
  assert.equal(schemaVersion(db), 1);
  assert.ok(tables(db).includes('a'));
  assert.ok(!tables(db).includes('b'));
});

test('the store migrates the file it opens', () => {
  const dir = mkdtempSync(join(tmpdir(), 'indexer-migrate-'));
  try {
    const store = new SqliteStore(join(dir, 'index.db'));
    assert.equal(schemaVersion(store.db), SCHEMA_VERSION);
    store.close();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
