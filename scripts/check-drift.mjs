#!/usr/bin/env node
/**
 * Drift check for the deliberate copies between packages.
 *
 * Every package deploys on its own (a third-party clone of `web/` or `share/`
 * must stay self-contained), so no package imports another package's source.
 * Code that must behave the same in two places is copied instead, and this
 * script keeps the copies honest. Two kinds:
 *
 * GROUPS: copies adapted per runtime (not byte-identical). Each group lists
 * its sides; a side is the file or files that hold the logic in one package.
 * The script records a hash of every file in `drift-manifest.json` and fails
 * when some sides changed since the manifest was stamped and others did not.
 * A side counts as changed when any of its files changed.
 *
 * IDENTICAL: files that must match their source byte for byte. Edit the source,
 * then copy it over. These need no manifest.
 *
 *   node scripts/check-drift.mjs            # verify (CI)
 *   node scripts/check-drift.mjs --update   # re-stamp after porting (or after
 *                                           # consciously deciding not to)
 *
 * Re-stamp only after you have looked at the other sides. A side lists only
 * the files that hold the copied logic, so unrelated edits elsewhere do not
 * raise false alarms.
 */
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const manifestPath = join(root, 'scripts', 'drift-manifest.json');
const update = process.argv.includes('--update');

/** Two-sided desktop ↔ web pair, the common case. */
const pair = (name, desktop, web) => ({ name, sides: [[desktop], [web]] });

const GROUPS = [
  {
    name: 'shareLink',
    sides: [
      ['autoslides/src/shared/shareLink.ts'],
      ['web/frontend/src/lib/notes/shareLink.ts'],
      ['share/src/lib/shareLink.ts'],
    ],
  },
  {
    // The web's encode side lives inside its shareLink.ts.
    name: 'shareTimeline',
    sides: [
      ['autoslides/src/shared/shareTimeline.ts', 'autoslides/src/shared/sidecars/timeline/types.ts'],
      ['web/frontend/src/lib/notes/shareLink.ts'],
      ['share/src/lib/shareTimeline.ts'],
    ],
  },
  {
    name: 'shareResolve',
    sides: [
      ['autoslides/src/shared/shareResolve.ts'],
      ['web/frontend/src/lib/notes/shareResolve.ts'],
      ['share/src/lib/shareResolve.ts'],
    ],
  },
  { name: 'academicTerm', sides: [['autoslides/src/shared/academicTerm.ts'], ['share/src/lib/term.ts']] },
  pair('notesContent', 'autoslides/src/shared/notesContent.ts', 'web/frontend/src/lib/notes/notesContent.ts'),
  pair('notesTypes', 'autoslides/src/shared/notesTypes.ts', 'web/frontend/src/lib/notes/notesTypes.ts'),
  pair('sanitizeFileName', 'autoslides/src/shared/sanitizeFileName.ts', 'web/frontend/src/lib/sanitizeFileName.ts'),
  // The desktop's slideMetadataTypes.ts is only a re-export of this file.
  pair('slideMetadataTypes', 'autoslides/src/shared/sidecars/metadata/types.ts', 'web/frontend/src/lib/slideMetadataTypes.ts'),
  pair('watchProgress', 'autoslides/src/shared/watchProgress.ts', 'web/frontend/src/lib/watchProgress.ts'),
  pair('changeDetection', 'autoslides/src/renderer/shared/processing/changeDetection.ts', 'web/frontend/src/lib/processing/changeDetection.ts'),
  pair('intervalTable', 'autoslides/src/renderer/shared/processing/intervalTable.ts', 'web/frontend/src/lib/processing/intervalTable.ts'),
  pair('phase1Duplicates', 'autoslides/src/renderer/shared/postProcessing/phase1Duplicates.ts', 'web/frontend/src/lib/postProcessing/phase1Duplicates.ts'),
  pair('phase2Exclusion', 'autoslides/src/renderer/shared/postProcessing/phase2Exclusion.ts', 'web/frontend/src/lib/postProcessing/phase2Exclusion.ts'),
  pair('phase3AI', 'autoslides/src/renderer/shared/postProcessing/phase3AI.ts', 'web/frontend/src/lib/postProcessing/phase3AI.ts'),
  pair('postCropDedup', 'autoslides/src/renderer/shared/postProcessing/postCropDedup.ts', 'web/frontend/src/lib/postProcessing/postCropDedup.ts'),
  pair('postProcessorWorker', 'autoslides/src/renderer/shared/workers/postProcessor.worker.ts', 'web/frontend/src/workers/postProcessor.worker.ts'),
  pair('displayNames', 'autoslides/src/renderer/shared/i18n/displayNames.ts', 'web/frontend/src/i18n/displayNames.ts'),
  pair('videoErrorRecovery', 'autoslides/src/renderer/features/video/useVideoErrorRecovery.ts', 'web/frontend/src/composables/video/useVideoErrorRecovery.ts'),
  pair('requestCache', 'autoslides/src/renderer/shared/services/requestCache.ts', 'web/frontend/src/lib/requestCache.ts'),
  // The app's local search matches and orders like the online Index.
  pair('courseIndexSearch', 'autoslides/src/main/platform/courseIndex/localSearch.ts', 'share/src/api/searchRank.ts'),
  {
    // The signing code only. share/ and indexer/ send just the finished
    // client signature as hardcoded hex, pinned by golden-vector tests.
    name: 'yanhektCrypto',
    sides: [['autoslides/src/shared/crypto.ts'], ['web/src/lib/yanhektSignature.ts'], ['relay/src/yanhekt.ts']],
  },
];

/** [source, copy]: the copy must be byte-identical to the source. */
const IDENTICAL = [
  // The share Worker's search must split text exactly as the indexer wrote it.
  ['indexer/src/grams.ts', 'share/src/indexer/grams.ts'],
  // The share tests seed D1 through the indexer's own upload statements.
  ['indexer/src/d1model.ts', 'share/src/indexer/d1model.ts'],
  ['indexer/src/sql.ts', 'share/src/indexer/sql.ts'],
  // The app opens the release files the indexer seals and signs.
  ['indexer/src/seal.ts', 'autoslides/src/main/platform/courseIndex/seal.ts'],
  ['indexer/src/clientIndex.ts', 'autoslides/src/main/platform/courseIndex/clientIndex.ts'],
  // The app searches its local copy with the same word splitting as the Index.
  ['indexer/src/grams.ts', 'autoslides/src/main/platform/courseIndex/grams.ts'],
];

function read(path) {
  const full = join(root, path);
  if (!existsSync(full)) {
    console.error(`drift: missing file ${path} — update scripts/check-drift.mjs`);
    process.exit(2);
  }
  return readFileSync(full);
}

const sha256 = (path) => createHash('sha256').update(read(path)).digest('hex');

let failed = false;
let groupFailed = false;

for (const [source, copy] of IDENTICAL) {
  if (!read(source).equals(read(copy))) {
    failed = true;
    console.error(`drift: ${copy} differs from ${source} — edit the source, then copy it over`);
  }
}

const current = {};
for (const group of GROUPS) {
  for (const file of group.sides.flat()) current[file] = sha256(file);
}

if (update) {
  if (failed) process.exit(1);
  writeFileSync(manifestPath, JSON.stringify({ hashes: current }, null, 2) + '\n');
  console.log(`drift: manifest re-stamped (${Object.keys(current).length} files)`);
  process.exit(0);
}

if (!existsSync(manifestPath)) {
  console.error('drift: scripts/drift-manifest.json missing — run `node scripts/check-drift.mjs --update`');
  process.exit(2);
}

const recorded = JSON.parse(readFileSync(manifestPath, 'utf8')).hashes ?? {};
for (const group of GROUPS) {
  const changed = group.sides.map((side) => side.some((f) => recorded[f] !== current[f]));
  const count = changed.filter(Boolean).length;
  if (count === 0 || count === group.sides.length) continue;
  failed = true;
  groupFailed = true;
  console.error(`drift: group "${group.name}" is out of sync`);
  group.sides.forEach((side, i) => {
    const label = changed[i] ? 'changed  ' : 'untouched';
    for (const f of side) console.error(`  ${label}: ${f}`);
  });
}

if (groupFailed) {
  console.error('\nPort the change to the other side, or if the divergence is intentional run:\n  node scripts/check-drift.mjs --update');
}
if (failed) process.exit(1);
console.log(`drift: ${GROUPS.length} groups and ${IDENTICAL.length} identical copies in sync`);
