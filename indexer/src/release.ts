/**
 * The GitHub release that holds the index: a pre-release under a fixed tag
 * (default `index`). It must stay a pre-release: the desktop app's update
 * check reads `releases/latest`, which skips pre-releases. Tags starting with
 * `v` would also trigger release.yml.
 *
 * Assets, all gzip + encrypted (seal.ts):
 *   manifest.json.gz.enc                         private passphrase; fixed name, replaced last but one
 *   yanhekt-index.<UTC stamp>.db.gz.enc          private passphrase; the full SQLite database (the master copy)
 *   client-manifest.json                         signed envelope around the client manifest (clientIndex.ts), replaced last
 *   term-<term>.<sha256:12>.<pid>.json.gz.enc    client passphrase; one per term (export.ts), a new name only when it changed
 * The manifests name the current files. A push uploads new files first, then
 * the manifests, then deletes files neither names (keeping the previous
 * database as a fallback), so a reader never meets a missing file.
 *
 * Two passphrases: the app carries the client one, so anyone can dig it out;
 * it opens only the term files. The database (every field, video URLs, upload
 * bookkeeping) stays under the private one.
 */

import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync, existsSync, unlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { createHash, createPublicKey } from 'node:crypto';
import type { KeyObject } from 'node:crypto';
import {
  CLIENT_MANIFEST_ASSET, CLIENT_MANIFEST_FORMAT, keyIdOf, makeEnvelope, openEnvelope, parseClientManifest,
  sha256Hex, termAssetName,
} from './clientIndex.ts';
import type { ClientManifest, ClientTerm, SigningKey } from './clientIndex.ts';
import { exportTerms, EXPORT_FORMAT } from './export.ts';
import { passphraseId, seal, unseal, unsealAsync } from './seal.ts';

export const DEFAULT_TAG = 'index';
export const MANIFEST_ASSET = 'manifest.json.gz.enc';

export interface Manifest {
  format: number;
  generatedAt: string;
  minTerm: string;
  db: { asset: string; sha256: string; bytes: number; sessions: number; courses: number };
  previousDb: string | null;
  /** The same entries as the client manifest (older manifests lack bytes and assetSha256). */
  terms: ClientTerm[];
}

/** What a push needs: both passphrases and the manifest signing key. */
export interface ReleaseKeys {
  passphrase: string;
  clientPassphrase: string;
  signingKey: KeyObject;
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
  keys: ReleaseKeys,
  minTerm: string,
  log: Log,
  nowMs: number = Date.now(),
): Manifest {
  const { passphrase, clientPassphrase, signingKey } = keys;
  if (passphrase === clientPassphrase) throw new Error('the client passphrase must differ from the private one');
  const pid = passphraseId(clientPassphrase);
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

    const termEntries: ClientTerm[] = [];
    for (const t of terms) {
      const asset = termAssetName(t.term, t.sha256, pid);
      const before = old?.terms.find((e) => e.asset === asset && e.assetSha256);
      let sealed: { bytes: number; assetSha256: string };
      if (assets.includes(asset) && before) {
        sealed = { bytes: before.bytes, assetSha256: before.assetSha256 };
      } else {
        const bytes = seal(t.json, clientPassphrase);
        upload(asset, bytes);
        sealed = { bytes: bytes.length, assetSha256: sha256Hex(bytes) };
        log(`uploaded ${asset} (${t.courses} courses, ${t.sessions} sessions)`);
      }
      termEntries.push({ term: t.term, asset, ...sealed, sha256: t.sha256, courses: t.courses, sessions: t.sessions });
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

    const client: ClientManifest = {
      format: CLIENT_MANIFEST_FORMAT,
      generatedAt: manifest.generatedAt,
      passphraseId: pid,
      terms: termEntries,
    };
    const envelope = makeEnvelope(CLIENT_MANIFEST_ASSET, seal(Buffer.from(JSON.stringify(client, null, 1)), clientPassphrase), pid, signingKey);
    const publicKey = createPublicKey(signingKey);
    const self: SigningKey = { id: keyIdOf(publicKey), publicKey: publicKey.export({ format: 'pem', type: 'spki' }).toString() };
    if (!openEnvelope(envelope, CLIENT_MANIFEST_ASSET, [self]).ok) throw new Error('client manifest failed its own signature check');
    upload(CLIENT_MANIFEST_ASSET, Buffer.from(envelope));
    log(`client manifest updated (signing key ${self.id}, passphrase ${pid})`);

    const keep = new Set([MANIFEST_ASSET, CLIENT_MANIFEST_ASSET, dbAsset, ...termEntries.map((t) => t.asset)]);
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

/** The term in progress on `nowMs`, Beijing time: autumn from August through January, spring from February. */
export function currentTerm(nowMs: number = Date.now()): string {
  const d = new Date(nowMs + 8 * 3600_000);
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth() + 1;
  if (m >= 8) return `${y}-${y + 1}-1`;
  if (m === 1) return `${y - 1}-${y}-1`;
  return `${y - 1}-${y}-2`;
}

export interface BundleOptions {
  clientPassphrase: string;
  /** Public keys the app accepts (its indexSigningKeys.json). */
  keys: SigningKey[];
  /** Terms before this one go into the bundle. */
  before: string;
}

/**
 * Fill `outDir` with what the app ships: the client manifest envelope as
 * published and the sealed term files before `opts.before`, each checked
 * against the manifest and opened once with the client passphrase. Files
 * already there with the right hash are kept; other term files are removed.
 */
export async function bundleRelease(tag: string, outDir: string, opts: BundleOptions, log: Log): Promise<ClientTerm[]> {
  const assets = assetsOf(tag);
  if (!assets) throw new NoRelease(`no release with tag "${tag}"`);
  if (!assets.includes(CLIENT_MANIFEST_ASSET)) throw new NoRelease(`release "${tag}" has no ${CLIENT_MANIFEST_ASSET}`);
  const dir = mkdtempSync(join(tmpdir(), 'yhi-bundle-'));
  try {
    const text = download(tag, CLIENT_MANIFEST_ASSET, dir).toString('utf8');
    const opened = openEnvelope(text, CLIENT_MANIFEST_ASSET, opts.keys);
    if (!opened.ok) throw new Error(`${CLIENT_MANIFEST_ASSET}: signature check failed (${opened.reason})`);
    if (opened.passphraseId !== passphraseId(opts.clientPassphrase)) {
      throw new Error(`the release is sealed with client passphrase ${opened.passphraseId}, not the one given (${passphraseId(opts.clientPassphrase)})`);
    }
    const manifest = parseClientManifest(await unsealAsync(opened.data, opts.clientPassphrase));
    const chosen = manifest.terms.filter((t) => t.term < opts.before).sort((a, b) => a.term.localeCompare(b.term));
    log(`release ${tag}: client manifest from ${manifest.generatedAt} (key ${opened.keyId}); bundling ${chosen.length} terms before ${opts.before}`);

    mkdirSync(outDir, { recursive: true });
    for (const t of chosen) {
      const target = join(outDir, t.asset);
      if (existsSync(target) && sha256Hex(readFileSync(target)) === t.assetSha256) {
        log(`${t.term}: ${t.asset} already there`);
        continue;
      }
      const bytes = download(tag, t.asset, dir);
      if (bytes.length !== t.bytes || sha256Hex(bytes) !== t.assetSha256) throw new Error(`${t.asset}: checksum mismatch`);
      if (sha256Hex(await unsealAsync(bytes, opts.clientPassphrase)) !== t.sha256) throw new Error(`${t.asset}: content checksum mismatch`);
      writeFileSync(target, bytes);
      log(`${t.term}: ${t.asset} (${t.courses} courses, ${t.sessions} sessions)`);
    }
    writeFileSync(join(outDir, CLIENT_MANIFEST_ASSET), text);
    const keep = new Set(chosen.map((t) => t.asset));
    for (const name of readdirSync(outDir)) {
      if (/^term-.*\.json\.gz\.enc$/.test(name) && !keep.has(name)) {
        unlinkSync(join(outDir, name));
        log(`removed old ${name}`);
      }
    }
    return chosen;
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
