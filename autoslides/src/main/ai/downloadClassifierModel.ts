import { createHash } from 'node:crypto';
import { createWriteStream, promises as fs } from 'node:fs';
import path from 'node:path';
import { Transform, type Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { checkDownloadRedirect, FileDownloadService } from '@main/infra/fileDownloadService';
import { httpClient } from '@main/infra/http';
import { createLogger } from '@main/infra/logger';
import { SLIDE_CLASSIFIER_RELEASE } from './slideClassifierRelease';

const log = createLogger('ClassifierModelDownload');

/** No total deadline (slow links must finish); give up only when bytes stop arriving. */
export const STALL_TIMEOUT_MS = 30_000;

const STAGE_PREFIX = '.classifier-';
/** Earlier pinned versions of the default model, and their removal markers. */
const DEFAULT_MODEL_FILE = /^slide-classifier-.+\.onnx(\.removed)?$/;

async function fetchModel(url: string, partial: string, onBytes: (bytes: number) => void): Promise<void> {
  const controller = new AbortController();
  let stall: NodeJS.Timeout | undefined;
  const armStall = () => {
    clearTimeout(stall);
    stall = setTimeout(() => controller.abort(new Error('Classifier download stalled')), STALL_TIMEOUT_MS);
  };
  armStall();
  try {
    const response = await httpClient.get<Readable>(url, {
      responseType: 'stream',
      timeout: 12_000,
      maxRedirects: 10,
      beforeRedirect: checkDownloadRedirect,
      validateStatus: () => true,
      signal: controller.signal,
    });
    if (response.status !== 200) {
      response.data.destroy();
      throw new Error(`HTTP ${response.status}`);
    }

    const hash = createHash('sha256');
    let bytes = 0;
    const verify = new Transform({
      transform(chunk: Buffer, _encoding, callback) {
        armStall();
        bytes += chunk.length;
        if (bytes > SLIDE_CLASSIFIER_RELEASE.bytes) {
          callback(new Error('Classifier model exceeds its pinned size'));
          return;
        }
        hash.update(chunk);
        onBytes(bytes);
        callback(null, chunk);
      },
    });
    await pipeline(response.data, verify, createWriteStream(partial), { signal: controller.signal });
    if (bytes !== SLIDE_CLASSIFIER_RELEASE.bytes || hash.digest('hex') !== SLIDE_CLASSIFIER_RELEASE.sha256) {
      throw new Error('Classifier model failed its pinned size or SHA-256 check');
    }
  } finally {
    clearTimeout(stall);
  }
}

/** Best effort: a leftover only costs disk space, never correctness. */
async function removeEntries(parent: string, match: (name: string) => boolean): Promise<void> {
  let names: string[];
  try { names = await fs.readdir(parent); } catch { return; }
  await Promise.all(names.filter(match).map((name) =>
    fs.rm(path.join(parent, name), { recursive: true, force: true }).catch(() => {})));
}

/**
 * GitHub first, then the same release proxy as app updates. Neither can publish
 * unverified bytes. `onProgress` gets 0–1 of the pinned size (restarting at 0 on
 * the proxy).
 */
export async function downloadClassifierModel(
  destination: string,
  onProgress: (fraction: number) => void = () => {},
): Promise<void> {
  const { url } = SLIDE_CLASSIFIER_RELEASE;
  const parent = path.dirname(destination);
  const current = path.basename(destination);
  await fs.mkdir(parent, { recursive: true });
  // Downloads are coalesced in-process, so any stage folder here is from a crash.
  await removeEntries(parent, (name) => name.startsWith(STAGE_PREFIX));
  const stage = await fs.mkdtemp(path.join(parent, STAGE_PREFIX));
  const partial = path.join(stage, 'model.part');
  const report = (bytes: number) => onProgress(bytes / SLIDE_CLASSIFIER_RELEASE.bytes);
  try {
    try {
      await fetchModel(url, partial, report);
    } catch (error) {
      log.debug('Direct classifier download failed; trying the release proxy:', error instanceof Error ? error.message : String(error));
      onProgress(0);
      await fetchModel(FileDownloadService.getProxyUrl(url), partial, report);
    }
    await fs.rename(partial, destination);
  } finally {
    await fs.rm(stage, { recursive: true, force: true }).catch(() => {});
  }
  // A new pin is a new file name: drop the versions it replaces.
  await removeEntries(parent, (name) =>
    DEFAULT_MODEL_FILE.test(name) && name !== current && name !== `${current}.removed`);
}
