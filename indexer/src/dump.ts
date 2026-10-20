/**
 * `dump` command: the database as plain SQL for Cloudflare D1.
 *
 * D1 is SQLite, so the schema is reused unchanged. Output is split into
 * files of at most `maxBytes`; apply them in name order with
 *   npx wrangler d1 execute <db> --remote --file=<file>
 * D1 rejects BEGIN/COMMIT in imported files, so none are written.
 */

import { mkdirSync, openSync, writeSync, closeSync } from 'node:fs';
import { join } from 'node:path';
import type { DatabaseSync } from 'node:sqlite';
import { DUMP_TABLES, SCHEMA_SQL } from './schema.ts';

export function sqlLiteral(v: unknown): string {
  if (v === null || v === undefined) return 'NULL';
  if (typeof v === 'number' || typeof v === 'bigint') return String(v);
  if (v instanceof Uint8Array) return `X'${Buffer.from(v).toString('hex')}'`;
  return `'${String(v).replaceAll("'", "''")}'`;
}

export function dumpForD1(db: DatabaseSync, outDir: string, maxBytes: number, log: (m: string) => void): void {
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

  write(`${SCHEMA_SQL.trim()}\n`);
  for (const table of DUMP_TABLES) {
    let rows = 0;
    for (const row of db.prepare(`SELECT * FROM ${table}`).iterate() as Iterable<Record<string, unknown>>) {
      const cols = Object.keys(row);
      write(
        `INSERT OR REPLACE INTO ${table} (${cols.map((c) => `"${c}"`).join(', ')}) VALUES (${cols
          .map((c) => sqlLiteral(row[c]))
          .join(', ')});\n`,
      );
      rows += 1;
    }
    log(`dump: ${table}: ${rows} rows`);
  }
  if (fd >= 0) closeSync(fd);
  log(`dump: wrote ${files.length} file(s) to ${outDir}`);
  log(`apply in order: for f in ${outDir}/*.sql; do npx wrangler d1 execute <db> --remote --file="$f"; done`);
}
