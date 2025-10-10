
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

      // For Windows, try hardcoded common paths
      if (process.platform === 'win32') {
        const commonPaths = [
          // User-specific installation
          path.join(process.env.LOCALAPPDATA || '', 'AutoSlides', 'app-4.0.0', 'resources', 'ffmpeg-static', 'ffmpeg.exe'),
          // Try with different app versions
          path.join(process.env.LOCALAPPDATA || '', 'AutoSlides', 'app-*', 'resources', 'ffmpeg-static', 'ffmpeg.exe'),
          // System-wide installation
          path.join('C:', 'Program Files', 'AutoSlides', 'resources', 'ffmpeg-static', 'ffmpeg.exe'),
          path.join('C:', 'Program Files (x86)', 'AutoSlides', 'resources', 'ffmpeg-static', 'ffmpeg.exe'),
        ];

        for (const testPath of commonPaths) {
          console.log('Checking Windows path:', testPath);
          if (fs.existsSync(testPath)) {
            this.ffmpegPath = testPath;
            console.log('FFmpeg path (Windows hardcoded):', this.ffmpegPath);
            return;
          }
        }

        // Try to find app directory dynamically
        if (process.env.LOCALAPPDATA) {
          const autoSlidesDir = path.join(process.env.LOCALAPPDATA, 'AutoSlides');
          console.log('Checking AutoSlides directory:', autoSlidesDir);

          if (fs.existsSync(autoSlidesDir)) {
            try {
              const appDirs = fs.readdirSync(autoSlidesDir).filter(dir => dir.startsWith('app-'));
              console.log('Found app directories:', appDirs);

              for (const appDir of appDirs) {
                const ffmpegPath = path.join(autoSlidesDir, appDir, 'resources', 'ffmpeg-static', 'ffmpeg.exe');
                console.log('Checking dynamic path:', ffmpegPath);
                if (fs.existsSync(ffmpegPath)) {
                  this.ffmpegPath = ffmpegPath;
                  console.log('FFmpeg path (Windows dynamic):', this.ffmpegPath);
                  return;
                }
              }
            } catch (error) {
              console.error('Error reading AutoSlides directory:', error);
            }
          }
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