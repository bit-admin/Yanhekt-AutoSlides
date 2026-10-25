/**
 * Keeps the downloaded course index (`<userData>/course-index/`) up to date
 * from the indexer's `index` pre-release, which the Indexer workflow refreshes
 * every night (03:00 Beijing time).
 *
 * A check reads the signed client manifest, then downloads every term up to
 * the current one whose file this computer does not hold with the same hash
 * (in either copy): in practice the current term each day, and an earlier term
 * only when a backfill changed it. Files are checked like the reader checks
 * them (signature, passphrase, both hashes) before they are kept; the manifest
 * is written last and unreferenced files are removed after it.
 *
 * Each file is fetched from GitHub, then through gh-proxy.org (as the app
 * update check does) when GitHub does not answer. A proxy cannot forge
 * anything: the signature and hashes are checked here.
 *
 * Runs only in the app (never in a command-line run), only while
 * Settings → General → Search → Keep the Course Index Up to Date is on.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { appUserAgent } from '@main/infra/appUserAgent';
import { createLogger } from '@main/infra/logger';
import { CLIENT_MANIFEST_ASSET, openEnvelope, parseClientManifest, sha256Hex, type SigningKey } from './clientIndex';
import type { LocalCourseIndex } from './courseIndex';
import { passphraseId, unsealAsync } from './seal';
import signingKeys from './indexSigningKeys.json';

const log = createLogger('CourseIndexUpdate');

const RELEASE_BASE = 'https://github.com/bit-admin/Yanhekt-AutoSlides/releases/download/index/';
const PROXY_PREFIX = 'https://gh-proxy.org/';
const FETCH_TIMEOUT_MS = 60_000;
/** The release changes once a day; checking every few hours catches it soon after. */
export const CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000;
const FIRST_CHECK_DELAY_MS = 20_000;
const STATE_FILE = 'update-state.json';

export interface CourseIndexUpdateState {
  /** Last check that reached the release, epoch ms. */
  checkedAt: number | null;
  /** Why the last check failed, or null. */
  lastError: string | null;
}

export type CourseIndexUpdateResult =
  | { ok: true; downloaded: string[] }
  | { ok: false; error: string };

type Fetcher = (url: string) => Promise<Buffer>;

async function fetchOnce(url: string): Promise<Buffer> {
  const res = await fetch(url, {
    headers: { 'User-Agent': appUserAgent() },
    redirect: 'follow',
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

/** GitHub first, then the proxy. */
export async function fetchReleaseAsset(name: string, fetcher: Fetcher = fetchOnce): Promise<Buffer> {
  const direct = RELEASE_BASE + encodeURIComponent(name);
  try {
    return await fetcher(direct);
  } catch (error) {
    log.debug(`GitHub did not answer for ${name} (${error instanceof Error ? error.message : error}); trying the proxy`);
    return await fetcher(PROXY_PREFIX + direct);
  }
}

async function writeAtomic(file: string, bytes: Buffer | string): Promise<void> {
  const tmp = `${file}.tmp`;
  await fs.writeFile(tmp, bytes);
  await fs.rename(tmp, file);
}

export interface CourseIndexUpdaterOptions {
  index: LocalCourseIndex;
  /** Settings → Keep the Course Index Up to Date. */
  enabled: () => boolean;
  /** The current term key (`2026-2027-1`), or null when unknown. */
  currentTerm: () => Promise<string | null>;
  keys?: SigningKey[];
  fetcher?: Fetcher;
}

export class CourseIndexUpdater {
  private readonly options: CourseIndexUpdaterOptions;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private running: Promise<CourseIndexUpdateResult> | null = null;
  private state: CourseIndexUpdateState = { checkedAt: null, lastError: null };

  constructor(options: CourseIndexUpdaterOptions) {
    this.options = options;
  }

  private get dir(): string {
    return this.options.index.downloadedDir;
  }

  /** Start or stop the schedule to match the setting. */
  applyConfig(): void {
    if (this.options.enabled()) {
      if (!this.timer) this.schedule(FIRST_CHECK_DELAY_MS);
    } else {
      this.stop();
    }
  }

  stop(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
  }

  private schedule(delayMs: number): void {
    this.stop();
    this.timer = setTimeout(() => {
      this.timer = null;
      void this.checkIfDue().finally(() => {
        if (this.options.enabled()) this.schedule(CHECK_INTERVAL_MS);
      });
    }, delayMs);
    this.timer.unref?.();
  }

  private async checkIfDue(): Promise<void> {
    const saved = await this.readState();
    if (saved.checkedAt && Date.now() - saved.checkedAt < CHECK_INTERVAL_MS) return;
    await this.check();
  }

  async getState(): Promise<CourseIndexUpdateState & { checking: boolean }> {
    const saved = await this.readState();
    return { ...saved, checking: this.running !== null };
  }

  /** One check now (joins one already running). */
  check(): Promise<CourseIndexUpdateResult> {
    if (!this.running) {
      this.running = this.update()
        .catch((error: unknown): CourseIndexUpdateResult => ({ ok: false, error: error instanceof Error ? error.message : String(error) }))
        .then(async (result) => {
          this.state = result.ok
            ? { checkedAt: Date.now(), lastError: null }
            : { checkedAt: this.state.checkedAt, lastError: result.error };
          await this.writeState().catch(() => undefined);
          if (result.ok) {
            if (result.downloaded.length > 0) log.info(`course index updated: ${result.downloaded.join(', ')}`);
          } else {
            log.warn(`course index update failed: ${result.error}`);
          }
          return result;
        })
        .finally(() => {
          this.running = null;
        });
    }
    return this.running;
  }

  private async update(): Promise<CourseIndexUpdateResult> {
    const { index } = this.options;
    const passphrase = index.passphrase;
    if (!passphrase) return { ok: false, error: 'this build has no index key' };
    const fetcher = this.options.fetcher;

    const text = (await fetchReleaseAsset(CLIENT_MANIFEST_ASSET, fetcher)).toString('utf8');
    const envelope = openEnvelope(text, CLIENT_MANIFEST_ASSET, this.options.keys ?? index.keys ?? signingKeys.keys);
    if (!envelope.ok) return { ok: false, error: `manifest signature check failed (${envelope.reason})` };
    if (envelope.passphraseId !== passphraseId(passphrase)) {
      return { ok: false, error: 'the release uses another key; this app needs an update' };
    }
    const manifest = parseClientManifest(await unsealAsync(envelope.data, passphrase));
    const current = await this.options.currentTerm();
    const wanted = manifest.terms.filter((t) => !current || t.term <= current);

    await fs.mkdir(this.dir, { recursive: true });
    const downloaded: string[] = [];
    for (const t of wanted) {
      const held = await index.heldEntry(t.term);
      if (held && held.assetSha256 === t.assetSha256) continue;
      const target = path.join(this.dir, t.asset);
      try {
        if (sha256Hex(await fs.readFile(target)) === t.assetSha256) continue;
      } catch {
        // Not here yet.
      }
      const bytes = await fetchReleaseAsset(t.asset, fetcher);
      if (bytes.length !== t.bytes || sha256Hex(bytes) !== t.assetSha256) throw new Error(`${t.asset}: checksum mismatch`);
      if (sha256Hex(await unsealAsync(bytes, passphrase)) !== t.sha256) throw new Error(`${t.asset}: content checksum mismatch`);
      await writeAtomic(target, bytes);
      downloaded.push(t.term);
    }

    // Only a manifest that names something new replaces the one here.
    const before = await fs.readFile(path.join(this.dir, CLIENT_MANIFEST_ASSET), 'utf8').catch(() => null);
    if (before !== text) {
      await writeAtomic(path.join(this.dir, CLIENT_MANIFEST_ASSET), text);
      const keep = new Set(manifest.terms.map((t) => t.asset));
      for (const name of await fs.readdir(this.dir)) {
        if (/^term-.*\.json\.gz\.enc(\.tmp)?$/.test(name) && !keep.has(name)) {
          await fs.rm(path.join(this.dir, name), { force: true });
        }
      }
      index.reset();
    }
    return { ok: true, downloaded };
  }

  private async readState(): Promise<CourseIndexUpdateState> {
    try {
      const saved = JSON.parse(await fs.readFile(path.join(this.dir, STATE_FILE), 'utf8')) as Partial<CourseIndexUpdateState>;
      this.state = {
        checkedAt: typeof saved.checkedAt === 'number' ? saved.checkedAt : null,
        lastError: typeof saved.lastError === 'string' ? saved.lastError : null,
      };
    } catch {
      // Cleared or never written: keep what this run knows.
    }
    return this.state;
  }

  private async writeState(): Promise<void> {
    await fs.mkdir(this.dir, { recursive: true });
    await writeAtomic(path.join(this.dir, STATE_FILE), JSON.stringify(this.state));
  }

  /** After Clear Cache removed the folder: forget the last check, so the next one runs at once. */
  forget(): void {
    this.state = { checkedAt: null, lastError: null };
    if (this.options.enabled()) this.schedule(FIRST_CHECK_DELAY_MS);
  }
}
