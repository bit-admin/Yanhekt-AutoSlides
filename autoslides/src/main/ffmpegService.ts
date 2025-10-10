
export class FFmpegService {
  private ffmpegPath: string | null = null;

  constructor() {
    this.initializeFfmpegPath();
  }

  private initializeFfmpegPath(): void {
    try {
      // In packaged app, check extraResource first
      if (process.resourcesPath) {
        const path = require('path');
        const fs = require('fs');

        // Try extraResource path first (packaged app)
        const extraResourcePath = path.join(process.resourcesPath, 'ffmpeg-static', 'ffmpeg');
        if (fs.existsSync(extraResourcePath)) {
          this.ffmpegPath = extraResourcePath;
          console.log('FFmpeg path (extraResource):', this.ffmpegPath);
          return;
        }
      }

      // Fallback to ffmpeg-static npm package (development)
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const ffmpegStatic = require('ffmpeg-static');
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