// Runs scripts/check-boundaries.mjs on small made-up trees: each case is an
// import ESLint's literal-spelling rules would or would not catch.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

const SCRIPT = path.join(__dirname, 'check-boundaries.mjs');
const ESLINT = `
const FEATURE_DOMAINS = ['video', 'course', 'lectures'];
featureBoundaryRule('video', ['course'])
featureBoundaryRule('course')
featureBoundaryRule('lectures', ['course', 'video'])
`;

let root: string;
afterEach(() => fs.rmSync(root, { recursive: true, force: true }));

function tree(files: Record<string, string>): { ok: boolean; output: string } {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'as-bounds-'));
  fs.writeFileSync(path.join(root, 'eslint.config.mjs'), ESLINT);
  const all: Record<string, string> = {
    'src/renderer/features/video/a.ts': 'export const a = 1;',
    'src/renderer/features/course/b.ts': 'export const b = 1;',
    'src/renderer/features/lectures/c.ts': 'export const c = 1;',
    ...files,
  };
  for (const [file, text] of Object.entries(all)) {
    fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
    fs.writeFileSync(path.join(root, file), text);
  }
  try {
    return { ok: true, output: execFileSync('node', [SCRIPT, '--root', root], { encoding: 'utf8', stdio: 'pipe' }) };
  } catch (error) {
    return { ok: false, output: String((error as { stderr?: string }).stderr ?? error) };
  }
}

describe('check-boundaries', () => {
  it('passes whitelisted edges, by alias or relative path', () => {
    const result = tree({
      'src/renderer/features/video/x.ts': "import { b } from '@features/course/b';\nimport { b as c } from '../course/b';",
    });
    expect(result.ok, result.output).toBe(true);
  });

  it('catches a relative import into a sibling domain', () => {
    const result = tree({ 'src/renderer/features/course/x.ts': "import { a } from '../video/a';" });
    expect(result.ok).toBe(false);
    expect(result.output).toContain("feature domain 'course' may not import from 'video'");
  });

  it('reads .vue scripts', () => {
    const result = tree({
      'src/renderer/features/course/View.vue': '<template><div/></template>\n<script setup lang="ts">\nimport { a } from \'@features/video/a\'\n</script>',
    });
    expect(result.ok).toBe(false);
    expect(result.output).toContain('View.vue');
  });

  it('catches re-exports and dynamic imports', () => {
    const result = tree({
      'src/renderer/features/course/r.ts': "export { a } from '@features/video/a';",
      'src/renderer/features/course/d.ts': "export const load = () => import('@features/video/a');",
    });
    expect(result.ok).toBe(false);
    expect(result.output).toContain('r.ts');
    expect(result.output).toContain('d.ts');
  });

  it('ignores imports inside comments', () => {
    const result = tree({ 'src/renderer/features/course/x.ts': "// import { a } from '@features/video/a';\nexport const x = 1;" });
    expect(result.ok, result.output).toBe(true);
  });

  it('keeps renderer shared/ off features/', () => {
    const result = tree({ 'src/renderer/shared/s.ts': "import { b } from '../features/course/b';" });
    expect(result.ok).toBe(false);
    expect(result.output).toContain('shared/ may not import from features/');
  });

  it('keeps main infra/ and sibling main domains apart', () => {
    const result = tree({
      'src/main/video/v.ts': 'export const v = 1;',
      'src/main/infra/i.ts': "import { v } from '@main/video/v';",
      'src/main/export/e.ts': "import { v } from '../video/v';",
      'src/main/ai/ok.ts': "import { p } from '@main/platform/p';",
      'src/main/platform/p.ts': 'export const p = 1;',
    });
    expect(result.ok).toBe(false);
    expect(result.output).toContain('main infra/ may not import from main video/');
    expect(result.output).toContain("main domain 'export' may not import from 'video'");
    expect(result.output).not.toContain('ok.ts');
  });

  it('bans a static import of demo code but not the guarded dynamic one', () => {
    const result = tree({
      'src/renderer/demo/seed.ts': 'export const seed = 1;',
      'src/renderer/features/video/s.ts': "import { seed } from '@renderer/demo/seed';",
      'src/renderer/features/video/g.ts': "export const g = () => import('@renderer/demo/seed');",
    });
    expect(result.ok).toBe(false);
    expect(result.output).toContain('s.ts');
    expect(result.output).not.toContain('g.ts');
  });

  it('fails a feature folder ESLint does not list', () => {
    const result = tree({ 'src/renderer/features/newDomain/n.ts': 'export const n = 1;' });
    expect(result.ok).toBe(false);
    expect(result.output).toContain('newDomain: not in FEATURE_DOMAINS');
  });
});
