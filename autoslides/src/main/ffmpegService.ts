
export class FFmpegService {
  private ffmpegPath: string | null = null;

  constructor() {
    this.initializeFfmpegPath();
  }

  private initializeFfmpegPath(): void {
    // Use ffmpeg-static npm package
    try {
      // Dynamic import to handle optional dependency
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const ffmpegStatic = require('ffmpeg-static');
      this.ffmpegPath = ffmpegStatic;
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