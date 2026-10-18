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
 * differs, and swaps the whole folder in at once, so a link to `target` never
 * sees half of an update.
 */
export function syncSkill(source: string, target: string): SkillSync {
  const wanted = skillDigest(source);
  if (wanted === null) return 'missing';
  if (source === target || skillDigest(target) === wanted) return 'current';

  const staging = `${target}.staging-${process.pid}`;
  fs.rmSync(staging, { recursive: true, force: true });
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.cpSync(source, staging, { recursive: true, filter: (from) => !SKIPPED.has(path.basename(from)) });
  fs.rmSync(target, { recursive: true, force: true });
  fs.renameSync(staging, target);
  return 'copied';
}
