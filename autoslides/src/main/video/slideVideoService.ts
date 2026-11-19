/**
 * Slide video: render a lecture's slides folder (+ `timeline.json`) and its
 * audio into one small MP4 with the bundled FFmpeg. The plan (what is shown
 * when, chapters, arguments) is `@common/slideVideo`; this file does the IO.
 *
 * Output goes beside the slides folder as `<folder>.mp4`, written to a hidden
 * partial file first and renamed over the target once FFmpeg finished and the
 * length checks out, so a failed or cancelled run never leaves a broken video
 * and an earlier video is only replaced by a good one.
 */
import fs from 'node:fs';
import path from 'node:path';
import { app } from 'electron';
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import type { FFmpegService } from '@main/infra/ffmpegService';
import { sharpService } from '@main/infra/sharpService';
import { createLogger } from '@main/infra/logger';
import {
  lastFfmpegTime,
  parseFfmpegProbe,
  planSlideVideo,
  slideVideoCanvas,
  slideVideoConcatList,
  slideVideoFfmpegArgs,
  slideVideoFileName,
  slideVideoMetadata,
  slideVideoOrigin,
  slideVideoSegments,
  sortSlideImages,
  type SlideVideoOptions,
  type SlideVideoProbe,
} from '@common/slideVideo';
import type { SlideTimeline } from '@common/sidecars';

const log = createLogger('SlideVideo');

export interface SlideVideoProgress {
  phase: 'preparing' | 'encoding' | 'finishing';
  /** 0–100. */
  percent: number;
}

export interface SlideVideoJob {
  slidesFolder: string;
  timeline: SlideTimeline;
  /** Audio file (screen recording or mic `.aac`), already chosen and checked by the caller. */
  audioPath: string | null;
  options: SlideVideoOptions;
}

export interface SlideVideoResult {
  outputPath: string;
  durationSeconds: number;
  chapters: number;
}

export class SlideVideoCancelledError extends Error {
  constructor() {
    super('Slide video cancelled');
    this.name = 'SlideVideoCancelledError';
  }
}

let tempCounter = 0;

/** PNG width/height from the IHDR chunk; other formats through sharp. */
async function readImageSize(filePath: string): Promise<{ width: number; height: number } | null> {
  try {
    const handle = await fs.promises.open(filePath, 'r');
    try {
      const head = Buffer.alloc(24);
      await handle.read(head, 0, 24, 0);
      if (head.readUInt32BE(0) === 0x89504e47 && head.toString('ascii', 12, 16) === 'IHDR') {
        return { width: head.readUInt32BE(16), height: head.readUInt32BE(20) };
      }
    } finally {
      await handle.close();
    }
    return await sharpService.getImageDimensions(await fs.promises.readFile(filePath));
  } catch {
    return null;
  }
}

export class SlideVideoService {
  private child: ChildProcessWithoutNullStreams | null = null;
  private running = false;
  private cancelRequested = false;

  constructor(private ffmpegService: FFmpegService) {}

  isActive(): boolean {
    return this.running;
  }

  cancel(): boolean {
    if (!this.running) return false;
    this.cancelRequested = true;
    try {
      this.child?.kill('SIGKILL');
    } catch {
      // already gone
    }
    return true;
  }

  async make(job: SlideVideoJob, onProgress: (progress: SlideVideoProgress) => void): Promise<SlideVideoResult> {
    if (this.running) throw new Error('A slide video is already being made');
    this.running = true;
    this.cancelRequested = false;

    const folder = path.resolve(job.slidesFolder);
    const outputPath = path.join(path.dirname(folder), slideVideoFileName(path.basename(folder)));
    const partialPath = path.join(path.dirname(outputPath), `.${path.basename(outputPath, '.mp4')}.${process.pid}-${++tempCounter}.partial.mp4`);
    const workDir = path.join(app.getPath('temp'), 'AutoSlides', `slide-video-${process.pid}-${tempCounter}`);

    try {
      const ffmpeg = this.ffmpegService.getFfmpegPath();
      if (!ffmpeg) throw new Error('FFmpeg is not available');
      onProgress({ phase: 'preparing', percent: 0 });

      // --- what to show, and when ---------------------------------------------
      const pages = sortSlideImages(await fs.promises.readdir(folder));
      const present = new Set(pages);
      const segments = slideVideoSegments(job.timeline, (file) => present.has(file));
      if (!segments.some((segment) => segment.file)) {
        throw new Error('No slide on the timeline is still in the folder');
      }

      // --- audio sets the length -----------------------------------------------
      let endSeconds: number | null = null;
      if (job.audioPath) {
        const probe = await this.probeAudio(ffmpeg, job.audioPath);
        if (!probe.hasAudio) throw new Error(`No audio track in ${path.basename(job.audioPath)}`);
        endSeconds = probe.durationSeconds;
      }
      if (endSeconds == null) {
        const duration = job.timeline.source?.duration;
        if (typeof duration === 'number' && duration > 0) endSeconds = duration;
      }
      const plan = planSlideVideo({
        segments,
        origin: slideVideoOrigin(job.timeline),
        endSeconds,
        pages,
        repeatSeconds: job.options.repeatSeconds,
      });
      if (!plan.entries.length) throw new Error('Nothing to encode');
      this.checkCancelled();

      // --- canvas: the most common slide size ----------------------------------
      const sizes = await Promise.all(
        [...new Set(segments.map((segment) => segment.file).filter((file): file is string => !!file))]
          .map((file) => readImageSize(path.join(folder, file))),
      );
      const canvas = slideVideoCanvas(
        sizes.filter((size): size is { width: number; height: number } => !!size),
        job.options.resolution,
      );

      // --- inputs for FFmpeg ----------------------------------------------------
      await fs.promises.mkdir(workDir, { recursive: true });
      const needsBlack = plan.entries.some((entry) => !segments[entry.segment].file);
      const blackPath = path.join(workDir, 'black.png');
      if (needsBlack) {
        await this.run(ffmpeg, [
          '-hide_banner', '-nostdin', '-y', '-f', 'lavfi', '-i', `color=c=black:s=${canvas.width}x${canvas.height}`,
          '-frames:v', '1', blackPath,
        ]);
      }
      const concatPath = path.join(workDir, 'slides.ffconcat');
      const metadataPath = path.join(workDir, 'metadata.txt');
      await fs.promises.writeFile(concatPath, slideVideoConcatList(plan.entries, (index) => {
        const file = segments[index].file;
        return file ? path.join(folder, file) : blackPath;
      }));
      const title = path.basename(folder).replace(/^slides_/, '');
      await fs.promises.writeFile(metadataPath, slideVideoMetadata(title, plan.chapters));
      this.checkCancelled();

      // --- encode -----------------------------------------------------------------
      const args = slideVideoFfmpegArgs({
        concatPath,
        audioPath: job.audioPath,
        metadataPath,
        outputPath: partialPath,
        width: canvas.width,
        height: canvas.height,
        durationSeconds: plan.durationSeconds,
        options: job.options,
      });
      log.info('Making slide video', outputPath, `${canvas.width}x${canvas.height}`, `${plan.entries.length} frames`);
      onProgress({ phase: 'encoding', percent: 0 });
      await this.run(ffmpeg, args, (seconds) => {
        onProgress({ phase: 'encoding', percent: Math.min(99, Math.floor((seconds / plan.durationSeconds) * 100)) });
      });
      this.checkCancelled();

      // --- check, then publish ------------------------------------------------------
      onProgress({ phase: 'finishing', percent: 99 });
      const made = parseFfmpegProbe(await this.probe(ffmpeg, partialPath));
      const tolerance = Math.max(2, plan.durationSeconds * 0.02);
      if (made.durationSeconds == null || Math.abs(made.durationSeconds - plan.durationSeconds) > tolerance) {
        throw new Error(
          `Video length check failed (expected ${plan.durationSeconds.toFixed(1)} s, got ${made.durationSeconds?.toFixed(1) ?? 'none'})`,
        );
      }
      if (process.platform === 'win32' && fs.existsSync(outputPath)) await fs.promises.unlink(outputPath);
      await fs.promises.rename(partialPath, outputPath);
      onProgress({ phase: 'finishing', percent: 100 });
      return { outputPath, durationSeconds: plan.durationSeconds, chapters: plan.chapters.length };
    } catch (error) {
      if (this.cancelRequested) throw new SlideVideoCancelledError();
      throw error;
    } finally {
      await fs.promises.rm(partialPath, { force: true }).catch(() => undefined);
      await fs.promises.rm(workDir, { recursive: true, force: true }).catch(() => undefined);
      this.child = null;
      this.running = false;
      this.cancelRequested = false;
    }
  }

  private checkCancelled(): void {
    if (this.cancelRequested) throw new SlideVideoCancelledError();
  }

  /** `ffmpeg -i` prints the container header; no ffprobe needed. */
  private async probe(ffmpeg: string, filePath: string): Promise<string> {
    return (await this.run(ffmpeg, ['-hide_banner', '-nostdin', '-i', filePath], undefined, true)).stderr;
  }

  /**
   * Audio length. A raw `.aac` (ADTS, the classroom mic) has no index, so its
   * header length is only an estimate from the bitrate; read it through
   * instead (stream copy, no decoding).
   */
  private async probeAudio(ffmpeg: string, filePath: string): Promise<SlideVideoProbe> {
    const header = parseFfmpegProbe(await this.probe(ffmpeg, filePath));
    if (!header.hasAudio || path.extname(filePath).toLowerCase() !== '.aac') return header;
    const scan = await this.run(ffmpeg, ['-hide_banner', '-nostdin', '-i', filePath, '-map', '0:a:0', '-c', 'copy', '-f', 'null', '-']);
    return { hasAudio: true, durationSeconds: lastFfmpegTime(scan.stderr) ?? header.durationSeconds };
  }

  private run(
    executable: string,
    args: string[],
    onTime?: (seconds: number) => void,
    allowFailure = false,
  ): Promise<{ stderr: string }> {
    return new Promise((resolve, reject) => {
      const child = spawn(executable, args, { windowsHide: true });
      this.child = child;
      let stderr = '';
      child.stdout.resume();
      child.stderr.on('data', (data: Buffer) => {
        const chunk = data.toString();
        // Keep the header (probe) and the tail (errors); the middle is progress lines.
        stderr = stderr.length < 64_000 ? stderr + chunk : stderr.slice(0, 32_000) + stderr.slice(-16_000) + chunk;
        if (onTime) {
          const seconds = lastFfmpegTime(chunk);
          if (seconds != null) onTime(seconds);
        }
      });
      child.on('error', (error) => {
        this.child = null;
        reject(this.cancelRequested ? new SlideVideoCancelledError() : error);
      });
      child.on('close', (code, signal) => {
        this.child = null;
        if (this.cancelRequested) {
          reject(new SlideVideoCancelledError());
        } else if (code === 0 || allowFailure) {
          resolve({ stderr });
        } else {
          reject(new Error(`ffmpeg exited with code ${code ?? 'null'} signal ${signal ?? 'null'}: ${stderr.slice(-2000)}`));
        }
      });
    });
  }
}
