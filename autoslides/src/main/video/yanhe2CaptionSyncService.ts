/**
 * Measures how far a Yanhe 2.0 recording's transcript is off the recording.
 *
 * The method is `@common/yanhe2CaptionSync`: no speech is recognised, the
 * transcript's speaking and silent stretches are slid over the loudness of
 * the recording. This service brings the audio: a few five-minute windows of
 * the screen stream, picked where the transcript has pauses, downloaded along
 * the intranet route and decoded by ffmpeg. The screen because that is what
 * the player opens on and what leads when both streams play; the camera's own
 * audio runs up to a couple of seconds off it, differently per lecture, and
 * is used only when the screen is not a playlist.
 *
 * A window is tens of megabytes, so a lecture is measured once: the answer,
 * including "could not tell", is kept by session id across launches, and two
 * callers asking about the same lecture share one measurement. A network
 * failure is not an answer and is not kept.
 *
 * The answers are cache, like the Home page's thumbnails: one small file per
 * lecture in `<userData>/caption-sync/`, removed by Settings → Clear Cache
 * (`APP_CACHE_DIR_NAMES`), after which a lecture is simply measured again.
 * The audio itself never touches the disk.
 */
import { spawn } from 'child_process';
import * as fs from 'fs/promises';
import * as path from 'path';
import { app } from 'electron';
import axios, { type AxiosInstance } from 'axios';
import {
  SYNC_PCM_RATE,
  SYNC_WINDOW_SECONDS,
  fitSyncWindow,
  judgeCaptionSync,
  loudnessEnvelope,
  parseHlsSegments,
  pickSyncWindows,
  type HlsSegment,
  type SyncWindowFit,
  type Yanhe2CaptionSyncResult,
} from '@common/yanhe2CaptionSync';
import type { Yanhe2TranscriptLine } from '@common/yanhe2Transcript';
import type { FFmpegService } from '@main/infra/ffmpegService';
import { createIntranetAxios } from '@main/infra/intranetTransport';
import { createLogger } from '@main/infra/logger';
import type { IntranetMappingService } from '@main/platform/intranetMappingService';
import { isYanhe2PlayUrl, signYanhe2PlayUrl, type Yanhe2PlayIdentity } from '@main/platform/yanhe2/yanhe2Playback';
import type { Yanhe2Service } from '@main/platform/yanhe2/yanhe2Service';
import { YANHE2_PLAY_HEADERS } from './videoProxy/yanhe2Play';

const log = createLogger('Yanhe2CaptionSync');

/** Bumped when the method changes enough that kept answers should be measured again. */
const METHOD_VERSION = 2;
/** Segments in flight at once. */
const CONCURRENCY = 6;
const PLAYLIST_TIMEOUT_MS = 30_000;
const SEGMENT_TIMEOUT_MS = 60_000;
const SEGMENT_ATTEMPTS = 3;
const DECODE_TIMEOUT_MS = 60_000;

/** Thrown for a request that got no usable answer; the lecture is then not judged at all. */
class Unreachable extends Error {}

function subIdOf(query: unknown): string {
  const subId = (query as { subId?: unknown } | null)?.subId;
  return typeof subId === 'string' ? subId : '';
}

export class Yanhe2CaptionSyncService {
  /** Measurements under way, by aita session id. */
  private readonly running = new Map<string, Promise<Yanhe2CaptionSyncResult>>();

  constructor(
    private readonly yanhe2Service: Yanhe2Service,
    private readonly intranetMapping: IntranetMappingService,
    private readonly ffmpegService: FFmpegService,
  ) {}

  /** The delay of one recording's transcript: the kept answer, or a measurement made now. */
  async measure(account: string, query: unknown): Promise<Yanhe2CaptionSyncResult> {
    const subId = subIdOf(query);
    if (!/^\d{1,12}$/.test(subId)) return { kind: 'failed' };
    const kept = await this.readKept(subId);
    if (kept) return kept.delay === null ? { kind: 'unknown' } : { kind: 'ok', delay: kept.delay };

    const running = this.running.get(subId);
    if (running) return running;
    const started = this.run(account, query, subId).finally(() => this.running.delete(subId));
    this.running.set(subId, started);
    return started;
  }

  private async run(account: string, query: unknown, subId: string): Promise<Yanhe2CaptionSyncResult> {
    const transcript = await this.yanhe2Service.getTranscript(account, subId);
    if (transcript.kind !== 'ok') return { kind: transcript.kind };
    if (transcript.data.length === 0) return { kind: 'no_transcript' };
    const info = await this.yanhe2Service.getSubInfo(account, query);
    if (info.kind !== 'ok') return { kind: info.kind };
    const identity = this.yanhe2Service.getPlayIdentity(account);
    const ffmpegPath = this.ffmpegService.getFfmpegPath();
    if (!identity || !ffmpegPath) return { kind: 'failed' };

    // A playlist, because an MP4 cannot be read a window at a time: the
    // screen's, else the camera's.
    const playlists = info.data.sources.filter((source) => source.format === 'hls');
    const stream = playlists.find((source) => source.type === 'screen') ?? playlists.find((source) => source.type === 'camera');
    let delay: number | null = null;
    if (stream) {
      try {
        delay = await this.listen(stream.url, transcript.data, identity, ffmpegPath);
      } catch (error) {
        if (error instanceof Unreachable) return { kind: 'network' };
        log.error('Yanhe 2.0 caption sync failed:', error);
        return { kind: 'failed' };
      }
    }
    await this.keep(subId, delay);
    log.debug(`Yanhe 2.0 caption sync for ${subId}: ${delay === null ? 'no answer' : `${delay} s`}`);
    return delay === null ? { kind: 'unknown' } : { kind: 'ok', delay };
  }

  /** `subId` is digits only (checked by `measure`), so it is safe as a file name. */
  private keptPath(subId: string): string {
    return path.join(app.getPath('userData'), 'caption-sync', `${subId}.json`);
  }

  /** The kept answer for a lecture; null when there is none, or it is from an older method. */
  private async readKept(subId: string): Promise<{ delay: number | null } | null> {
    try {
      const row = JSON.parse(await fs.readFile(this.keptPath(subId), 'utf8')) as { v?: unknown; delay?: unknown };
      if (row.v !== METHOD_VERSION) return null;
      return { delay: typeof row.delay === 'number' && Number.isFinite(row.delay) ? row.delay : null };
    } catch {
      return null;
    }
  }

  /** Best effort: an answer that could not be written is measured again next time. */
  private async keep(subId: string, delay: number | null): Promise<void> {
    try {
      const file = this.keptPath(subId);
      await fs.mkdir(path.dirname(file), { recursive: true });
      await fs.writeFile(file, JSON.stringify({ v: METHOD_VERSION, delay }), 'utf8');
    } catch (error) {
      log.warn('Yanhe 2.0 caption sync answer was not kept:', error);
    }
  }

  /** Fit the transcript to up to three windows of one stream, stopping once two agree. */
  private async listen(
    playlistUrl: string,
    lines: Yanhe2TranscriptLine[],
    identity: Yanhe2PlayIdentity,
    ffmpegPath: string,
  ): Promise<number | null> {
    await this.intranetMapping.ensureFresh();
    const route = this.intranetMapping.route();
    const bundle = createIntranetAxios({
      intranetMapping: this.intranetMapping,
      isIntranetMode: route.intranet,
      publicFallback: route.publicFallback,
      maxSockets: CONCURRENCY,
      timeout: SEGMENT_TIMEOUT_MS,
    });
    try {
      const playlist = await this.get<string>(bundle.instance, playlistUrl, identity, 'text', PLAYLIST_TIMEOUT_MS);
      const segments = parseHlsSegments(playlist);
      const last = segments[segments.length - 1];
      if (!last) return null;

      const fits: SyncWindowFit[] = [];
      for (const start of pickSyncWindows(lines, last.start + last.duration)) {
        const chosen = segments.filter(
          (segment) => segment.start + segment.duration > start && segment.start < start + SYNC_WINDOW_SECONDS,
        );
        const fit = await this.fitWindow(bundle.instance, playlistUrl, chosen, lines, identity, ffmpegPath);
        if (fit) fits.push(fit);
        // Two windows that agree are the answer; the third is only for when they do not.
        if (fits.length >= 2 && judgeCaptionSync(fits) !== null) break;
      }
      return judgeCaptionSync(fits);
    } finally {
      bundle.destroy();
    }
  }

  private async fitWindow(
    instance: AxiosInstance,
    playlistUrl: string,
    segments: HlsSegment[],
    lines: Yanhe2TranscriptLine[],
    identity: Yanhe2PlayIdentity,
    ffmpegPath: string,
  ): Promise<SyncWindowFit | null> {
    if (segments.length === 0) return null;
    const parts = new Array<Buffer>(segments.length);
    let next = 0;
    const worker = async () => {
      while (next < segments.length) {
        const index = next++;
        const url = new URL(segments[index].uri, playlistUrl).toString();
        // The playlist is the server's, but only aita's own `/play/` tree is fetched.
        if (!isYanhe2PlayUrl(url)) throw new Error('segment outside /play/');
        parts[index] = Buffer.from(await this.get<ArrayBuffer>(instance, url, identity, 'arraybuffer', SEGMENT_TIMEOUT_MS));
      }
    };
    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, segments.length) }, worker));

    // MPEG-TS segments of one stream join end to end into one stream.
    const pcm = await this.decode(ffmpegPath, Buffer.concat(parts));
    if (!pcm) return null;
    return fitSyncWindow(lines, segments[0].start, loudnessEnvelope(pcm));
  }

  /** One signed GET, retried; the signature is made per attempt and never logged. */
  private async get<T>(
    instance: AxiosInstance,
    url: string,
    identity: Yanhe2PlayIdentity,
    responseType: 'text' | 'arraybuffer',
    timeout: number,
  ): Promise<T> {
    let reason = 'no answer';
    for (let attempt = 0; attempt < SEGMENT_ATTEMPTS; attempt++) {
      try {
        const response = await instance.get<T>(signYanhe2PlayUrl(url, identity, Date.now()), {
          headers: { ...YANHE2_PLAY_HEADERS },
          responseType,
          timeout,
          // The signature must not follow a redirect to another host.
          maxRedirects: 0,
        });
        return response.data;
      } catch (error) {
        // The code or status only: an axios error carries the signed URL in its config.
        reason = axios.isAxiosError(error) ? (error.code ?? `HTTP ${error.response?.status ?? '?'}`) : 'request error';
      }
    }
    log.warn(`Yanhe 2.0 caption sync could not fetch media: ${reason}`);
    throw new Unreachable(reason);
  }

  /** The audio of a piece of MPEG-TS as 16-bit mono PCM at `SYNC_PCM_RATE`, or null when ffmpeg gives none. */
  private decode(ffmpegPath: string, media: Buffer): Promise<Int16Array | null> {
    return new Promise((resolve) => {
      const args = [
        '-loglevel', 'error', '-i', 'pipe:0',
        '-vn', '-ac', '1', '-ar', String(SYNC_PCM_RATE), '-f', 's16le', 'pipe:1',
      ];
      const child = spawn(ffmpegPath, args, { stdio: ['pipe', 'pipe', 'ignore'] });
      const chunks: Buffer[] = [];
      let settled = false;
      const finish = (ok: boolean) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        if (!ok || chunks.length === 0) {
          resolve(null);
          return;
        }
        // Copied, so the samples start on an even byte whatever the chunks did.
        const bytes = Buffer.concat(chunks);
        const samples = new Int16Array(bytes.length >> 1);
        for (let index = 0; index < samples.length; index++) samples[index] = bytes.readInt16LE(index * 2);
        resolve(samples);
      };
      const timer = setTimeout(() => {
        try { child.kill('SIGKILL'); } catch { /* already gone */ }
        finish(false);
      }, DECODE_TIMEOUT_MS);

      child.stdout.on('data', (chunk: Buffer) => chunks.push(chunk));
      child.on('error', () => finish(false));
      child.on('close', (code) => finish(code === 0));
      // ffmpeg may stop reading early; that is its close code's business, not an exception.
      child.stdin.on('error', () => { /* handled by close */ });
      child.stdin.end(media);
    });
  }
}
