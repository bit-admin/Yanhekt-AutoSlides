/**
 * `dump` command: the shared tables as plain SQL files, for people who prefer
 *   npx wrangler d1 execute <db> --remote --file=<file>
 * over `upload`. Statements are the same merge-upserts `upload` sends, so
 * dumps from several devices can be applied in any order.
 * D1 rejects BEGIN/COMMIT in imported files, so none are written.
 */

import { closeSync, mkdirSync, openSync, writeSync } from 'node:fs';
import { join } from 'node:path';
import type { DatabaseSync } from 'node:sqlite';
import { mergeStatement, SHARED_SCHEMA_SQL, SYNC_TABLE_NAMES } from './schema.ts';

export function dumpForD1(db: DatabaseSync, outDir: string, maxBytes: number, log: (m: string) => void): string[] {
  mkdirSync(outDir, { recursive: true });
  let part = 0;
  let fd = -1;
  let size = 0;
  const files: string[] = [];

  const open = () => {
    if (fd >= 0) closeSync(fd);
    part += 1;
    const name = join(outDir, `${String(part).padStart(4, '0')}.sql`);
    files.push(name);
    fd = openSync(name, 'w');
    size = 0;
  };
  const write = (s: string) => {
    const bytes = Buffer.byteLength(s);
    if (fd < 0 || (size > 0 && size + bytes > maxBytes)) open();
    writeSync(fd, s);
    size += bytes;
  };

  write(`${SHARED_SCHEMA_SQL.trim()}\n`);
  for (const table of SYNC_TABLE_NAMES) {
    let rows = 0;
    for (const row of db.prepare(`SELECT * FROM ${table} ORDER BY id`).iterate() as Iterable<Record<string, unknown>>) {
      write(`${mergeStatement(table, row)};\n`);
      rows += 1;
    }
    log(`dump: ${table}: ${rows} rows`);
  }
  if (fd >= 0) closeSync(fd);
  log(`dump: wrote ${files.length} file(s) to ${outDir}`);
  return files;
}
