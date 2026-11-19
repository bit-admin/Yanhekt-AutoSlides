import path from 'node:path';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { app } from 'electron';
import { createLogger } from '@main/infra/logger';

const log = createLogger('Ffmpeg');
// The bundle is ffmpeg alone: ffprobe was dropped (2026-11-19); `ffmpeg -i`
// prints the container header where a probe is needed.
type MediaTool = 'ffmpeg';

export class FFmpegService {
  private paths: Partial<Record<MediaTool, string>> = {};

  /**
   * Probe only the prepared bundle, lazily. A success is cached; a failure is
   * not, so the next call tries again (a first run can be slow while antivirus
   * scans the large executable). Packaging/preparation owns permissions;
   * runtime never repairs or substitutes an executable from the system, PATH,
   * or an npm installer package.
   */
  private resolveTool(tool: MediaTool): string | null {
    const cached = this.paths[tool];
    if (cached) return cached;

    let binaryPath: string | undefined;
    try {
      const directory = app.isPackaged
        ? path.join(process.resourcesPath, 'media-tools')
        : path.join(app.getAppPath(), 'vendor', 'media-tools', `${process.platform}-${process.arch}`, 'media-tools');
      binaryPath = path.join(directory, process.platform === 'win32' ? `${tool}.exe` : tool);

      if (!fs.existsSync(binaryPath)) {
        log.error(`Bundled ${tool} binary is missing:`, binaryPath);
        return null;
      }

      const version = execFileSync(binaryPath, ['-version'], {
        encoding: 'utf8',
        stdio: 'pipe',
        timeout: 30000,
        windowsHide: true,
      });
      if (!new RegExp(`^${tool} version \\S+`, 'm').test(version)) {
        log.error(`Bundled ${tool} returned invalid version output:`, binaryPath);
        return null;
      }

      this.paths[tool] = binaryPath;
      log.debug(`Bundled ${tool} path:`, binaryPath);
      return binaryPath;
    } catch (error) {
      log.error(`Bundled ${tool} could not be initialized:`, binaryPath, error);
      return null;
    }
  }

  getFfmpegPath(): string | null {
    return this.resolveTool('ffmpeg');
  }

  /** Warm up the blocking -version probe before the first media job. */
  warmUp(): void {
    this.getFfmpegPath();
  }

  isAvailable(): boolean {
    return this.getFfmpegPath() !== null;
  }

  getPlatformInfo(): { platform: string; ffmpegPath: string | null } {
    return {
      platform: process.platform,
      ffmpegPath: this.getFfmpegPath(),
    };
  }
}
