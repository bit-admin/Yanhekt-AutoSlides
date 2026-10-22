/**
 * D1 through the wrangler CLI instead of the HTTP API: for a machine that is
 * logged in with `wrangler login` but has no API token. Slower (one wrangler
 * process per request) but uses wrangler's own credentials.
 *
 *   single statement  → wrangler d1 execute <db> --remote --json --command <sql>   (returns rows)
 *   batch             → wrangler d1 execute <db> --remote --json --file <tmp.sql>  (no rows needed)
 */

import { execFile } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { D1Exec } from './remote.ts';

type Result = { results?: Array<Record<string, unknown>>; success?: boolean };

export class WranglerD1 implements D1Exec {
  private readonly dir = mkdtempSync(join(tmpdir(), 'indexer-d1-'));
  private n = 0;
  private readonly database: string;
  private readonly cwd: string;

  /** `cwd`: a directory where `npx wrangler` resolves (e.g. ../share). */
  constructor(database: string, cwd: string) {
    this.database = database;
    this.cwd = cwd;
  }

  private run(args: string[]): Promise<string> {
    return new Promise((resolve, reject) => {
      execFile(
        'npx',
        ['wrangler', 'd1', 'execute', this.database, '--remote', '--json', '--yes', ...args],
        { cwd: this.cwd, maxBuffer: 256 * 1024 * 1024, env: { ...process.env, CI: '1' } },
        (err, stdout, stderr) => {
          if (err) reject(new Error(`wrangler: ${pickError(stdout) ?? stderr.trim().split('\n').slice(-3).join(' ') ?? err.message}`));
          else resolve(stdout);
        },
      );
    });
  }

  async exec(sqls: string[]): Promise<Result[]> {
    if (sqls.length === 1) {
      const out = parse(await this.run(['--command', sqls[0]]));
      return Array.isArray(out) ? (out as Result[]) : [{ success: true }];
    }
    const file = join(this.dir, `batch-${++this.n}.sql`);
    writeFileSync(file, sqls.map((s) => s.trim().replace(/;?$/, ';')).join('\n'));
    try {
      await this.run(['--file', file]);
    } finally {
      rmSync(file, { force: true });
    }
    return sqls.map(() => ({ success: true }));
  }

  close(): void {
    rmSync(this.dir, { recursive: true, force: true });
  }
}

function parse(stdout: string): unknown {
  const start = stdout.search(/[[{]/);
  return start < 0 ? null : JSON.parse(stdout.slice(start));
}

function pickError(stdout: string): string | null {
  try {
    const v = parse(stdout) as { error?: { text?: string; notes?: Array<{ text?: string }> } } | null;
    if (!v?.error) return null;
    return [v.error.text, ...(v.error.notes ?? []).map((x) => x.text)].filter(Boolean).join(' ');
  } catch {
    return null;
  }
}
