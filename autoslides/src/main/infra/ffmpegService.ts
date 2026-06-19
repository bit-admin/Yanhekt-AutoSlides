
import path from 'path';
import fs from 'fs';
import { execSync } from 'child_process';
import { createLogger } from '@main/infra/logger';
const log = createLogger('Ffmpeg');

export class FFmpegService {
  private ffmpegPath: string | null = null;
  private resolved = false;
  private ffprobePath: string | null = null;
  private ffprobeResolved = false;

  /**
   * Resolve the FFmpeg path lazily on first access. The probing runs up to a
   * few synchronous execSync calls, so we keep it off the startup/import path
   * and run it once, on first actual use, caching the result.
   */
  private ensureResolved(): void {
    if (this.resolved) return;
    this.resolved = true;
    this.initializeFfmpegPath();
  }

  /**
   * Ensure FFmpeg binary has execute permissions on Linux/macOS
   */
  private ensureExecutePermission(filePath: string): void {
    if (process.platform === 'win32') return;

    try {
      const stats = fs.statSync(filePath);
      const mode = stats.mode;
      // Check if owner execute bit is set (0o100)
      if ((mode & 0o100) === 0) {
        // Add execute permission for owner, group, and others
        fs.chmodSync(filePath, mode | 0o111);
        log.debug('Added execute permission to FFmpeg binary:', filePath);
      }
    } catch (error) {
      log.error('Failed to set execute permission on FFmpeg:', error);
    }
  }

  /**
   * Test if an FFmpeg binary works by running -version
   */
  private testFfmpegBinary(ffmpegPath: string): boolean {
    try {
      execSync(`"${ffmpegPath}" -version`, { stdio: 'pipe', timeout: 5000 });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Try to find system FFmpeg (Linux/macOS)
   */
  private findSystemFfmpeg(): string | null {
    if (process.platform === 'win32') return null;

    try {
      // Use 'which' to find ffmpeg in PATH
      const result = execSync('which ffmpeg', { stdio: 'pipe', timeout: 5000 });
      const systemPath = result.toString().trim();
      if (systemPath && fs.existsSync(systemPath)) {
        log.debug('Found system FFmpeg:', systemPath);
        return systemPath;
      }
    } catch {
      // which command failed, ffmpeg not in PATH
    }

    // Try common installation paths on Linux
    const commonPaths = [
      '/usr/bin/ffmpeg',
      '/usr/local/bin/ffmpeg',
      '/opt/homebrew/bin/ffmpeg', // macOS Homebrew ARM
      '/usr/local/opt/ffmpeg/bin/ffmpeg' // macOS Homebrew Intel
    ];

    for (const p of commonPaths) {
      if (fs.existsSync(p)) {
        log.debug('Found FFmpeg at common path:', p);
        return p;
      }
    }

    return null;
  }

  private initializeFfmpegPath(): void {
    let staticFfmpegPath: string | null = null;

    try {
      // In packaged app, check extraResource first
      if (process.resourcesPath) {
        // Try extraResource path first (packaged app)
        const ffmpegBinary = process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg';
        const extraResourcePath = path.join(process.resourcesPath, 'ffmpeg-static', ffmpegBinary);
        log.debug('Checking extraResource path:', extraResourcePath);
        log.debug('Platform:', process.platform);
        log.debug('Resources path:', process.resourcesPath);

        if (fs.existsSync(extraResourcePath)) {
          this.ensureExecutePermission(extraResourcePath);
          staticFfmpegPath = extraResourcePath;
        } else {
          log.debug('extraResource path does not exist');
        }
      }

      // Fallback to ffmpeg-static npm package (development)
      if (!staticFfmpegPath) {
        try {
          // Use dynamic require to avoid module resolution errors in packaged app
          // eslint-disable-next-line @typescript-eslint/no-require-imports
          const ffmpegStatic = require('ffmpeg-static');
          if (ffmpegStatic && fs.existsSync(ffmpegStatic)) {
            this.ensureExecutePermission(ffmpegStatic);
            staticFfmpegPath = ffmpegStatic;
          }
        } catch (error) {
          log.debug('ffmpeg-static npm package not available:', error);
        }
      }

      // Test the static binary - on Linux it may crash (SIGSEGV) due to compatibility issues
      if (staticFfmpegPath) {
        log.debug('Testing static FFmpeg binary:', staticFfmpegPath);
        if (this.testFfmpegBinary(staticFfmpegPath)) {
          this.ffmpegPath = staticFfmpegPath;
          log.debug('FFmpeg path (static binary works):', this.ffmpegPath);
          return;
        } else {
          log.debug('Static FFmpeg binary failed test, will try system FFmpeg');
        }
      }

      // On Linux/macOS, try system FFmpeg as fallback
      if (process.platform !== 'win32') {
        const systemFfmpeg = this.findSystemFfmpeg();
        if (systemFfmpeg && this.testFfmpegBinary(systemFfmpeg)) {
          this.ffmpegPath = systemFfmpeg;
          log.debug('FFmpeg path (system):', this.ffmpegPath);
          return;
        }
      }

      // Last resort: use static path even if test failed (might work for some operations)
      if (staticFfmpegPath) {
        this.ffmpegPath = staticFfmpegPath;
        log.debug('FFmpeg path (static, untested):', this.ffmpegPath);
      } else {
        log.error('No FFmpeg binary found');
        this.ffmpegPath = null;
      }
    } catch (error) {
      log.error('FFmpeg initialization failed:', error);
      this.ffmpegPath = null;
    }
  }

  /**
   * Resolve the ffprobe path lazily on first access, mirroring the ffmpeg
   * resolution. ffprobe is shipped by the `ffprobe-static` package (it is NOT
   * part of `ffmpeg-static`), bundled into the packaged app via extraResource.
   */
  private ensureFfprobeResolved(): void {
    if (this.ffprobeResolved) return;
    this.ffprobeResolved = true;
    this.initializeFfprobePath();
  }

  /**
   * Try to find system ffprobe (Linux/macOS) — used only as a fallback when the
   * bundled binary is unavailable.
   */
  private findSystemFfprobe(): string | null {
    if (process.platform === 'win32') return null;

    try {
      const result = execSync('which ffprobe', { stdio: 'pipe', timeout: 5000 });
      const systemPath = result.toString().trim();
      if (systemPath && fs.existsSync(systemPath)) {
        log.debug('Found system ffprobe:', systemPath);
        return systemPath;
      }
    } catch {
      // ffprobe not in PATH
    }

    const commonPaths = [
      '/usr/bin/ffprobe',
      '/usr/local/bin/ffprobe',
      '/opt/homebrew/bin/ffprobe',
      '/usr/local/opt/ffmpeg/bin/ffprobe'
    ];

    for (const p of commonPaths) {
      if (fs.existsSync(p)) {
        log.debug('Found ffprobe at common path:', p);
        return p;
      }
    }

    return null;
  }

  private initializeFfprobePath(): void {
    const ffprobeBinary = process.platform === 'win32' ? 'ffprobe.exe' : 'ffprobe';
    let staticFfprobePath: string | null = null;

    try {
      // In packaged app, check extraResource first.
      // ffprobe-static ships per-platform/arch binaries: bin/<platform>/<arch>/ffprobe
      if (process.resourcesPath) {
        const extraResourcePath = path.join(
          process.resourcesPath,
          'ffprobe-static',
          'bin',
          process.platform,
          process.arch,
          ffprobeBinary
        );
        log.debug('Checking ffprobe extraResource path:', extraResourcePath);

        if (fs.existsSync(extraResourcePath)) {
          this.ensureExecutePermission(extraResourcePath);
          staticFfprobePath = extraResourcePath;
        } else {
          log.debug('ffprobe extraResource path does not exist');
        }
      }

      // Fallback to ffprobe-static npm package (development)
      if (!staticFfprobePath) {
        try {
          // eslint-disable-next-line @typescript-eslint/no-require-imports
          const ffprobeStatic = require('ffprobe-static');
          const pkgPath: string | undefined = ffprobeStatic?.path;
          if (pkgPath && fs.existsSync(pkgPath)) {
            this.ensureExecutePermission(pkgPath);
            staticFfprobePath = pkgPath;
          }
        } catch (error) {
          log.debug('ffprobe-static npm package not available:', error);
        }
      }

      // Prefer the bundled/static binary when it works.
      if (staticFfprobePath && this.testFfmpegBinary(staticFfprobePath)) {
        this.ffprobePath = staticFfprobePath;
        log.debug('ffprobe path (static binary works):', this.ffprobePath);
        return;
      }

      // Fallback: ffprobe adjacent to the resolved ffmpeg binary (e.g. Homebrew).
      const ffmpegPath = this.getFfmpegPath();
      if (ffmpegPath) {
        const adjacent = path.join(path.dirname(ffmpegPath), ffprobeBinary);
        if (fs.existsSync(adjacent) && this.testFfmpegBinary(adjacent)) {
          this.ffprobePath = adjacent;
          log.debug('ffprobe path (adjacent to ffmpeg):', this.ffprobePath);
          return;
        }
      }

      // Fallback: system ffprobe on PATH / common install paths.
      const systemFfprobe = this.findSystemFfprobe();
      if (systemFfprobe && this.testFfmpegBinary(systemFfprobe)) {
        this.ffprobePath = systemFfprobe;
        log.debug('ffprobe path (system):', this.ffprobePath);
        return;
      }

      // Last resort: use static path even if the test failed.
      if (staticFfprobePath) {
        this.ffprobePath = staticFfprobePath;
        log.debug('ffprobe path (static, untested):', this.ffprobePath);
      } else {
        log.error('No ffprobe binary found');
        this.ffprobePath = null;
      }
    } catch (error) {
      log.error('ffprobe initialization failed:', error);
      this.ffprobePath = null;
    }
  }

  getFfmpegPath(): string | null {
    this.ensureResolved();
    return this.ffmpegPath;
  }

  getFfprobePath(): string | null {
    this.ensureFfprobeResolved();
    return this.ffprobePath;
  }

  /**
   * Eagerly resolve both ffmpeg and ffprobe paths. Resolution runs blocking
   * execSync probes (binary `-version`, `which`), so the first preview/start in
   * the lecture-compress UI would otherwise pay that cost on the click. Callers
   * can warm this up when that UI opens. Memoized — a no-op after first resolve.
   */
  warmUp(): void {
    this.ensureResolved();
    this.ensureFfprobeResolved();
  }

  isAvailable(): boolean {
    this.ensureResolved();
    return this.ffmpegPath !== null;
  }

  getPlatformInfo(): { platform: string; ffmpegPath: string | null } {
    this.ensureResolved();
    return {
      platform: process.platform,
      ffmpegPath: this.ffmpegPath
    };
  }
}
