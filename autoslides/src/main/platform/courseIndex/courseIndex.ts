/**
 * The course index on this computer: each term's courses with their teachers,
 * registrar code and lecture ids, from the indexer's `index` pre-release
 * (indexer/src/clientIndex.ts has the format).
 *
 * Two copies, read the same way:
 *   - bundled: `npm run index-bundle` fills `vendor/course-index/` (git-ignored)
 *     with the terms before the current one; it ships as an extraResource;
 *   - downloaded: `<userData>/course-index/`, kept up to date by
 *     courseIndexUpdater.ts (the current term, and earlier terms that changed).
 *     Clear Cache removes it.
 * A term is read from the downloaded copy when it has one, else the bundled.
 *
 * Reading a copy:
 *   1. the manifest envelope must carry a signature from indexSigningKeys.json;
 *   2. it must be sealed with the passphrase this build carries (clientKey.ts);
 *   3. each term file must match the manifest's hash before and after decrypting.
 * Anything else counts as no copy; nothing here touches the network.
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
import { numberKey } from './grams';
import { searchCourses, type IndexCourse } from './localSearch';

const log = createLogger('CourseIndex');

export type { TermCourse, IndexCourse };

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

  /** The manifest entry of a term whose file is present here, or null. */
  async entry(term: string): Promise<ClientTerm | null> {
    const opened = await this.open();
    if ('problem' in opened) return null;
    return opened.present.get(term) ?? null;
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

/** The downloaded copy's folder name under userData (cachePaths lists it, so Clear Cache removes it). */
export const DOWNLOADED_COURSE_INDEX_DIR_NAME = 'course-index';

export function downloadedCourseIndexDir(): string {
  return path.join(app.getPath('userData'), DOWNLOADED_COURSE_INDEX_DIR_NAME);
}

export interface LocalIndexTerm extends CourseIndexTerm {
  /** Which copy the term is read from. */
  source: 'downloaded' | 'bundled';
}

export interface LocalCourseIndexOptions {
  downloadedDir: string;
  bundledDir: string;
  passphrase: string | null;
  keys?: SigningKey[];
}

/** The downloaded copy over the bundled one, term by term. */
export class LocalCourseIndex {
  private readonly options: LocalCourseIndexOptions;
  private downloaded: CourseIndexBundle;
  private readonly bundled: CourseIndexBundle;
  private everything: Promise<IndexCourse[]> | null = null;

  constructor(options: LocalCourseIndexOptions) {
    this.options = options;
    this.downloaded = this.openDownloaded();
    this.bundled = new CourseIndexBundle({ dir: options.bundledDir, passphrase: options.passphrase, keys: options.keys });
  }

  get downloadedDir(): string {
    return this.options.downloadedDir;
  }

  get passphrase(): string | null {
    return this.options.passphrase;
  }

  get keys(): SigningKey[] | undefined {
    return this.options.keys;
  }

  private openDownloaded(): CourseIndexBundle {
    return new CourseIndexBundle({ dir: this.options.downloadedDir, passphrase: this.options.passphrase, keys: this.options.keys });
  }

  /** Forget what was read, after the downloaded copy changed or was removed. */
  reset(): void {
    this.downloaded = this.openDownloaded();
    this.everything = null;
  }

  /**
   * The copy a term is read from: the one that has it, and when both do, the
   * newer one (a stale download must not hide a fresher bundle after an app
   * update with updates off).
   */
  private async copyFor(term: string): Promise<{ bundle: CourseIndexBundle; entry: ClientTerm; source: LocalIndexTerm['source'] } | null> {
    const [down, bundled] = await Promise.all([this.downloaded.entry(term), this.bundled.entry(term)]);
    if (down && bundled) {
      const [ds, bs] = await Promise.all([this.downloaded.state(), this.bundled.state()]);
      const bundledNewer = ds.ok && bs.ok && bs.generatedAt > ds.generatedAt;
      return bundledNewer
        ? { bundle: this.bundled, entry: bundled, source: 'bundled' }
        : { bundle: this.downloaded, entry: down, source: 'downloaded' };
    }
    if (down) return { bundle: this.downloaded, entry: down, source: 'downloaded' };
    if (bundled) return { bundle: this.bundled, entry: bundled, source: 'bundled' };
    return null;
  }

  /** Every term held, newest first, with the copy it is read from. */
  async terms(): Promise<LocalIndexTerm[]> {
    const [down, bundled] = await Promise.all([this.downloaded.state(), this.bundled.state()]);
    const keys = new Set<string>();
    if (down.ok) for (const t of down.terms) keys.add(t.term);
    if (bundled.ok) for (const t of bundled.terms) keys.add(t.term);
    const out: LocalIndexTerm[] = [];
    for (const term of keys) {
      const copy = await this.copyFor(term);
      if (copy) out.push({ term, courses: copy.entry.courses, sessions: copy.entry.sessions, source: copy.source });
    }
    return out.sort((a, b) => b.term.localeCompare(a.term));
  }

  /** When the newest copy was generated by the indexer, or null with no copy. */
  async generatedAt(): Promise<string | null> {
    const [down, bundled] = await Promise.all([this.downloaded.state(), this.bundled.state()]);
    const stamps = [down, bundled].filter((s) => s.ok).map((s) => (s as { generatedAt: string }).generatedAt);
    return stamps.sort().pop() ?? null;
  }

  /** The manifest entry this computer holds for a term (downloaded first), for the updater. */
  async heldEntry(term: string): Promise<ClientTerm | null> {
    return (await this.copyFor(term))?.entry ?? null;
  }

  async hasTerm(term: string): Promise<boolean> {
    return (await this.heldEntry(term)) !== null;
  }

  /** A term's courses, or null when no copy holds the term (or its file fails a check). */
  async termCourses(term: string): Promise<IndexCourse[] | null> {
    const copy = await this.copyFor(term);
    if (!copy) return null;
    const courses = await copy.bundle.term(term);
    return courses ? courses.map((c) => ({ ...c, term })) : null;
  }

  /** Every course of every term held. */
  private all(): Promise<IndexCourse[]> {
    if (!this.everything) {
      this.everything = (async () => {
        const out: IndexCourse[] = [];
        for (const t of await this.terms()) out.push(...((await this.termCourses(t.term)) ?? []));
        return out;
      })();
      this.everything.catch(() => {
        this.everything = null;
      });
    }
    return this.everything;
  }

  /** Matches in a term, best first; null when the term is not held here. */
  async search(term: string, q: string): Promise<IndexCourse[] | null> {
    const courses = await this.termCourses(term);
    if (!courses) return null;
    return searchCourses(q, term, courses, await this.all());
  }

  async byId(courseId: string): Promise<IndexCourse | null> {
    return (await this.all()).find((c) => c.id === courseId) ?? null;
  }

  /** The one course with this registrar code (Yanhe 2.0 `kcwybm`), compared whole; null when none or several. */
  async byNumber(code: string): Promise<IndexCourse | null> {
    const key = numberKey(code);
    if (!key) return null;
    const matches = (await this.all()).filter((c) => numberKey(c.number) === key);
    return matches.length === 1 ? matches[0] : null;
  }
}

let shared: LocalCourseIndex | null = null;

/** The app's course index on this computer (one instance, opened on first use). */
export function localCourseIndex(): LocalCourseIndex {
  if (!shared) {
    shared = new LocalCourseIndex({
      downloadedDir: downloadedCourseIndexDir(),
      bundledDir: bundledCourseIndexDir(),
      passphrase: indexClientPassphrase(),
    });
  }
  return shared;
}
