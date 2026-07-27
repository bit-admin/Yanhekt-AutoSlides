import { spawn } from 'child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { app } from 'electron';
import type { FFmpegService } from '@main/infra/ffmpegService';
import { expandTilde, hasTraversalSegment, isPathInsideRoot } from '@main/infra/pathUtils';
import type { ConfigService } from '@main/platform/configService';
import { createLogger } from '@main/infra/logger';

const log = createLogger('LocalLecturePoster');

const FFMPEG_TIMEOUT_MS = 20000;
const DEFAULT_SEEK_SECONDS = 30;

/**
 * Single-frame JPEG posters for local lecture files (Library cards).
 * Cached under userData/lecture-posters by path+size+mtime.
 */
export class LocalLecturePosterService {
  constructor(
    private configService: ConfigService,
    private ffmpegService: FFmpegService,
  ) {}

  async getPoster(
    filePath: string,
    seekSeconds?: number,
  ): Promise<string | null> {
    if (!filePath || hasTraversalSegment(filePath)) return null;

    const outputDir = expandTilde(this.configService.getConfig().outputDirectory);
    if (!isPathInsideRoot(outputDir, filePath)) {
      log.warn('Poster path outside outputDirectory:', filePath);
      return null;
    }

    const resolved = path.resolve(filePath);
    let stat: fs.Stats;
    try {
      stat = await fs.promises.stat(resolved);
    } catch {
      return null;
    }
    if (!stat.isFile()) return null;

    const cachePath = this.cachePathFor(resolved, stat.size, stat.mtimeMs);
    try {
      if (fs.existsSync(cachePath)) {
        const buf = await fs.promises.readFile(cachePath);
        if (buf.length > 0) {
          return `data:image/jpeg;base64,${buf.toString('base64')}`;
        }
      }
    } catch {
      // regenerate
    }

    const ffmpegPath = this.ffmpegService.getFfmpegPath();
    if (!ffmpegPath) return null;

    const seek = Number.isFinite(seekSeconds) && (seekSeconds as number) >= 0
      ? (seekSeconds as number)
      : DEFAULT_SEEK_SECONDS;

    try {
      const buffer = await this.grabFrame(ffmpegPath, resolved, seek);
      if (!buffer || buffer.length === 0) return null;
      await this.writeCache(cachePath, buffer);
      return `data:image/jpeg;base64,${buffer.toString('base64')}`;
    } catch (error) {
      log.warn('Failed to generate local lecture poster:', error);
      return null;
    }
  }

  private cachePathFor(absPath: string, size: number, mtimeMs: number): string {
    const key = crypto
      .createHash('sha1')
      .update(`${absPath}|${size}|${mtimeMs}`)
      .digest('hex');
    return path.join(app.getPath('userData'), 'lecture-posters', `${key}.jpg`);
  }

  private async writeCache(cachePath: string, buffer: Buffer): Promise<void> {
    try {
      await fs.promises.mkdir(path.dirname(cachePath), { recursive: true });
      await fs.promises.writeFile(cachePath, buffer);
    } catch (error) {
      log.warn('Failed to write poster cache:', error);
    }
  }

  private grabFrame(
    ffmpegPath: string,
    inputPath: string,
    seekSeconds: number,
  ): Promise<Buffer | null> {
    return new Promise((resolve) => {
      const args = [
        '-hide_banner',
        '-loglevel',
        'error',
        '-ss',
        String(seekSeconds),
        '-i',
        inputPath,
        '-frames:v',
        '1',
        '-f',
        'image2pipe',
        '-vcodec',
        'mjpeg',
        'pipe:1',
      ];

      const child = spawn(ffmpegPath, args, { stdio: ['ignore', 'pipe', 'pipe'] });
      const chunks: Buffer[] = [];
      let settled = false;

      const finish = (buf: Buffer | null) => {
        if (settled) return;
        settled = true;
        resolve(buf);
      };

      const timer = setTimeout(() => {
        try {
          child.kill('SIGKILL');
        } catch {
          /* ignore */
        }
        finish(null);
      }, FFMPEG_TIMEOUT_MS);

      child.stdout.on('data', (c: Buffer) => chunks.push(c));
      child.on('error', () => {
        clearTimeout(timer);
        finish(null);
      });
      child.on('close', (code) => {
        clearTimeout(timer);
        if (code === 0 && chunks.length) {
          finish(Buffer.concat(chunks));
        } else {
          // Retry from t=0 if mid-file seek failed (short files / sparse keyframes).
          if (seekSeconds > 0) {
            void this.grabFrame(ffmpegPath, inputPath, 0).then(finish);
          } else {
            finish(null);
          }
        }
      });
    });
  }
}
