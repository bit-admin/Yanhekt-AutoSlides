import fs from 'node:fs';
import path from 'node:path';
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { FFmpegService } from './ffmpegService';

export type CompressLecturePreset = 'tiny' | 'small' | 'readable';
export type CompressLectureAudioPreset = 'low' | 'mid' | 'high' | 'max';
export type CompressLectureAudioFilterPreset = 'none' | 'clean' | 'speech' | 'strong' | 'loudnorm';
export type CompressLectureCropMode = 'none' | '4:3' | 'auto';
export type CompressLectureFilterMode = 'none' | 'denoise' | 'sharpen' | 'both';
export type CompressLectureScaler = 'lanczos' | 'bicubic';
export type CompressLectureContainer = 'mp4' | 'mkv';
export type CompressLectureOpusVbr = 'on' | 'constrained' | 'off';
export type CompressLectureContentAspect = '4:3' | '16:9' | 'cropped' | 'source';

export interface CompressLectureOptions {
  inputPath: string;
  outputPath?: string;
  preset?: CompressLecturePreset;
  audioPreset?: CompressLectureAudioPreset;
  audioFilterPreset?: CompressLectureAudioFilterPreset;
  cropMode?: CompressLectureCropMode;
  filterMode?: CompressLectureFilterMode;
  scaler?: CompressLectureScaler;
  container?: CompressLectureContainer;
  opusVbr?: CompressLectureOpusVbr;
  opusFrameDuration?: 20 | 40 | 60;
  keepAac?: boolean;
  x265Params?: string;
}

export interface CompressLectureProgress {
  phase: 'preparing' | 'cropdetect' | 'encoding' | 'completed';
  current: number;
  total: number;
  message?: string;
}

export interface CompressLecturePreviewResult {
  command: string;
  outputPath: string;
  sourceWidth: number;
  sourceHeight: number;
  targetWidth: number;
  targetHeight: number;
  contentAspect: CompressLectureContentAspect;
  videoFiltergraph: string;
  audioFiltergraph: string;
}

interface NormalizedOptions {
  inputPath: string;
  outputPath?: string;
  preset: CompressLecturePreset;
  audioPreset: CompressLectureAudioPreset;
  audioFilterPreset: CompressLectureAudioFilterPreset;
  cropMode: CompressLectureCropMode;
  filterMode: CompressLectureFilterMode;
  scaler: CompressLectureScaler;
  container: CompressLectureContainer;
  opusVbr: CompressLectureOpusVbr;
  opusFrameDuration: 20 | 40 | 60;
  keepAac: boolean;
  x265Params: string;
}

interface ProbeResult {
  width: number;
  height: number;
  durationSeconds: number;
}

interface BuildResult {
  ffmpegPath: string;
  ffmpegArgs: string[];
  command: string;
  outputPath: string;
  sourceWidth: number;
  sourceHeight: number;
  targetWidth: number;
  targetHeight: number;
  contentAspect: CompressLectureContentAspect;
  durationSeconds: number;
  videoFiltergraph: string;
  audioFiltergraph: string;
}

const PRESET_MAP: Record<CompressLecturePreset, { fps: number; crf: number; gop: number; targetHeight: 360 | 480 | 540 }> = {
  tiny: { fps: 1, crf: 36, gop: 120, targetHeight: 360 },
  small: { fps: 2, crf: 34, gop: 240, targetHeight: 480 },
  readable: { fps: 3, crf: 32, gop: 360, targetHeight: 540 },
};

const WIDTH_MAP_43: Record<360 | 480 | 540, number> = {
  360: 480,
  480: 640,
  540: 720,
};

const WIDTH_MAP_DEFAULT: Record<360 | 480 | 540, number> = {
  360: 640,
  480: 854,
  540: 960,
};

const AUDIO_BITRATE_MAP: Record<CompressLectureAudioPreset, string> = {
  low: '16k',
  mid: '24k',
  high: '32k',
  max: '40k',
};

const AUDIO_FILTER_MAP: Record<CompressLectureAudioFilterPreset, string> = {
  none: '',
  clean: 'highpass=f=80,afftdn=nr=6:nf=-35:tn=1',
  speech: 'highpass=f=80,afftdn=nr=8:nf=-35:tn=1,speechnorm=e=6.25:r=0.00001:l=1',
  strong: 'highpass=f=100,afftdn=nr=12:nf=-35:tn=1,speechnorm=e=12.5:r=0.0001:l=1',
  loudnorm: 'highpass=f=80,afftdn=nr=8:nf=-35:tn=1,loudnorm=I=-16:LRA=11:TP=-1.5',
};

const DENOISE_FILTER = 'hqdn3d=1.0:1.0:4.0:4.0';
const SHARPEN_FILTER = 'unsharp=5:5:0.6:5:5:0.0';
const SHARPEN_FILTER_BOTH = 'unsharp=5:5:0.5:5:5:0.0';

export class CompressLectureService {
  private ffmpegService: FFmpegService;
  private activeProcess: ChildProcessWithoutNullStreams | null = null;
  private isRunningTask = false;
  private cancelRequested = false;
  private activeOutputPath: string | null = null;

  constructor(ffmpegService: FFmpegService) {
    this.ffmpegService = ffmpegService;
  }

  isActive(): boolean {
    return this.isRunningTask;
  }

  cancel(): boolean {
    if (!this.isRunningTask) {
      return false;
    }

    this.cancelRequested = true;

    if (this.activeProcess) {
      try {
        this.activeProcess.kill('SIGKILL');
      } catch {
        return false;
      }
    }

    return true;
  }

  async preview(options: CompressLectureOptions): Promise<CompressLecturePreviewResult> {
    if (this.isRunningTask) {
      throw new Error('Compression is currently running');
    }

    const built = await this.buildCommand(options);
    return {
      command: built.command,
      outputPath: built.outputPath,
      sourceWidth: built.sourceWidth,
      sourceHeight: built.sourceHeight,
      targetWidth: built.targetWidth,
      targetHeight: built.targetHeight,
      contentAspect: built.contentAspect,
      videoFiltergraph: built.videoFiltergraph,
      audioFiltergraph: built.audioFiltergraph,
    };
  }

  async start(
    options: CompressLectureOptions,
    onProgress: (progress: CompressLectureProgress) => void
  ): Promise<{ outputPath: string }> {
    if (this.isRunningTask) {
      throw new Error('Compression is already running');
    }

    this.isRunningTask = true;
    this.cancelRequested = false;
    this.activeOutputPath = null;

    try {
      const built = await this.buildCommand(options, onProgress);

      if (this.cancelRequested) {
        throw new Error('Compression cancelled by user');
      }

      this.activeOutputPath = built.outputPath;
      await this.runEncoding(built, onProgress);

      if (this.cancelRequested) {
        throw new Error('Compression cancelled by user');
      }

      onProgress({
        phase: 'completed',
        current: 100,
        total: 100,
        message: 'Completed',
      });

      return { outputPath: built.outputPath };
    } catch (error) {
      if (this.cancelRequested && this.activeOutputPath && fs.existsSync(this.activeOutputPath)) {
        try {
          fs.unlinkSync(this.activeOutputPath);
        } catch {
          // ignore cleanup failure
        }
      }
      throw error;
    } finally {
      this.activeProcess = null;
      this.isRunningTask = false;
      this.cancelRequested = false;
      this.activeOutputPath = null;
    }
  }

  private async buildCommand(
    options: CompressLectureOptions,
    onProgress?: (progress: CompressLectureProgress) => void
  ): Promise<BuildResult> {
    const normalized = this.normalizeOptions(options);
    this.validateOptions(normalized);

    if (onProgress) {
      onProgress({ phase: 'preparing', current: 0, total: 100, message: 'Probing source' });
    }

    const ffmpegPath = this.ffmpegService.getFfmpegPath();
    if (!ffmpegPath) {
      throw new Error('FFmpeg is not available');
    }

    const ffprobePath = await this.resolveFfprobePath(ffmpegPath);
    const probe = await this.probeInput(ffprobePath, normalized.inputPath);

    const cropResult = await this.resolveCropFilter(
      ffmpegPath,
      normalized,
      probe.width,
      probe.height,
      onProgress
    );

    const preset = PRESET_MAP[normalized.preset];
    const targetWidth = cropResult.contentAspect === '4:3'
      ? WIDTH_MAP_43[preset.targetHeight]
      : WIDTH_MAP_DEFAULT[preset.targetHeight];
    const targetHeight = preset.targetHeight;

    const scaleFilter = `scale=${targetWidth}:${targetHeight}:flags=${normalized.scaler}`;

    let denoiseFilter = '';
    let sharpenFilter = '';

    if (normalized.filterMode === 'denoise' || normalized.filterMode === 'both') {
      denoiseFilter = DENOISE_FILTER;
    }

    if (normalized.filterMode === 'sharpen') {
      sharpenFilter = SHARPEN_FILTER;
    } else if (normalized.filterMode === 'both') {
      sharpenFilter = SHARPEN_FILTER_BOTH;
    }

    const vfParts: string[] = [];
    if (cropResult.cropFilter) {
      vfParts.push(cropResult.cropFilter);
    }
    vfParts.push(`fps=${preset.fps}`);
    if (denoiseFilter) {
      vfParts.push(denoiseFilter);
    }
    vfParts.push(scaleFilter);
    if (sharpenFilter) {
      vfParts.push(sharpenFilter);
    }

    const videoFiltergraph = vfParts.join(',');
    const audioFiltergraph = AUDIO_FILTER_MAP[normalized.audioFilterPreset];
    const audioBitrate = AUDIO_BITRATE_MAP[normalized.audioPreset];

    const outputPath = this.resolveOutputPath(normalized);

    const ffmpegArgs: string[] = [
      '-hide_banner',
      '-y',
      '-i', normalized.inputPath,
      '-vf', videoFiltergraph,
    ];

    if (audioFiltergraph) {
      ffmpegArgs.push('-af', audioFiltergraph);
    }

    ffmpegArgs.push(
      '-c:v', 'libx265',
      '-preset', 'slow',
      '-crf', String(preset.crf),
      '-g', String(preset.gop),
      '-x265-params', normalized.x265Params
    );

    if (normalized.keepAac) {
      ffmpegArgs.push('-c:a', 'aac', '-b:a', audioBitrate, '-ac', '1');
    } else {
      ffmpegArgs.push(
        '-c:a', 'libopus',
        '-b:a', audioBitrate,
        '-ac', '1',
        '-vbr', normalized.opusVbr,
        '-compression_level', '10',
        '-frame_duration', String(normalized.opusFrameDuration)
      );
    }

    if (normalized.container === 'mp4') {
      ffmpegArgs.push('-movflags', '+faststart');
    }

    ffmpegArgs.push(outputPath);

    return {
      ffmpegPath,
      ffmpegArgs,
      command: this.toCommandString(ffmpegPath, ffmpegArgs),
      outputPath,
      sourceWidth: probe.width,
      sourceHeight: probe.height,
      targetWidth,
      targetHeight,
      contentAspect: cropResult.contentAspect,
      durationSeconds: probe.durationSeconds,
      videoFiltergraph,
      audioFiltergraph,
    };
  }

  private async runEncoding(
    built: BuildResult,
    onProgress: (progress: CompressLectureProgress) => void
  ): Promise<void> {
    await new Promise<void>((resolve, reject) => {
      this.activeProcess = spawn(built.ffmpegPath, built.ffmpegArgs);

      let stderrTail = '';

      this.activeProcess.stderr.on('data', (data: Buffer) => {
        const chunk = data.toString();
        stderrTail = (stderrTail + chunk).slice(-4000);

        const timeSeconds = this.extractLatestTimeSeconds(chunk);
        if (timeSeconds === null) {
          return;
        }

        const duration = built.durationSeconds > 0 ? built.durationSeconds : 3600;
        const progress = Math.min(Math.floor((timeSeconds / duration) * 100), 99);

        onProgress({
          phase: 'encoding',
          current: progress,
          total: 100,
          message: built.durationSeconds > 0 ? 'Encoding' : 'Encoding (estimated)',
        });
      });

      this.activeProcess.on('close', (code: number | null, signal: NodeJS.Signals | null) => {
        this.activeProcess = null;

        if (this.cancelRequested) {
          reject(new Error('Compression cancelled by user'));
          return;
        }

        if (code === 0) {
          onProgress({ phase: 'encoding', current: 100, total: 100, message: 'Finalizing' });
          resolve();
          return;
        }

        reject(new Error(`ffmpeg exited with code ${code ?? 'null'} signal ${signal ?? 'null'}${stderrTail ? `: ${stderrTail}` : ''}`));
      });

      this.activeProcess.on('error', (error: Error) => {
        this.activeProcess = null;

        if (this.cancelRequested) {
          reject(new Error('Compression cancelled by user'));
          return;
        }

        reject(error);
      });
    });
  }

  private async resolveCropFilter(
    ffmpegPath: string,
    options: NormalizedOptions,
    sourceWidth: number,
    sourceHeight: number,
    onProgress?: (progress: CompressLectureProgress) => void
  ): Promise<{ cropFilter: string; contentAspect: CompressLectureContentAspect }> {
    if (options.cropMode === 'none') {
      return { cropFilter: '', contentAspect: 'source' };
    }

    if (options.cropMode === '4:3') {
      const cropWidth = Math.floor((sourceHeight * 4) / 3);
      if (cropWidth > sourceWidth) {
        throw new Error('Source is too narrow for centered 4:3 crop');
      }

      const cropX = Math.floor((sourceWidth - cropWidth) / 2);
      return {
        cropFilter: `crop=${cropWidth}:${sourceHeight}:${cropX}:0`,
        contentAspect: '4:3',
      };
    }

    if (onProgress) {
      onProgress({ phase: 'cropdetect', current: 0, total: 100, message: 'Detecting crop area' });
    }

    const detectArgs = [
      '-hide_banner',
      '-ss', '00:00:20',
      '-t', '00:03:00',
      '-i', options.inputPath,
      '-vf', 'cropdetect=limit=24:round=2:reset=0',
      '-an',
      '-f', 'null',
      '-',
    ];

    const detectResult = await this.runAndCapture(ffmpegPath, detectArgs, true);
    const matches = detectResult.stderr.match(/crop=[0-9:]+/g) ?? [];
    const detectedCrop = matches.length > 0 ? matches[matches.length - 1] : '';

    if (!detectedCrop) {
      return { cropFilter: '', contentAspect: 'source' };
    }

    const raw = detectedCrop.replace('crop=', '').split(':').map((value) => parseInt(value, 10));
    if (raw.length < 2 || Number.isNaN(raw[0]) || Number.isNaN(raw[1]) || raw[1] === 0) {
      return { cropFilter: detectedCrop, contentAspect: 'cropped' };
    }

    const [detectedWidth, detectedHeight] = raw;

    if (detectedWidth * 3 === detectedHeight * 4) {
      return { cropFilter: detectedCrop, contentAspect: '4:3' };
    }

    if (detectedWidth * 9 === detectedHeight * 16) {
      return { cropFilter: detectedCrop, contentAspect: '16:9' };
    }

    return { cropFilter: detectedCrop, contentAspect: 'cropped' };
  }

  private normalizeOptions(options: CompressLectureOptions): NormalizedOptions {
    return {
      inputPath: options.inputPath,
      outputPath: options.outputPath,
      preset: options.preset ?? 'tiny',
      audioPreset: options.audioPreset ?? 'mid',
      audioFilterPreset: options.audioFilterPreset ?? 'speech',
      cropMode: options.cropMode ?? 'none',
      filterMode: options.filterMode ?? 'none',
      scaler: options.scaler ?? 'lanczos',
      container: options.container ?? 'mp4',
      opusVbr: options.opusVbr ?? 'constrained',
      opusFrameDuration: options.opusFrameDuration ?? 60,
      keepAac: options.keepAac ?? false,
      x265Params: options.x265Params?.trim() || 'aq-mode=1',
    };
  }

  private validateOptions(options: NormalizedOptions): void {
    if (!options.inputPath) {
      throw new Error('Input file is required');
    }

    if (!fs.existsSync(options.inputPath)) {
      throw new Error(`Input file not found: ${options.inputPath}`);
    }

    if (!['tiny', 'small', 'readable'].includes(options.preset)) {
      throw new Error(`Invalid preset: ${options.preset}`);
    }

    if (!['low', 'mid', 'high', 'max'].includes(options.audioPreset)) {
      throw new Error(`Invalid audio preset: ${options.audioPreset}`);
    }

    if (!['none', 'clean', 'speech', 'strong', 'loudnorm'].includes(options.audioFilterPreset)) {
      throw new Error(`Invalid audio filter preset: ${options.audioFilterPreset}`);
    }

    if (!['none', '4:3', 'auto'].includes(options.cropMode)) {
      throw new Error(`Invalid crop mode: ${options.cropMode}`);
    }

    if (!['none', 'denoise', 'sharpen', 'both'].includes(options.filterMode)) {
      throw new Error(`Invalid filter mode: ${options.filterMode}`);
    }

    if (!['lanczos', 'bicubic'].includes(options.scaler)) {
      throw new Error(`Invalid scaler: ${options.scaler}`);
    }

    if (!['mp4', 'mkv'].includes(options.container)) {
      throw new Error(`Invalid container: ${options.container}`);
    }

    if (!['on', 'constrained', 'off'].includes(options.opusVbr)) {
      throw new Error(`Invalid opus VBR mode: ${options.opusVbr}`);
    }

    if (![20, 40, 60].includes(options.opusFrameDuration)) {
      throw new Error(`Invalid opus frame duration: ${options.opusFrameDuration}`);
    }
  }

  private async resolveFfprobePath(ffmpegPath: string): Promise<string> {
    const ffprobeBinary = process.platform === 'win32' ? 'ffprobe.exe' : 'ffprobe';
    const adjacentPath = path.join(path.dirname(ffmpegPath), ffprobeBinary);

    if (fs.existsSync(adjacentPath)) {
      try {
        await this.runAndCapture(adjacentPath, ['-version']);
        return adjacentPath;
      } catch {
        // fall back to PATH binary
      }
    }

    try {
      await this.runAndCapture(ffprobeBinary, ['-version']);
      return ffprobeBinary;
    } catch {
      throw new Error('ffprobe is not available');
    }
  }

  private async probeInput(ffprobePath: string, inputPath: string): Promise<ProbeResult> {
    const args = [
      '-v', 'error',
      '-select_streams', 'v:0',
      '-show_entries', 'stream=width,height:format=duration',
      '-of', 'json',
      inputPath,
    ];

    const result = await this.runAndCapture(ffprobePath, args);

    let parsed: { streams?: Array<{ width?: number; height?: number }>; format?: { duration?: string } };
    try {
      parsed = JSON.parse(result.stdout);
    } catch {
      throw new Error('Failed to parse ffprobe output');
    }

    const stream = parsed.streams?.[0];
    const width = stream?.width ?? 0;
    const height = stream?.height ?? 0;
    const duration = Number(parsed.format?.duration ?? 0);

    if (!width || !height) {
      throw new Error('Failed to probe input dimensions');
    }

    return {
      width,
      height,
      durationSeconds: Number.isFinite(duration) ? duration : 0,
    };
  }

  private resolveOutputPath(options: NormalizedOptions): string {
    if (options.outputPath && options.outputPath.trim()) {
      return options.outputPath;
    }

    const inputDir = path.dirname(options.inputPath);
    const stem = path.basename(options.inputPath, path.extname(options.inputPath));

    const cropToken = this.toSafeFilenameToken(options.cropMode);
    const outputName = `${stem}_${options.preset}_${options.audioPreset}_${options.audioFilterPreset}_${cropToken}_${options.filterMode}.${options.container}`;

    return path.join(inputDir, outputName);
  }

  private toSafeFilenameToken(token: string): string {
    if (process.platform !== 'win32') {
      return token;
    }

    return token.replace(/[<>:"/\\|?*]/g, '_');
  }

  private async runAndCapture(
    executable: string,
    args: string[],
    allowNonZeroExit = false
  ): Promise<{ stdout: string; stderr: string }> {
    return await new Promise((resolve, reject) => {
      const child = spawn(executable, args);
      this.activeProcess = child;

      let stdout = '';
      let stderr = '';

      child.stdout.on('data', (data: Buffer) => {
        stdout += data.toString();
      });

      child.stderr.on('data', (data: Buffer) => {
        stderr += data.toString();
      });

      child.on('close', (code: number | null, signal: NodeJS.Signals | null) => {
        this.activeProcess = null;

        if (this.cancelRequested) {
          reject(new Error('Compression cancelled by user'));
          return;
        }

        if (!allowNonZeroExit && code !== 0) {
          const tail = stderr.slice(-2000);
          reject(new Error(`${executable} exited with code ${code ?? 'null'} signal ${signal ?? 'null'}${tail ? `: ${tail}` : ''}`));
          return;
        }

        resolve({ stdout, stderr });
      });

      child.on('error', (error: Error) => {
        this.activeProcess = null;

        if (this.cancelRequested) {
          reject(new Error('Compression cancelled by user'));
          return;
        }

        reject(error);
      });
    });
  }

  private extractLatestTimeSeconds(chunk: string): number | null {
    const matches = [...chunk.matchAll(/time=(\d{2}):(\d{2}):(\d{2}(?:\.\d+)?)/g)];
    if (matches.length === 0) {
      return null;
    }

    const last = matches[matches.length - 1];
    const hours = parseInt(last[1], 10);
    const minutes = parseInt(last[2], 10);
    const seconds = parseFloat(last[3]);

    if (Number.isNaN(hours) || Number.isNaN(minutes) || Number.isNaN(seconds)) {
      return null;
    }

    return hours * 3600 + minutes * 60 + seconds;
  }

  private toCommandString(executable: string, args: string[]): string {
    return [executable, ...args].map((arg) => this.quoteArg(arg)).join(' ');
  }

  private quoteArg(value: string): string {
    if (/^[A-Za-z0-9_./:@%+=,-]+$/.test(value)) {
      return value;
    }

    return `'${value.replace(/'/g, `'\\''`)}'`;
  }
}
