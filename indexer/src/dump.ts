/**
 * `dump` command: the D1 projection (d1model.ts) as plain SQL files, for
 *   npx wrangler d1 execute <db> [--local | --remote] --file=<file>
 * instead of `upload`. Statements are the same merge-upserts `upload` sends
 * (every course, with its grams), so dumps from several devices can be
 * applied in any order. With `reset`, the first file drops every D1 table
 * first. Dumping does not touch `upload`'s record of what was sent.
 * D1 rejects BEGIN/COMMIT in imported files, so none are written.
 */

import { closeSync, mkdirSync, openSync, writeSync } from 'node:fs';
import { join } from 'node:path';
import type { DatabaseSync } from 'node:sqlite';
import { courseStatements, D1_RESET_SQL, D1_SCHEMA_SQL, dataVersionStatement, localSessionsReader } from './d1model.ts';

export function dumpForD1(
  db: DatabaseSync,
  outDir: string,
  maxBytes: number,
  log: (m: string) => void,
  opts: { reset?: boolean } = {},
): string[] {
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

  if (opts.reset) write(`${D1_RESET_SQL.trim()}\n`);
  write(`${D1_SCHEMA_SQL.trim()}\n`);

  const sessionsOf = localSessionsReader(db);
  let courses = 0;
  for (const row of db.prepare('SELECT * FROM courses ORDER BY id').iterate() as Iterable<Record<string, unknown>>) {
    for (const stmt of courseStatements(row, sessionsOf(Number(row.id)))) write(`${stmt};\n`);
    courses += 1;
  }
  write(`${dataVersionStatement(Date.now())};\n`);
  if (fd >= 0) closeSync(fd);
  log(`dump: ${courses} courses in ${files.length} file(s) in ${outDir}`);
  return files;
}
