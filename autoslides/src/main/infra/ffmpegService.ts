import path from 'node:path';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { app } from 'electron';
import { createLogger } from '@main/infra/logger';

const log = createLogger('Ffmpeg');
type MediaTool = 'ffmpeg' | 'ffprobe';

export class FFmpegService {
  private paths: Partial<Record<MediaTool, string | null>> = {};

  /**
   * Probe only the prepared bundle, lazily and once per tool (including failures).
   * Packaging/preparation owns permissions; runtime never repairs or substitutes
   * an executable from the system, PATH, or an npm installer package.
   */
  private resolveTool(tool: MediaTool): string | null {
    if (this.paths[tool] !== undefined) return this.paths[tool];
    this.paths[tool] = null;

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
        timeout: 5000,
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

  getFfprobePath(): string | null {
    return this.resolveTool('ffprobe');
  }

  /** Warm up the blocking -version probes before the first compression click. */
  warmUp(): void {
    this.getFfmpegPath();
    this.getFfprobePath();
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
