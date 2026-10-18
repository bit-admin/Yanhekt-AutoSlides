import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { skillDigest, syncSkill } from './skillBundle';

let root: string;
let source: string;
let target: string;

const write = (dir: string, file: string, text: string): void => {
  fs.mkdirSync(path.dirname(path.join(dir, file)), { recursive: true });
  fs.writeFileSync(path.join(dir, file), text);
};

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'as-skill-'));
  source = path.join(root, 'bundle', 'autoslides-cli');
  target = path.join(root, 'userData', 'skills', 'autoslides-cli');
  write(source, 'SKILL.md', '---\nname: autoslides-cli\n---\n');
  write(source, path.join('references', 'commands.md'), '# Commands\n');
});

afterEach(() => {
  fs.rmSync(root, { recursive: true, force: true });
});

describe('syncSkill', () => {
  it('copies the skill the first time, then leaves it alone', () => {
    expect(syncSkill(source, target)).toBe('copied');
    expect(fs.readFileSync(path.join(target, 'references', 'commands.md'), 'utf8')).toBe('# Commands\n');
    expect(syncSkill(source, target)).toBe('current');
  });

  it('replaces the whole copy when the app ships a different skill', () => {
    syncSkill(source, target);
    write(target, 'stale.md', 'from an older release');
    write(source, 'SKILL.md', '---\nname: autoslides-cli\n---\nnew\n');
    expect(syncSkill(source, target)).toBe('copied');
    expect(fs.readFileSync(path.join(target, 'SKILL.md'), 'utf8')).toContain('new');
    expect(fs.existsSync(path.join(target, 'stale.md'))).toBe(false);
    expect(fs.readdirSync(path.dirname(target))).toEqual(['autoslides-cli']);
  });

  it('keeps a link to the copy working across an update', () => {
    syncSkill(source, target);
    const link = path.join(root, 'agent', 'autoslides-cli');
    fs.mkdirSync(path.dirname(link));
    fs.symlinkSync(target, link, 'junction');
    write(source, 'SKILL.md', '---\nname: autoslides-cli\n---\nnewer\n');
    syncSkill(source, target);
    expect(fs.readFileSync(path.join(link, 'SKILL.md'), 'utf8')).toContain('newer');
  });

  it('ignores Finder litter in the bundle', () => {
    const before = skillDigest(source);
    write(source, '.DS_Store', 'x');
    expect(skillDigest(source)).toBe(before);
    syncSkill(source, target);
    expect(fs.existsSync(path.join(target, '.DS_Store'))).toBe(false);
  });

  it('reports a build without the skill and writes nothing', () => {
    expect(syncSkill(path.join(root, 'nowhere'), target)).toBe('missing');
    expect(fs.existsSync(target)).toBe(false);
  });

  it('treats the repo folder itself as current (dev builds)', () => {
    expect(syncSkill(source, source)).toBe('current');
  });
});
