
import path from 'path';
import fs from 'fs';
import ffmpegStatic from 'ffmpeg-static';

export class FFmpegService {
  private ffmpegPath: string | null = null;

  constructor() {
    this.initializeFfmpegPath();
  }

  private initializeFfmpegPath(): void {
    try {
      // In packaged app, check extraResource first
      if (process.resourcesPath) {
        // Try extraResource path first (packaged app)
        const ffmpegBinary = process.platform === 'darwin' ? 'ffmpeg' : 'ffmpeg.exe';
        const extraResourcePath = path.join(process.resourcesPath, 'ffmpeg-static', ffmpegBinary);
        console.log('Checking extraResource path:', extraResourcePath);
        console.log('Platform:', process.platform);
        console.log('Resources path:', process.resourcesPath);

        if (fs.existsSync(extraResourcePath)) {
          this.ffmpegPath = extraResourcePath;
          console.log('FFmpeg path (extraResource):', this.ffmpegPath);
          return;
        } else {
          console.log('extraResource path does not exist');
        }
      }

      // Fallback to ffmpeg-static npm package (development)
      this.ffmpegPath = ffmpegStatic;
      console.log('FFmpeg path (npm package):', this.ffmpegPath);
    } catch (error) {
      console.error('ffmpeg-static not available:', error);
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