/**
 * The GitHub release that holds the index: a pre-release under a fixed tag
 * (default `index`). It must stay a pre-release: the desktop app's update
 * check reads `releases/latest`, which skips pre-releases. Tags starting with
 * `v` would also trigger release.yml.
 *
 * Assets, all gzip + encrypted (seal.ts):
 *   manifest.json.gz.enc                    fixed name, replaced last
 *   yanhekt-index.<UTC stamp>.db.gz.enc     the full SQLite database (the master copy)
 *   term-<term>.<sha256:12>.json.gz.enc     one per term (export.ts); a new name only when it changed
 * The manifest names the current files. A push uploads new files first, then
 * the manifest, then deletes files the manifest no longer names (keeping the
 * previous database as a fallback), so a reader never meets a missing file.
 */

import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync, existsSync, unlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { createHash } from 'node:crypto';
import { exportTerms, EXPORT_FORMAT } from './export.ts';
import { seal, unseal } from './seal.ts';

export const DEFAULT_TAG = 'index';
export const MANIFEST_ASSET = 'manifest.json.gz.enc';

export interface Manifest {
  format: number;
  generatedAt: string;
  minTerm: string;
  db: { asset: string; sha256: string; bytes: number; sessions: number; courses: number };
  previousDb: string | null;
  terms: Array<{ term: string; asset: string; sha256: string; courses: number; sessions: number }>;
}

export class NoRelease extends Error {}

type Log = (msg: string) => void;

function gh(args: string[], opts: { input?: string } = {}): string {
  return execFileSync('gh', args, { encoding: 'utf8', input: opts.input, stdio: ['pipe', 'pipe', 'pipe'], maxBuffer: 64 * 1024 * 1024 });
}

function assetsOf(tag: string): string[] | null {
  try {
    const out = JSON.parse(gh(['release', 'view', tag, '--json', 'assets'])) as { assets: Array<{ name: string }> };
    return out.assets.map((a) => a.name);
  } catch (err) {
    const msg = String((err as { stderr?: string }).stderr ?? err);
    if (/release not found|not found/i.test(msg)) return null;
    throw err;
  }
}

function download(tag: string, asset: string, dir: string): Buffer {
  gh(['release', 'download', tag, '--pattern', asset, '--dir', dir, '--clobber']);
  return readFileSync(join(dir, asset));
}

export function termAssetName(term: string, sha256: string): string {
  return `term-${term}.${sha256.slice(0, 12)}.json.gz.enc`;
}

export function dbAssetName(nowMs: number): string {
  return `yanhekt-index.${new Date(nowMs).toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z')}.db.gz.enc`;
}

function readManifest(tag: string, dir: string, passphrase: string): Manifest {
  return JSON.parse(unseal(download(tag, MANIFEST_ASSET, dir), passphrase).toString('utf8')) as Manifest;
}

/** Download and decrypt the release's database to `dbPath` (which must not exist). */
export function pullRelease(tag: string, dbPath: string, passphrase: string, log: Log): Manifest {
  const assets = assetsOf(tag);
  if (!assets) throw new NoRelease(`no release with tag "${tag}"`);
  if (!assets.includes(MANIFEST_ASSET)) throw new NoRelease(`release "${tag}" has no ${MANIFEST_ASSET}`);
  const dir = mkdtempSync(join(tmpdir(), 'yhi-pull-'));
  try {
    const m = readManifest(tag, dir, passphrase);
    log(`release ${tag}: manifest from ${m.generatedAt}, database ${m.db.asset}`);
    const plain = unseal(download(tag, m.db.asset, dir), passphrase);
    const sha = createHash('sha256').update(plain).digest('hex');
    if (sha !== m.db.sha256) throw new Error(`${m.db.asset}: checksum mismatch`);
    for (const ext of ['', '-wal', '-shm']) if (existsSync(dbPath + ext)) throw new Error(`${dbPath + ext} already exists`);
    writeFileSync(dbPath, plain);
    log(`wrote ${dbPath} (${plain.length} bytes, ${m.db.sessions} sessions, ${m.db.courses} courses)`);
    return m;
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

/** Export, encrypt and upload the database and the term files; then switch the manifest. */
export function pushRelease(
  tag: string,
  dbPath: string,
  passphrase: string,
  minTerm: string,
  log: Log,
  nowMs: number = Date.now(),
): Manifest {
  // Fold the WAL into the file and read what the release needs.
  const db = new DatabaseSync(dbPath);
  let terms;
  let totals: { sessions: number; courses: number };
  try {
    db.exec('PRAGMA wal_checkpoint(TRUNCATE)');
    terms = exportTerms(db, minTerm);
    totals = db.prepare('SELECT (SELECT COUNT(*) FROM sessions) AS sessions, (SELECT COUNT(*) FROM courses) AS courses').get() as typeof totals;
  } finally {
    db.close();
  }

  let assets = assetsOf(tag);
  if (!assets) {
    gh([
      'release', 'create', tag, '--prerelease', '--latest=false', '--title', 'Yanhekt index',
      '--notes', 'Encrypted index data published by the Indexer workflow. Not an app release. See indexer/README.md.',
    ]);
    log(`created pre-release ${tag}`);
    assets = [];
  }

  const dir = mkdtempSync(join(tmpdir(), 'yhi-push-'));
  try {
    const old = assets.includes(MANIFEST_ASSET) ? readManifest(tag, dir, passphrase) : null;
    const upload = (name: string, bytes: Buffer) => {
      const f = join(dir, name);
      writeFileSync(f, bytes);
      gh(['release', 'upload', tag, f, '--clobber']);
      unlinkSync(f);
    };

    const plain = readFileSync(dbPath);
    const dbAsset = dbAssetName(nowMs);
    upload(dbAsset, seal(plain, passphrase));
    log(`uploaded ${dbAsset}`);

    const termEntries: Manifest['terms'] = [];
    for (const t of terms) {
      const asset = termAssetName(t.term, t.sha256);
      if (!assets.includes(asset)) {
        upload(asset, seal(t.json, passphrase));
        log(`uploaded ${asset} (${t.courses} courses, ${t.sessions} sessions)`);
      }
      termEntries.push({ term: t.term, asset, sha256: t.sha256, courses: t.courses, sessions: t.sessions });
    }

    const manifest: Manifest = {
      format: EXPORT_FORMAT,
      generatedAt: new Date(nowMs).toISOString(),
      minTerm,
      db: { asset: dbAsset, sha256: createHash('sha256').update(plain).digest('hex'), bytes: plain.length, ...totals },
      previousDb: old?.db.asset ?? null,
      terms: termEntries,
    };
    upload(MANIFEST_ASSET, seal(Buffer.from(JSON.stringify(manifest, null, 1)), passphrase));
    log(`manifest updated: ${termEntries.length} terms, ${totals.sessions} sessions, ${totals.courses} courses`);

    const keep = new Set([MANIFEST_ASSET, dbAsset, ...termEntries.map((t) => t.asset)]);
    if (manifest.previousDb) keep.add(manifest.previousDb);
    for (const name of assets) {
      if (keep.has(name)) continue;
      gh(['release', 'delete-asset', tag, name, '--yes']);
      log(`deleted old ${name}`);
    }
    return manifest;
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
