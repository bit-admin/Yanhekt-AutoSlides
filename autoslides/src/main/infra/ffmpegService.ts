
import path from 'path';
import fs from 'fs';
import { execSync } from 'child_process';

export class FFmpegService {
  private ffmpegPath: string | null = null;

  constructor() {
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
        console.log('Added execute permission to FFmpeg binary:', filePath);
      }
    } catch (error) {
      console.error('Failed to set execute permission on FFmpeg:', error);
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
        console.log('Found system FFmpeg:', systemPath);
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
        console.log('Found FFmpeg at common path:', p);
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
        console.log('Checking extraResource path:', extraResourcePath);
        console.log('Platform:', process.platform);
        console.log('Resources path:', process.resourcesPath);

        if (fs.existsSync(extraResourcePath)) {
          this.ensureExecutePermission(extraResourcePath);
          staticFfmpegPath = extraResourcePath;
        } else {
          console.log('extraResource path does not exist');
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
          console.log('ffmpeg-static npm package not available:', error);
        }
      }

      // Test the static binary - on Linux it may crash (SIGSEGV) due to compatibility issues
      if (staticFfmpegPath) {
        console.log('Testing static FFmpeg binary:', staticFfmpegPath);
        if (this.testFfmpegBinary(staticFfmpegPath)) {
          this.ffmpegPath = staticFfmpegPath;
          console.log('FFmpeg path (static binary works):', this.ffmpegPath);
          return;
        } else {
          console.log('Static FFmpeg binary failed test, will try system FFmpeg');
        }
      }

      // On Linux/macOS, try system FFmpeg as fallback
      if (process.platform !== 'win32') {
        const systemFfmpeg = this.findSystemFfmpeg();
        if (systemFfmpeg && this.testFfmpegBinary(systemFfmpeg)) {
          this.ffmpegPath = systemFfmpeg;
          console.log('FFmpeg path (system):', this.ffmpegPath);
          return;
        }
      }

      // Last resort: use static path even if test failed (might work for some operations)
      if (staticFfmpegPath) {
        this.ffmpegPath = staticFfmpegPath;
        console.log('FFmpeg path (static, untested):', this.ffmpegPath);
      } else {
        console.error('No FFmpeg binary found');
        this.ffmpegPath = null;
      }
    } catch (error) {
      console.error('FFmpeg initialization failed:', error);
      this.ffmpegPath = null;
    }
  }

  getFfmpegPath(): string | null {
    return this.ffmpegPath;
  }

  isAvailable(): boolean {
    return this.ffmpegPath !== null;
  }

  getPlatformInfo(): { platform: string; ffmpegPath: string | null } {
    return {
      platform: process.platform,
      ffmpegPath: this.ffmpegPath
    };
  }
}
