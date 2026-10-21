/**
 * Downloads a Yanhe 2.0 recording into the output folder, filed under the
 * same lecture on Yanhekt: the renderer names the file the way a Yanhekt
 * download of that lecture is named, so both sites' downloads are one file and
 * everything downstream (auto extraction, Lectures, the subtitles' `.srt`)
 * works unchanged. Like saved slides and subtitles, a lecture with no Yanhekt
 * twin is not downloaded at all (`prepare` says so first).
 *
 * The media itself comes from aita, along the intranet route:
 * - the camera is an HLS playlist, fetched by the Yanhekt downloader's own
 *   segment pool and remux, with each request signed for `/play/` here;
 * - the screen is one MP4 and the classroom mic one AAC, streamed to a
 *   `.part` file (resumed by byte range after a dropped connection) and
 *   renamed when whole.
 *
 * Every `/play/` request is signed at the moment it is made (a signature ages
 * out after about three hours) and never follows a redirect. The AAC needs
 * no signature, only the Referer.
 */
import fs from 'node:fs';
import path from 'node:path';
import type { Readable, Writable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import axios from 'axios';
import type { Yanhe2DownloadKind, Yanhe2DownloadPrepared } from '@common/yanhe2Download';
import { createIntranetAxios } from '@main/infra/intranetTransport';
import { createLogger } from '@main/infra/logger';
import { expandTilde } from '@main/infra/pathUtils';
import type { ConfigService } from '@main/platform/configService';
import type { IntranetMappingService } from '@main/platform/intranetMappingService';
import { isYanhe2PlayUrl, signYanhe2PlayUrl, type Yanhe2PlayIdentity } from '@main/platform/yanhe2/yanhe2Playback';
import type { Yanhe2Service } from '@main/platform/yanhe2/yanhe2Service';
import { lectureTargetOf, type Yanhe2TwinResolver } from '@main/platform/yanhe2/yanhe2TwinResolver';
import { AUDIO_PART_SUFFIX } from './audioDownloadService';
import type { DownloadProgress, HlsRequestSigner, M3u8DownloadService } from './m3u8DownloadService';
import { YANHE2_PLAY_HEADERS } from './videoProxy/yanhe2Play';

const log = createLogger('Yanhe2Download');

/** Suffix of an MP4 being written. The AAC uses the mic downloader's, so its cleanup finds it too. */
export const YANHE2_MP4_PART_SUFFIX = '.mp4.part';
const FILE_TIMEOUT_MS = 60_000;
/** Progress is sent at most this often; a 700 MB file is ten thousand chunks. */
const PROGRESS_INTERVAL_MS = 250;
const CANCELLED = 'Cancelled by user';

/** Signs every request of one HLS download for aita's `/play/` tree. */
class Yanhe2HlsSigner implements HlsRequestSigner {
  readonly requestOptions = { maxRedirects: 0 };

  constructor(private readonly identity: Yanhe2PlayIdentity) {}

  async prepare(): Promise<void> { /* nothing to fetch: the signature is made per request */ }

  playlistUrl(url: string): string {
    return url;
  }

  sign(url: string): string {
    // The playlist is the server's, but only aita's own `/play/` tree gets the account's signature.
    if (!isYanhe2PlayUrl(url)) throw new Error('Yanhe 2.0 playlist names a file outside /play/');
    return signYanhe2PlayUrl(url, this.identity, Date.now());
  }

  headers(): Record<string, string> {
    return { ...YANHE2_PLAY_HEADERS };
  }

  dispose(): void { /* nothing started */ }
}

function isKind(value: unknown): value is Yanhe2DownloadKind {
  return value === 'camera' || value === 'screen' || value === 'audio';
}

/** A bare file stem as `buildDownloadFileName` makes it: no folder, nothing hidden. */
function isPlainStem(name: unknown): name is string {
  return typeof name === 'string' && name.length > 0 && name.length <= 240
    && !/[/\\]/.test(name) && !name.startsWith('.') && name !== '..';
}

export class Yanhe2DownloadService {
  /** Downloads in progress, by download id, each with the switch that stops it. */
  private readonly active = new Map<string, AbortController>();

  constructor(
    private readonly yanhe2Service: Yanhe2Service,
    private readonly twinResolver: Yanhe2TwinResolver,
    private readonly configService: ConfigService,
    private readonly intranetMapping: IntranetMappingService,
    private readonly m3u8DownloadService: M3u8DownloadService,
  ) {}

  /** What the recording has, and the Yanhekt lecture it is filed under. Writes nothing. */
  async prepare(account: string, query: unknown): Promise<Yanhe2DownloadPrepared> {
    const info = await this.yanhe2Service.getSubInfo(account, query);
    if (info.kind !== 'ok') return { kind: info.kind };
    if (info.data.status !== 'playable') return { kind: 'no_recording' };
    const streams: Yanhe2DownloadKind[] = [];
    if (info.data.sources.some((source) => source.type === 'camera')) streams.push('camera');
    if (info.data.sources.some((source) => source.type === 'screen')) streams.push('screen');
    if (info.data.audioUrl) streams.push('audio');
    if (streams.length === 0) return { kind: 'no_recording' };

    const twin = await this.twinResolver.find(account, query);
    return twin.kind === 'ok' ? { kind: 'ok', target: lectureTargetOf(twin.data), streams } : twin;
  }

  /** True when this service owns the id, so the shared cancel channel can route to it. */
  isActive(downloadId: string): boolean {
    return this.active.has(downloadId);
  }

  /**
   * Download one stream as `<outputName>.mp4` (or `.aac`). Throws with the
   * row's error text; reports on the same progress shape as every download.
   */
  async start(
    downloadId: string,
    account: string,
    query: unknown,
    kind: unknown,
    outputName: unknown,
    progress: (progress: DownloadProgress) => void,
  ): Promise<void> {
    if (!isKind(kind) || !isPlainStem(outputName)) throw new Error('Bad Yanhe 2.0 download request');
    if (this.active.has(downloadId)) throw new Error('Download already in progress');
    const controller = new AbortController();
    this.active.set(downloadId, controller);
    try {
      // Read now, not at prepare: the URLs are the server's current ones.
      const info = await this.yanhe2Service.getSubInfo(account, query);
      if (info.kind === 'signed_out') throw new Error('Your Yanhe 2.0 session has ended. Sign in again, then retry.');
      if (info.kind === 'network') throw new Error('Could not reach Yanhe 2.0. Check your connection and retry.');
      if (info.kind !== 'ok') throw new Error('Yanhe 2.0 did not return this recording.');
      const identity = this.yanhe2Service.getPlayIdentity(account);
      if (!identity) throw new Error('Your Yanhe 2.0 session has ended. Sign in again, then retry.');
      if (controller.signal.aborted) throw new Error(CANCELLED);

      if (kind === 'audio') {
        if (!info.data.audioUrl || !isYanhe2PlayUrl(info.data.audioUrl)) throw new Error('This recording has no classroom mic audio.');
        await this.fetchFile(info.data.audioUrl, null, outputName, '.aac', AUDIO_PART_SUFFIX, controller.signal, progress);
        return;
      }

      const source = info.data.sources.find((candidate) => candidate.type === kind);
      if (!source || !isYanhe2PlayUrl(source.url)) {
        throw new Error(kind === 'screen' ? 'This recording has no screen stream.' : 'This recording has no camera stream.');
      }
      if (source.format === 'hls') {
        // The m3u8 service owns this id from here; a cancel reaches it through `cancel`.
        await this.m3u8DownloadService.startSignedDownload(
          downloadId, source.url, outputName, progress, new Yanhe2HlsSigner(identity),
        );
        if (controller.signal.aborted) throw new Error(CANCELLED);
      } else {
        await this.fetchFile(source.url, identity, outputName, '.mp4', YANHE2_MP4_PART_SUFFIX, controller.signal, progress);
      }
    } finally {
      this.active.delete(downloadId);
    }
  }

  cancel(downloadId: string): void {
    const controller = this.active.get(downloadId);
    if (!controller) return;
    controller.abort();
    this.active.delete(downloadId);
    this.m3u8DownloadService.cancelDownload(downloadId);
  }

  /** The MP4's `.part`; the HLS and AAC leftovers are the other downloaders' to clean. */
  cleanupTempFiles(outputName: string): void {
    if (!isPlainStem(outputName)) return;
    const outputDir = expandTilde(this.configService.getConfig().outputDirectory);
    fs.promises.rm(path.join(outputDir, `${outputName}${YANHE2_MP4_PART_SUFFIX}`), { force: true })
      .catch((error) => log.error('Error deleting Yanhe 2.0 temporary file:', error));
  }

  /**
   * One file, streamed to `.part` and renamed when whole. A dropped
   * connection resumes from the bytes already written (a fresh signature
   * each try); a server that ignores the range starts it over.
   * `identity` null means the file is unsigned (the classroom AAC).
   */
  private async fetchFile(
    url: string,
    identity: Yanhe2PlayIdentity | null,
    outputName: string,
    extension: '.mp4' | '.aac',
    partSuffix: string,
    signal: AbortSignal,
    progress: (progress: DownloadProgress) => void,
  ): Promise<void> {
    const outputDir = expandTilde(this.configService.getConfig().outputDirectory);
    await fs.promises.mkdir(outputDir, { recursive: true });
    const finalPath = path.join(outputDir, `${outputName}${extension}`);
    const partPath = path.join(outputDir, `${outputName}${partSuffix}`);
    await fs.promises.rm(partPath, { force: true });

    await this.intranetMapping.ensureFresh();
    const route = this.intranetMapping.route();
    // One socket: a single sequential stream, not a segment pool.
    const bundle = createIntranetAxios({
      intranetMapping: this.intranetMapping,
      isIntranetMode: route.intranet,
      publicFallback: route.publicFallback,
      maxSockets: 1,
      timeout: FILE_TIMEOUT_MS,
    });

    const attempts = Math.max(1, (this.configService.getConfig().downloadNumRetries ?? 3) + 1);
    let received = 0;
    let total = 0;
    let lastSent = 0;
    const report = (force = false) => {
      const now = Date.now();
      if (!force && now - lastSent < PROGRESS_INTERVAL_MS) return;
      lastSent = now;
      progress({ current: received, total: Math.max(total, received, 1), phase: 0 });
    };

    try {
      let reason = 'no answer';
      let done = false;
      for (let attempt = 0; attempt < attempts && !done; attempt++) {
        if (signal.aborted) throw new Error(CANCELLED);
        const headers: Record<string, string> = { ...YANHE2_PLAY_HEADERS };
        if (received > 0) headers.Range = `bytes=${received}-`;
        let writer: Writable | null = null;
        try {
          const response = await bundle.instance.get<Readable>(
            identity ? signYanhe2PlayUrl(url, identity, Date.now()) : url,
            {
              headers,
              responseType: 'stream',
              signal,
              // A signature must not follow a redirect to another host.
              maxRedirects: 0,
              validateStatus: () => true,
            },
          );
          const length = Number(response.headers['content-length']) || 0;
          if (response.status === 200) {
            // The whole file, from the start (also what a server that ignores the range sends).
            received = 0;
            total = length;
          } else if (response.status === 206 && received > 0) {
            total = received + length;
          } else {
            response.data.destroy();
            reason = `HTTP ${response.status}`;
            // A refused signature or a missing file stays that way.
            if (response.status >= 400 && response.status < 500 && response.status !== 408 && response.status !== 429) break;
            continue;
          }
          report(true);
          response.data.on('data', (chunk: Buffer) => {
            received += chunk.length;
            report();
          });
          writer = fs.createWriteStream(partPath, { flags: received > 0 ? 'a' : 'w' });
          await pipeline(response.data, writer);
          // A body cut short ends the stream without an error.
          done = total === 0 || received >= total;
          if (!done) reason = 'connection closed early';
        } catch (error) {
          writer?.destroy();
          if (signal.aborted || axios.isCancel(error)) throw new Error(CANCELLED);
          // The code only: an axios error carries the signed URL in its config.
          reason = axios.isAxiosError(error) ? (error.code ?? 'no answer') : 'write error';
          // What was written before the failure may be partial; trust only what the file holds.
          received = await fs.promises.stat(partPath).then((stat) => stat.size, () => 0);
        }
      }
      if (!done) {
        log.warn(`Yanhe 2.0 ${extension} download failed: ${reason}`);
        throw new Error(`Yanhe 2.0 download failed (${reason}).`);
      }
      if (signal.aborted) throw new Error(CANCELLED);
      await fs.promises.rename(partPath, finalPath);
      // No remux, so no processing stage.
      progress({ current: received, total: received || 1, phase: 2 });
    } catch (error) {
      await fs.promises.rm(partPath, { force: true }).catch(() => { /* best effort */ });
      throw error;
    } finally {
      bundle.destroy();
    }
  }
}
