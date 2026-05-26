import { ipcMain } from 'electron';
import type { IpcServices } from './types';

export function registerDownloadIpcHandlers(services: IpcServices): void {
  const { m3u8DownloadService, configService } = services;

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
      console.error(`Download failed for ${downloadId}:`, error);
      if (!event.sender.isDestroyed()) {
        event.sender.send('download:error', downloadId, error instanceof Error ? error.message : 'Unknown error');
      }
    }
  });

  ipcMain.handle('download:cancel', async (_event, downloadId: string) => {
    m3u8DownloadService.cancelDownload(downloadId);
  });

  ipcMain.handle('download:isActive', async (_event, downloadId: string) => {
    return m3u8DownloadService.isDownloadActive(downloadId);
  });
}
