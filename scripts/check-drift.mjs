#!/usr/bin/env node
/**
 * Electron ↔ web drift check.
 *
 * `web/frontend` is an isolated Vite app (a third-party clone of `web/` must
 * stay self-contained), so the files below are deliberate *copies* of their
 * Electron counterparts, adapted per runtime — not byte-identical, and never
 * imported across the boundary. The cost is that an algorithm fix on one side
 * silently rots the other. This script records a hash of every file in each
 * group in `drift-manifest.json` and fails when only some members of a group
 * changed since the manifest was stamped.
 *
 *   node scripts/check-drift.mjs            # verify (CI)
 *   node scripts/check-drift.mjs --update   # re-stamp after porting (or after
 *                                           # consciously deciding not to)
 *
 * A group is "in sync" when either no member changed or every member changed.
 * Re-stamp only after you have looked at the other side.
 */
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const manifestPath = join(root, 'scripts', 'drift-manifest.json');
const update = process.argv.includes('--update');

const GROUPS = [
  { name: 'shareLink', files: ['autoslides/src/shared/shareLink.ts', 'web/frontend/src/lib/notes/shareLink.ts'] },
  { name: 'notesContent', files: ['autoslides/src/shared/notesContent.ts', 'web/frontend/src/lib/notes/notesContent.ts'] },
  { name: 'notesTypes', files: ['autoslides/src/shared/notesTypes.ts', 'web/frontend/src/lib/notes/notesTypes.ts'] },
  { name: 'sanitizeFileName', files: ['autoslides/src/shared/sanitizeFileName.ts', 'web/frontend/src/lib/sanitizeFileName.ts'] },
  { name: 'slideMetadataTypes', files: ['autoslides/src/shared/slideMetadataTypes.ts', 'web/frontend/src/lib/slideMetadataTypes.ts'] },
  { name: 'changeDetection', files: ['autoslides/src/renderer/shared/processing/changeDetection.ts', 'web/frontend/src/lib/processing/changeDetection.ts'] },
  { name: 'phase1Duplicates', files: ['autoslides/src/renderer/shared/postProcessing/phase1Duplicates.ts', 'web/frontend/src/lib/postProcessing/phase1Duplicates.ts'] },
  { name: 'phase2Exclusion', files: ['autoslides/src/renderer/shared/postProcessing/phase2Exclusion.ts', 'web/frontend/src/lib/postProcessing/phase2Exclusion.ts'] },
  { name: 'phase3AI', files: ['autoslides/src/renderer/shared/postProcessing/phase3AI.ts', 'web/frontend/src/lib/postProcessing/phase3AI.ts'] },
  { name: 'postCropDedup', files: ['autoslides/src/renderer/shared/postProcessing/postCropDedup.ts', 'web/frontend/src/lib/postProcessing/postCropDedup.ts'] },
  {
    name: 'yanhektCrypto',
    files: ['autoslides/src/shared/crypto.ts', 'web/src/lib/yanhekt.ts', 'relay/src/yanhekt.ts', 'share/src/lib/yanhekt.ts'],
  },
];

function sha256(path) {
  return createHash('sha256').update(readFileSync(join(root, path))).digest('hex');
}

const current = {};
for (const group of GROUPS) {
  for (const file of group.files) {
    if (!existsSync(join(root, file))) {
      console.error(`drift: missing file ${file} (group ${group.name}) — update GROUPS in scripts/check-drift.mjs`);
      process.exit(2);
    }
    current[file] = sha256(file);
  }
}

if (update) {
  writeFileSync(manifestPath, JSON.stringify({ hashes: current }, null, 2) + '\n');
  console.log(`drift: manifest re-stamped (${Object.keys(current).length} files)`);
  process.exit(0);
}

if (!existsSync(manifestPath)) {
  console.error('drift: scripts/drift-manifest.json missing — run `node scripts/check-drift.mjs --update`');
  process.exit(2);
}

const recorded = JSON.parse(readFileSync(manifestPath, 'utf8')).hashes ?? {};
let failed = false;
for (const group of GROUPS) {
  const changed = group.files.filter((f) => recorded[f] !== current[f]);
  if (changed.length === 0 || changed.length === group.files.length) continue;
  failed = true;
  const stale = group.files.filter((f) => !changed.includes(f));
  console.error(`drift: group "${group.name}" is out of sync`);
  for (const f of changed) console.error(`  changed : ${f}`);
  for (const f of stale) console.error(`  untouched: ${f}`);
}

if (failed) {
  console.error('\nPort the change to the other side, or if the divergence is intentional run:\n  node scripts/check-drift.mjs --update');
  process.exit(1);
}
console.log(`drift: ${GROUPS.length} groups in sync`);
