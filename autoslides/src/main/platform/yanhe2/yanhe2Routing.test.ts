// A guard, not a behaviour test: Yanhe 2.0 code must not open its own
// connections. Everything it requests goes through the intranet route
// (`getYanhe2Json` for JSON, `getAlongRoute` / the intranet transport for
// media and files), so a student on campus gets the intranet address and
// everyone else gets the public host. A bare `fetch` or `axios` call would
// work in testing and quietly skip all of that.
//
// Campus sign-in is out of scope on purpose: its Yanhe 2.0 leg runs on
// CasTransport and is not routed.
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const MAIN = path.resolve(__dirname, '../..');

function yanhe2Sources(dir: string, found: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) yanhe2Sources(full, found);
    else if (/\.ts$/.test(entry.name) && !/\.test\.ts$/.test(entry.name) && /yanhe2/i.test(full)) found.push(full);
  }
  return found;
}

/** The one place allowed to name `axios.request`: the default sender that main replaces at startup. */
const ALLOWED = new Set([path.join(MAIN, 'platform/yanhe2/yanhe2Http.ts')]);

describe('Yanhe 2.0 requests', () => {
  it('never bypass the intranet route', () => {
    const offenders: string[] = [];
    for (const file of yanhe2Sources(MAIN)) {
      const code = fs.readFileSync(file, 'utf8').replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '');
      const direct = /\bfetch\s*\(|\baxios\s*(\.\s*(get|post|put|delete|request|create)\s*)?\(|\bhttps?\.(request|get)\s*\(/.test(code);
      if (direct && !ALLOWED.has(file)) offenders.push(path.relative(MAIN, file));
    }
    expect(offenders, 'use getYanhe2Json or getAlongRoute; see .claude/rules/yanhe2.md').toEqual([]);
  });

  it('finds the files it is meant to guard', () => {
    const names = yanhe2Sources(MAIN).map((f) => path.basename(f));
    expect(names).toEqual(expect.arrayContaining(['yanhe2Http.ts', 'yanhe2Api.ts', 'yanhe2Play.ts', 'yanhe2Service.ts']));
  });
});
