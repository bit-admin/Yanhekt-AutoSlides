import { spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { app } from 'electron';
import type { VideoProxyService } from './videoProxyService';
import type { FFmpegService } from '@main/infra/ffmpegService';

export interface ScreenThumbnailRequest {
  kind: 'live' | 'recorded';
  /** Raw screen-recording m3u8 url (target_vga for live, session vga_url for recorded). */
  screenUrl: string;
  seekSeconds: number;
  /** Stable cache key: course id for live, session video_id for recorded. */
  cacheKey: string;
  token: string;
}

// Headers required when ffmpeg hits a direct (non-proxied) yanhekt URL, i.e.
// external-mode live streams. The localhost proxy injects these itself.
const ORIGIN = 'https://www.yanhekt.cn';
const REFERER = 'https://www.yanhekt.cn/';
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36';

const FFMPEG_TIMEOUT_MS = 15000;
const LIVE_TTL_MS = 60000;

/**
 * Generates a single-frame JPEG preview from a lecture's Screen Recording
 * stream. Resolves the raw m3u8 to a playable URL via the video proxy (so
 * anti-hotlink signing / intranet rewriting are reused), then runs ffmpeg to
 * grab one frame. Returns a base64 data URL, or null on any failure (a missing
 * preview must never break the UI).
 */
export class ThumbnailService {
  private liveCache = new Map<string, { dataUrl: string; ts: number }>();

  constructor(
    private videoProxyService: VideoProxyService,
    private ffmpegService: FFmpegService
  ) {}

  async getScreenThumbnail(req: ScreenThumbnailRequest): Promise<string | null> {
    if (!req.screenUrl || !req.cacheKey || !req.token) return null;

    // Cache hits first.
    if (req.kind === 'recorded') {
      const cached = this.readDiskCache(req.cacheKey);
      if (cached) return cached;
    } else {
      const entry = this.liveCache.get(req.cacheKey);
      if (entry && Date.now() - entry.ts < LIVE_TTL_MS) return entry.dataUrl;
    }

    const ffmpegPath = this.ffmpegService.getFfmpegPath();
    if (!ffmpegPath) return null;

    try {
      const playableUrl = await this.resolvePlayableUrl(req);
      if (!playableUrl) return null;

      const buffer = await this.grabFrame(ffmpegPath, playableUrl, req.seekSeconds);
      if (!buffer || buffer.length === 0) return null;

      const dataUrl = `data:image/jpeg;base64,${buffer.toString('base64')}`;
      if (req.kind === 'recorded') {
        this.writeDiskCache(req.cacheKey, buffer);
      } else {
        this.liveCache.set(req.cacheKey, { dataUrl, ts: Date.now() });
      }
      return dataUrl;
    } catch (error) {
      console.error('[thumbnail] Failed to generate preview:', error);
      return null;
    } finally {
      // getVideoPlaybackUrls (recorded path) starts the proxy's token-refresh
      // loop; stop it once this one-shot grab is done, unless a real playback is
      // keeping it alive.
      if (req.kind === 'recorded') {
        this.videoProxyService.stopSignatureLoopIfIdle();
      }
    }
  }

  private async resolvePlayableUrl(req: ScreenThumbnailRequest): Promise<string> {
    if (req.kind === 'recorded') {
      const result = await this.videoProxyService.getVideoPlaybackUrls(
        { video_id: req.cacheKey, title: '', vga_url: req.screenUrl },
        req.token
      );
      return result.streams.vga?.url || '';
    }
    const result = await this.videoProxyService.getLiveStreamUrls(
      { id: req.cacheKey, title: '', target_vga: req.screenUrl },
      req.token
    );
    return result.streams.screen?.url || '';
  }

  private grabFrame(ffmpegPath: string, url: string, seekSeconds: number): Promise<Buffer | null> {
    const needsHeaders = !url.startsWith('http://localhost');
    const args: string[] = [];
    if (needsHeaders) {
      args.push('-headers', `Origin: ${ORIGIN}\r\nReferer: ${REFERER}\r\nUser-Agent: ${USER_AGENT}\r\n`);
    }
    args.push(
      '-nostdin',
      '-ss', String(seekSeconds),
      '-i', url,
      '-frames:v', '1',
      '-an',
      '-vf', 'scale=640:-2',
      '-f', 'image2pipe',
      '-vcodec', 'mjpeg',
      '-q:v', '4',
      'pipe:1'
    );

    return new Promise((resolve) => {
      const chunks: Buffer[] = [];
      let settled = false;
      const child = spawn(ffmpegPath, args, { stdio: ['ignore', 'pipe', 'ignore'] });

      const timer = setTimeout(() => {
        if (settled) return;
        settled = true;
        try { child.kill('SIGKILL'); } catch { /* already gone */ }
        resolve(null);
      }, FFMPEG_TIMEOUT_MS);

      child.stdout.on('data', (chunk: Buffer) => chunks.push(chunk));
      child.on('error', () => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve(null);
      });
      child.on('close', (code) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve(code === 0 && chunks.length > 0 ? Buffer.concat(chunks) : null);
      });
    });
  }

  private cachePath(cacheKey: string): string {
    // cacheKey is typed string but the backend can send a numeric video_id, so
    // coerce before string ops.
    const safe = String(cacheKey).replace(/[^a-zA-Z0-9_-]/g, '_');
    return path.join(app.getPath('userData'), 'thumbnails', `${safe}.jpg`);
  }

  private readDiskCache(cacheKey: string): string | null {
    try {
      const file = this.cachePath(cacheKey);
      if (!fs.existsSync(file)) return null;
      const buffer = fs.readFileSync(file);
      if (buffer.length === 0) return null;
      return `data:image/jpeg;base64,${buffer.toString('base64')}`;
    } catch {
      return null;
    }
  }

  private writeDiskCache(cacheKey: string, buffer: Buffer): void {
    try {
      const file = this.cachePath(cacheKey);
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, buffer);
    } catch (error) {
      console.error('[thumbnail] Failed to write disk cache:', error);
    }
  }
}
