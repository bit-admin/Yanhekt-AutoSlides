import { ipcMain } from 'electron';
import type { IpcServices } from './types';
import type { DevDownloadPrepared } from '@common/devPlayback';
import { devDownloadStem, isDevDownloadStem, parseDevPlaybackUrl, type DevPlaybackUrl } from '@main/video/videoProxy/devPlaybackUrl';
import { createLogger } from '@main/infra/logger';
const log = createLogger('DownloadIpc');

export function registerDownloadIpcHandlers(services: IpcServices): void {
  const { m3u8DownloadService, audioDownloadService, yanhe2DownloadService, configService, yanhe2Service } = services;

  type DevRefusal = Exclude<DevDownloadPrepared, { kind: 'ok' }>['kind'];
  /** The same access rules as playback: Yanhekt follows Anonymous API requests, Yanhe 2.0 needs its account. */
  const checkDevDownload = (input: unknown, account: unknown): DevRefusal | { source: DevPlaybackUrl; badge: string; token: string } => {
    if (!configService.getDeveloperMode()) return 'disabled';
    const source = parseDevPlaybackUrl(input);
    if (!source) return 'invalidUrl';
    if (source.live) return 'liveUnsupported';
    const badge = typeof account === 'string' && /^\d{1,12}$/.test(account) ? account : '';
    if (source.platform === 'yanhe2') {
      return badge && yanhe2Service.getPlayIdentity(badge) ? { source, badge, token: '' } : 'yanhe2SignIn';
    }
    const token = configService.getAuthToken() ?? '';
    if (!token && !configService.getPreferAnonymousApiRequests()) return 'yanhektSignIn';
    return { source, badge, token };
  };

  ipcMain.handle('download:prepareDev', async (_event, input: unknown, account: unknown): Promise<DevDownloadPrepared> => {
    const checked = checkDevDownload(input, account);
    if (typeof checked === 'string') return { kind: checked };
    const { source, badge } = checked;
    return { kind: 'ok', url: source.url, account: badge, outputName: devDownloadStem(source, new Date()), format: source.format };
  });

  ipcMain.handle('download:startDev', async (event, downloadId: string, input: unknown, account: unknown, outputName: unknown) => {
    const progressCallback = (progress: { current: number; total: number; phase: number }) => {
      if (!event.sender.isDestroyed()) event.sender.send('download:progress', downloadId, progress);
    };
    try {
      const checked = checkDevDownload(input, account);
      if (typeof checked === 'string') throw new Error(`Developer download refused (${checked})`);
      if (!isDevDownloadStem(outputName)) throw new Error('Bad developer download name');
      const { source, badge, token } = checked;
      let filePath: string;
      if (source.platform === 'yanhe2') {
        filePath = await yanhe2DownloadService.startMedia(downloadId, badge, source.url, source.format, outputName, progressCallback);
      } else if (source.format === 'aac') {
        filePath = await audioDownloadService.startDownload(downloadId, source.url, outputName, progressCallback);
      } else {
        filePath = await m3u8DownloadService.startDownload(downloadId, source.url, outputName, progressCallback, token);
      }
      if (!event.sender.isDestroyed()) event.sender.send('download:completed', downloadId, filePath);
    } catch (error) {
      // The message only: a request error can carry a signed URL.
      log.error(`Developer download failed for ${downloadId}:`, error instanceof Error ? error.message : 'Unknown error');
      if (!event.sender.isDestroyed()) {
        event.sender.send('download:error', downloadId, error instanceof Error ? error.message : 'Unknown error');
      }
    }
  });

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

      const filePath = await m3u8DownloadService.startDownload(downloadId, m3u8Url, outputName, progressCallback, effectiveLoginToken);
      if (!event.sender.isDestroyed()) {
        event.sender.send('download:completed', downloadId, filePath);
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

      const filePath = await audioDownloadService.startDownload(downloadId, audioUrl, outputName, progressCallback);
      if (!event.sender.isDestroyed()) {
        event.sender.send('download:completed', downloadId, filePath);
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
      const filePath = await yanhe2DownloadService.start(downloadId, typeof account === 'string' ? account.trim() : '', query, kind, outputName, progressCallback);
      if (!event.sender.isDestroyed()) {
        event.sender.send('download:completed', downloadId, filePath);
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
