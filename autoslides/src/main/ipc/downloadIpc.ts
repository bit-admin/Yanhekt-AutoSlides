import { ipcMain } from 'electron';
import type { IpcServices } from './types';
import { createLogger } from '@main/infra/logger';
const log = createLogger('DownloadIpc');

export function registerDownloadIpcHandlers(services: IpcServices): void {
  const { m3u8DownloadService, audioDownloadService, yanhe2DownloadService, configService } = services;

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
   * unsigned — no video token, no path-encrypt. Downloading is still a
   * signed-in feature like every other download, so the same login check as
   * `download:start` gates it even though the CDN itself would not ask. It
   * reports on the SAME three broadcast channels, so the renderer's listener
   * wiring is shared with video downloads.
   */
  ipcMain.handle('download:startAudio', async (event, downloadId: string, audioUrl: string, outputName: string) => {
    const progressCallback = (progress: { current: number; total: number; phase: number }) => {
      if (!event.sender.isDestroyed()) {
        event.sender.send('download:progress', downloadId, progress);
      }
    };

    try {
      if (!configService.getAuthToken()) {
        throw new Error('Authentication token not found. Please sign in again.');
      }

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

  /**
   * A Yanhe 2.0 recording, filed under its Yanhekt lecture (the renderer
   * found it with `yanhe2:prepareDownload` and names the file). Main reads the
   * stream URLs itself and signs every request; the renderer sends only aita
   * ids, the stream kind and the file stem. Same three broadcast channels.
   */
  ipcMain.handle('download:startYanhe2', async (event, downloadId: string, account: string, query: unknown, kind: unknown, outputName: unknown) => {
    const progressCallback = (progress: { current: number; total: number; phase: number }) => {
      if (!event.sender.isDestroyed()) {
        event.sender.send('download:progress', downloadId, progress);
      }
    };

    try {
      await yanhe2DownloadService.start(downloadId, typeof account === 'string' ? account.trim() : '', query, kind, outputName, progressCallback);
      if (!event.sender.isDestroyed()) {
        event.sender.send('download:completed', downloadId);
      }
    } catch (error) {
      log.error(`Yanhe 2.0 download failed for ${downloadId}:`, error instanceof Error ? error.message : error);
      if (!event.sender.isDestroyed()) {
        event.sender.send('download:error', downloadId, error instanceof Error ? error.message : 'Unknown error');
      }
    }
  });

  // Cancel is one channel for every kind, so it must ask who owns the id.
  // Routing unconditionally to the m3u8 service would make cancelling a mic
  // download a silent no-op: the renderer would mark the row cancelled while
  // the file kept streaming to disk.
  ipcMain.handle('download:cancel', async (_event, downloadId: string) => {
    // First: a Yanhe 2.0 camera download is also an m3u8 one, and this stops both halves.
    if (yanhe2DownloadService.isActive(downloadId)) {
      yanhe2DownloadService.cancel(downloadId);
      return;
    }
    if (audioDownloadService.isActive(downloadId)) {
      audioDownloadService.cancelDownload(downloadId);
      return;
    }
    m3u8DownloadService.cancelDownload(downloadId);
  });

  // Likewise for temp files: the m3u8 cleanup only knows `.m3u8` / `.concat` /
  // the TS dir, so a stray `.aac.part` or `.mp4.part` would never be
  // collected. All are safe no-ops when their artifacts are absent, so run all.
  ipcMain.handle('download:cleanupTempFiles', async (_event, outputName: string) => {
    m3u8DownloadService.cleanupTempFiles(outputName);
    audioDownloadService.cleanupTempFiles(outputName);
    yanhe2DownloadService.cleanupTempFiles(outputName);
  });
}
