// The agent skill for the command line (repo `skills/autoslides-cli`) ships
// inside the app, so it always matches the commands of the release it came with.
//
// Agents are never pointed into the app itself: an AppImage's resources live in
// a temporary mount, and a translocated macOS app gets a random path, both new
// on every launch. Instead the app keeps a copy at a fixed path under userData
// and refreshes it on every launch, so an agent that links to it follows app
// updates. A dev build points at the repo folder instead (it shares userData
// with the installed app, which would otherwise overwrite each other's copy).
// The paths are `CliInstallService`'s; this file only copies and compares.
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

export const SKILL_NAME = 'autoslides-cli';

/** Files that never belong to the skill (Finder writes them into the repo folder). */
const SKIPPED = new Set(['.DS_Store', 'Thumbs.db']);

function listFiles(dir: string, prefix = ''): string[] {
  const files: string[] = [];
  for (const entry of fs.readdirSync(path.join(dir, prefix), { withFileTypes: true })) {
    if (SKIPPED.has(entry.name)) continue;
    const relative = path.join(prefix, entry.name);
    if (entry.isDirectory()) files.push(...listFiles(dir, relative));
    else if (entry.isFile()) files.push(relative);
  }
  return files.sort();
}

/** One hash over every file's relative path and bytes; null when the folder is missing. */
export function skillDigest(dir: string): string | null {
  if (!fs.existsSync(path.join(dir, 'SKILL.md'))) return null;
  const hash = createHash('sha256');
  for (const file of listFiles(dir)) {
    hash.update(file.split(path.sep).join('/')).update('\0').update(fs.readFileSync(path.join(dir, file))).update('\0');
  }
  return hash.digest('hex');
}

export type SkillSync = 'copied' | 'current' | 'missing';

/**
 * Make `target` an exact copy of `source`. Only rewrites it when something
 * differs. The new copy is built complete beside the old one, the old one is
 * moved aside, the new one renamed in, and only then is the old one deleted;
 * a failed rename puts the old one back. A link to `target` sees the old or
 * the new skill, never half of one, and at worst finds it missing for the
 * instant between the two renames. A copy left aside by a crash is put back
 * (or cleaned up) on the next run.
 */
export function syncSkill(source: string, target: string): SkillSync {
  const wanted = skillDigest(source);
  if (wanted === null) return 'missing';
  if (source === target) return 'current';

  const previous = `${target}.previous`;
  if (fs.existsSync(previous)) {
    if (fs.existsSync(target)) fs.rmSync(previous, { recursive: true, force: true });
    else fs.renameSync(previous, target);
  }
  if (skillDigest(target) === wanted) return 'current';

  const staging = `${target}.staging-${process.pid}`;
  fs.rmSync(staging, { recursive: true, force: true });
  fs.mkdirSync(path.dirname(target), { recursive: true });
  try {
    fs.cpSync(source, staging, { recursive: true, filter: (from) => !SKIPPED.has(path.basename(from)) });
    const hadTarget = fs.existsSync(target);
    if (hadTarget) fs.renameSync(target, previous);
    try {
      fs.renameSync(staging, target);
    } catch (error) {
      if (hadTarget) fs.renameSync(previous, target);
      throw error;
    }
  } finally {
    fs.rmSync(staging, { recursive: true, force: true });
  }
  fs.rmSync(previous, { recursive: true, force: true });
  return 'copied';
}
