// Downloader for Yanhekt's classroom mic stem — the `.aac` SubAudio sidecar
// that sits next to a recorded VOD (docs/architecture.md §9.6).
//
// This is deliberately NOT part of m3u8DownloadService. That service is
// m3u8-shaped end to end: path encryption, a signature refresh loop, a TS
// worker pool and an FFmpeg concat. The mic track is a single, *unsigned*,
// world-readable file served with Accept-Ranges — none of that machinery
// applies, and threading a "skip everything" flag through it would be worse
// than a small dedicated service.
//
// What it does share is the intranet path (createIntranetAxios), because the
// `.aac` lives on the same cvideo host as the video and must follow the same
// NIC binding and Host-preserving rewrite.
import fs from 'node:fs';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';
import type { Readable } from 'node:stream';
import axios from 'axios';
import { expandTilde } from '@main/infra/pathUtils';
import { createIntranetAxios } from '@main/infra/intranetAxios';
import type { ConfigService } from '@main/platform/configService';
import type { IntranetMappingService } from '@main/platform/intranetMappingService';
import { createLogger } from '@main/infra/logger';
import type { DownloadProgress } from './m3u8DownloadService';

const log = createLogger('AudioDownload');

/** Suffix of the in-progress file. Public so temp-file cleanup can find it. */
export const AUDIO_PART_SUFFIX = '.aac.part';

/**
 * Remove a mic download's in-progress artifact. The finished `.aac` is left
 * alone, mirroring removeDownloadTempFiles' contract for `.mp4`.
 */
export function removeAudioTempFiles(outputDir: string, name: string): void {
  try {
    const partPath = path.join(expandTilde(outputDir), `${name}${AUDIO_PART_SUFFIX}`);
    if (fs.existsSync(partPath)) {
      fs.unlinkSync(partPath);
    }
  } catch (error) {
    log.error('Error deleting audio temporary file:', error);
  }
}

export class AudioDownloadService {
  private activeDownloads = new Map<string, AbortController>();

  constructor(
    private configService: ConfigService,
    private intranetMapping: IntranetMappingService,
  ) {}

  /** True when this service owns the id — lets the shared cancel channel route correctly. */
  isActive(downloadId: string): boolean {
    return this.activeDownloads.has(downloadId);
  }

  async startDownload(
    downloadId: string,
    audioUrl: string,
    outputName: string,
    progressCallback: (progress: DownloadProgress) => void,
  ): Promise<void> {
    if (this.activeDownloads.has(downloadId)) {
      throw new Error('Download already in progress');
    }

    const outputDir = expandTilde(this.configService.getConfig().outputDirectory);
    const isIntranetMode = this.configService.getConfig().connectionMode === 'internal';

    await fs.promises.mkdir(outputDir, { recursive: true });

    const finalPath = path.join(outputDir, `${outputName}.aac`);
    const partPath = path.join(outputDir, `${outputName}${AUDIO_PART_SUFFIX}`);

    const controller = new AbortController();
    this.activeDownloads.set(downloadId, controller);

    // One socket: this is a single sequential stream, not a segment pool.
    const bundle = createIntranetAxios({
      intranetMapping: this.intranetMapping,
      isIntranetMode,
      maxSockets: 1,
      timeout: 60000,
    });

    try {
      // The mic track is unsigned and world-readable, so no video token, no
      // path encryption and no Authorization — sending the user Bearer to the
      // CDN would be a leak for no benefit.
      const response = await bundle.instance.get<Readable>(audioUrl, {
        responseType: 'stream',
        signal: controller.signal,
        headers: {
          'Origin': 'https://www.yanhekt.cn',
          'Referer': 'https://www.yanhekt.cn/',
        },
      });

      const total = Number(response.headers['content-length']) || 0;
      let received = 0;

      progressCallback({ current: 0, total, phase: 0 });

      response.data.on('data', (chunk: Buffer) => {
        received += chunk.length;
        progressCallback({ current: received, total, phase: 0 });
      });

      // Write to `.part` and rename only on success, so an aborted or failed
      // download can never leave a truncated `.aac` that the Lectures library
      // would happily list and try to play.
      await pipeline(response.data, fs.createWriteStream(partPath));

      if (controller.signal.aborted) {
        throw new Error('Cancelled by user');
      }

      await fs.promises.rename(partPath, finalPath);

      // No processing stage: phase 1 exists only for the FFmpeg remux.
      progressCallback({ current: total || received, total: total || received, phase: 2 });
    } catch (error) {
      await fs.promises.rm(partPath, { force: true }).catch(() => { /* best effort */ });

      if (controller.signal.aborted || axios.isCancel(error)) {
        throw new Error('Cancelled by user');
      }
      throw error;
    } finally {
      bundle.destroy();
      this.activeDownloads.delete(downloadId);
    }
  }

  cancelDownload(downloadId: string): void {
    const controller = this.activeDownloads.get(downloadId);
    if (controller) {
      controller.abort();
      this.activeDownloads.delete(downloadId);
    }
  }

  cleanupTempFiles(outputName: string): void {
    removeAudioTempFiles(this.configService.getConfig().outputDirectory, outputName);
  }
}
