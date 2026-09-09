import { ipcMain } from 'electron';
import type { IpcServices } from './types';
import { createLogger } from '@main/infra/logger';
const log = createLogger('DownloadIpc');

export function registerDownloadIpcHandlers(services: IpcServices): void {
  const { m3u8DownloadService, audioDownloadService, configService } = services;

  ipcMain.handle('download:start', async (event, downloadId: string, m3u8Url: string, outputName: string, loginToken?: string) => {
    const progressCallback = (progress: { current: number; total: number; phase: number }) => {
      if (!event.sender.isDestroyed()) {
        event.sender.send('download:progress', downloadId, progress);
      }
    };

    try {
      const effectiveLoginToken = loginToken || configService.getAuthToken();
      if (!effectiveLoginToken) {
        throw new Error('Authentication token not found. Please sign in again.');
      }

      await m3u8DownloadService.startDownload(downloadId, m3u8Url, outputName, progressCallback, effectiveLoginToken);
      if (!event.sender.isDestroyed()) {
        event.sender.send('download:completed', downloadId);
      }
    } catch (error) {
      log.error(`Download failed for ${downloadId}:`, error);
      if (!event.sender.isDestroyed()) {
        event.sender.send('download:error', downloadId, error instanceof Error ? error.message : 'Unknown error');
      }
    }
  });

  /**
   * Mic-audio download. Separate from `download:start` because the `.aac` is
   * unsigned — it needs no login token, and requiring one (as the m3u8 path
   * does) would refuse a download that would otherwise succeed. It reports on
   * the SAME three broadcast channels, so the renderer's listener wiring is
   * shared with video downloads.
   */
  ipcMain.handle('download:startAudio', async (event, downloadId: string, audioUrl: string, outputName: string) => {
    const progressCallback = (progress: { current: number; total: number; phase: number }) => {
      if (!event.sender.isDestroyed()) {
        event.sender.send('download:progress', downloadId, progress);
      }
    };

    try {
      await audioDownloadService.startDownload(downloadId, audioUrl, outputName, progressCallback);
      if (!event.sender.isDestroyed()) {
        event.sender.send('download:completed', downloadId);
      }
    } catch (error) {
      log.error(`Audio download failed for ${downloadId}:`, error);
      if (!event.sender.isDestroyed()) {
        event.sender.send('download:error', downloadId, error instanceof Error ? error.message : 'Unknown error');
      }
    }
  });

  // Cancel is one channel for both kinds, so it must ask who owns the id.
  // Routing unconditionally to the m3u8 service would make cancelling a mic
  // download a silent no-op: the renderer would mark the row cancelled while
  // the file kept streaming to disk.
  ipcMain.handle('download:cancel', async (_event, downloadId: string) => {
    if (audioDownloadService.isActive(downloadId)) {
      audioDownloadService.cancelDownload(downloadId);
      return;
    }
    m3u8DownloadService.cancelDownload(downloadId);
  });

  // Likewise for temp files: the m3u8 cleanup only knows `.m3u8` / `.concat` /
  // the TS dir, so a stray `.aac.part` would never be collected. Both are safe
  // no-ops when their artifacts are absent, so just run both.
  ipcMain.handle('download:cleanupTempFiles', async (_event, outputName: string) => {
    m3u8DownloadService.cleanupTempFiles(outputName);
    audioDownloadService.cleanupTempFiles(outputName);
  });
}
