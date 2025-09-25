import path from 'node:path';
import { app } from 'electron';

export class FFmpegService {
  private ffmpegPath: string | null = null;

  constructor() {
    this.initializeFfmpegPath();
  }

  private initializeFfmpegPath(): void {
    const platform = process.platform;

    if (platform === 'darwin') {
      // For macOS (both development and production), use ffmpeg-static npm package
      try {
        // Dynamic import to handle optional dependency
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const ffmpegStatic = require('ffmpeg-static');
        this.ffmpegPath = ffmpegStatic;
      } catch (error) {
        console.error('ffmpeg-static not available on macOS:', error);
        this.ffmpegPath = null;
      }
    } else if (platform === 'win32') {
      // For Windows, use the bundled ffmpeg.exe from resources
      if (app.isPackaged) {
        // In production, resources are in the app bundle
        this.ffmpegPath = path.join(process.resourcesPath, 'ffmpeg', 'ffmpeg.exe');
      } else {
        // In development, resources are in the project directory
        this.ffmpegPath = path.join(__dirname, '..', '..', 'resources', 'ffmpeg', 'ffmpeg.exe');
      }
    } else {
      // For other platforms (Linux, etc.), try ffmpeg-static as fallback
      // Note: Currently only supporting Mac and Windows as per requirements
      try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const ffmpegStatic = require('ffmpeg-static');
        this.ffmpegPath = ffmpegStatic;
      } catch (error) {
        console.error('ffmpeg-static not available:', error);
        this.ffmpegPath = null;
      }
    }
  }

  getFfmpegPath(): string | null {
    return this.ffmpegPath;
  }

  isAvailable(): boolean {
    return this.ffmpegPath !== null;
  }

  getPlatformInfo(): { platform: string; ffmpegPath: string | null; isPackaged: boolean } {
    return {
      platform: process.platform,
      ffmpegPath: this.ffmpegPath,
      isPackaged: app.isPackaged
    };
  }
}