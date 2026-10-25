/**
 * The course index files bundled with the app: earlier terms' courses with
 * their teachers, registrar code and lecture ids, from the indexer's `index`
 * pre-release (indexer/src/clientIndex.ts has the format).
 *
 * `npm run index-bundle` fills `vendor/course-index/` (git-ignored) with the
 * signed client manifest and the sealed term files before the current term;
 * the folder ships as an extraResource. Reading a term:
 *   1. the manifest envelope must carry a signature from indexSigningKeys.json;
 *   2. it must be sealed with the passphrase this build carries (clientKey.ts);
 *   3. each term file must match the manifest's hash before and after decrypting.
 * Anything else counts as no index; nothing here touches the network.
 *
 * Downloading newer files from the release is not built yet.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { app } from 'electron';
import { createLogger } from '@main/infra/logger';
import {
  CLIENT_MANIFEST_ASSET,
  openEnvelope,
  parseClientManifest,
  parseTermDoc,
  sha256Hex,
  type ClientManifest,
  type ClientTerm,
  type SigningKey,
  type TermCourse,
} from './clientIndex';
import { indexClientPassphrase } from './clientKey';
import { passphraseId, unsealAsync } from './seal';
import signingKeys from './indexSigningKeys.json';

const log = createLogger('CourseIndex');

export type { TermCourse };

/** Why there is no index. */
export type CourseIndexProblem =
  | 'no-key'            // this build carries no client passphrase
  | 'missing'           // no bundled manifest
  | 'bad-signature'     // manifest not signed by a known key
  | 'other-passphrase'  // sealed with a passphrase this build does not have
  | 'unreadable';       // could not decrypt or parse

export interface CourseIndexTerm {
  term: string;
  courses: number;
  sessions: number;
}

export type CourseIndexState =
  | { ok: true; generatedAt: string; terms: CourseIndexTerm[] }
  | { ok: false; problem: CourseIndexProblem; detail?: string };

interface Opened {
  manifest: ClientManifest;
  /** Terms whose files are present, by term key. */
  present: Map<string, ClientTerm>;
}

export interface CourseIndexOptions {
  dir: string;
  passphrase: string | null;
  keys?: SigningKey[];
}

export class CourseIndexBundle {
  private readonly dir: string;
  private readonly passphrase: string | null;
  private readonly keys: SigningKey[];
  private opening: Promise<Opened | { problem: CourseIndexProblem; detail?: string }> | null = null;
  private readonly terms = new Map<string, Promise<TermCourse[] | null>>();

  constructor(options: CourseIndexOptions) {
    this.dir = options.dir;
    this.passphrase = options.passphrase;
    this.keys = options.keys ?? signingKeys.keys;
  }

  /** What the bundle holds, or why there is nothing. Checked once. */
  async state(): Promise<CourseIndexState> {
    const opened = await this.open();
    if ('problem' in opened) return { ok: false, problem: opened.problem, detail: opened.detail };
    return {
      ok: true,
      generatedAt: opened.manifest.generatedAt,
      terms: [...opened.present.values()].map((t) => ({ term: t.term, courses: t.courses, sessions: t.sessions })),
    };
  }

  /** A bundled term's courses, sorted by id; null when the term is not bundled or its file fails a check. */
  term(term: string): Promise<TermCourse[] | null> {
    let pending = this.terms.get(term);
    if (!pending) {
      pending = this.readTerm(term);
      this.terms.set(term, pending);
    }
    return pending;
  }

  private open(): Promise<Opened | { problem: CourseIndexProblem; detail?: string }> {
    if (!this.opening) {
      this.opening = this.openOnce().then((result) => {
        if ('problem' in result) log.warn(`course index unavailable: ${result.problem}${result.detail ? ` (${result.detail})` : ''}`);
        else log.info(`course index from ${result.manifest.generatedAt}: ${[...result.present.keys()].join(', ') || 'no terms'}`);
        return result;
      });
    }
    return this.opening;
  }

  private async openOnce(): Promise<Opened | { problem: CourseIndexProblem; detail?: string }> {
    if (!this.passphrase) return { problem: 'no-key' };
    let text: string;
    try {
      text = await fs.readFile(path.join(this.dir, CLIENT_MANIFEST_ASSET), 'utf8');
    } catch {
      return { problem: 'missing' };
    }
    const envelope = openEnvelope(text, CLIENT_MANIFEST_ASSET, this.keys);
    if (!envelope.ok) return { problem: 'bad-signature', detail: envelope.reason };
    if (envelope.passphraseId !== passphraseId(this.passphrase)) {
      return { problem: 'other-passphrase', detail: envelope.passphraseId };
    }
    let manifest: ClientManifest;
    try {
      manifest = parseClientManifest(await unsealAsync(envelope.data, this.passphrase));
    } catch (error) {
      return { problem: 'unreadable', detail: error instanceof Error ? error.message : String(error) };
    }
    const present = new Map<string, ClientTerm>();
    for (const t of [...manifest.terms].sort((a, b) => b.term.localeCompare(a.term))) {
      try {
        await fs.access(path.join(this.dir, t.asset));
        present.set(t.term, t);
      } catch {
        // Not bundled (the current term never is).
      }
    }
    return { manifest, present };
  }

  private async readTerm(term: string): Promise<TermCourse[] | null> {
    const opened = await this.open();
    if ('problem' in opened || !this.passphrase) return null;
    const entry = opened.present.get(term);
    if (!entry) return null;
    try {
      const sealed = await fs.readFile(path.join(this.dir, entry.asset));
      if (sealed.length !== entry.bytes || sha256Hex(sealed) !== entry.assetSha256) throw new Error('file checksum mismatch');
      const json = await unsealAsync(sealed, this.passphrase);
      if (sha256Hex(json) !== entry.sha256) throw new Error('content checksum mismatch');
      return parseTermDoc(json, term);
    } catch (error) {
      log.warn(`course index ${term}: ${error instanceof Error ? error.message : String(error)}`);
      this.terms.delete(term);
      return null;
    }
  }
}

/** Where the bundled files are: next to the app's resources when packaged, `vendor/course-index` in development. */
export function bundledCourseIndexDir(): string {
  return app.isPackaged
    ? path.join(process.resourcesPath, 'course-index')
    : path.join(app.getAppPath(), 'vendor', 'course-index');
}

let shared: CourseIndexBundle | null = null;

/** The app's bundled course index (one instance, opened on first use). */
export function bundledCourseIndex(): CourseIndexBundle {
  if (!shared) shared = new CourseIndexBundle({ dir: bundledCourseIndexDir(), passphrase: indexClientPassphrase() });
  return shared;
}
