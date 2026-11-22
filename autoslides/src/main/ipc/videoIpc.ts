import { ipcMain } from 'electron';
import type { IpcServices } from './types';
import type { LiveStreamInput, RecordedSessionInput } from '@main/video/videoProxyService';
import type { ScreenThumbnailRequest } from '@main/video/thumbnailService';
import { parseDevPlaybackUrl } from '@main/video/videoProxy/devPlaybackUrl';
import type { DevPlaybackResult } from '@common/devPlayback';
import { createLogger } from '@main/infra/logger';
const log = createLogger('VideoIpc');

export function registerVideoIpcHandlers(services: IpcServices): void {
  const { configService, yanhe2Service, videoProxyService, thumbnailService } = services;

  ipcMain.handle('video:prepareDevPlayback', async (_event, input: unknown, account: unknown): Promise<DevPlaybackResult> => {
    if (!configService.getDeveloperMode()) return { kind: 'disabled' };
    const source = parseDevPlaybackUrl(input);
    if (!source) return { kind: 'invalidUrl' };

    const badge = typeof account === 'string' && /^\d{1,12}$/.test(account) ? account : '';
    const token = source.platform === 'yanhekt' && source.route === 'recorded' ? configService.getAuthToken() : null;
    if (source.platform === 'yanhe2' && (!badge || !yanhe2Service.getPlayIdentity(badge))) return { kind: 'yanhe2SignIn' };
    // The recording's video token follows Anonymous API requests, as in normal playback.
    if (source.platform === 'yanhekt' && source.route === 'recorded' && !token && !configService.getPreferAnonymousApiRequests()) {
      return { kind: 'yanhektSignIn' };
    }

    const clientId = videoProxyService.registerClient();
    try {
      const url = source.platform === 'yanhe2'
        ? await videoProxyService.getYanhe2PlayUrl(badge, source.url)
        : await videoProxyService.getYanhektPlayUrl(source.route, source.url, token ?? undefined);
      return { kind: 'ok', url, clientId, platform: source.platform, format: source.format, live: source.live };
    } catch {
      videoProxyService.unregisterClient(clientId);
      // Do not surface or log the pasted URL (it might include credentials).
      log.warn('Could not prepare Developer playback proxy');
      return { kind: 'proxyFailed' };
    }
  });

  ipcMain.handle('video:getLiveStreamUrls', async (_event, stream: LiveStreamInput) => {
    try {
      return await videoProxyService.getLiveStreamUrls(stream);
    } catch (error) {
      log.error('Failed to get live stream URLs:', error);
      throw error;
    }
  });

  ipcMain.handle('video:getVideoPlaybackUrls', async (_event, session: RecordedSessionInput, token: string) => {
    try {
      return await videoProxyService.getVideoPlaybackUrls(session, token);
    } catch (error) {
      log.error('Failed to get video playback URLs:', error);
      throw error;
    }
  });

  ipcMain.handle('video:getScreenThumbnail', async (_event, req: ScreenThumbnailRequest) => {
    // A missing preview must never break the home rows — swallow errors to null.
    try {
      return await thumbnailService.getScreenThumbnail(req);
    } catch (error) {
      log.error('Failed to get screen thumbnail:', error);
      return null;
    }
  });

  ipcMain.handle('video:registerClient', async () => {
    try {
      const clientId = videoProxyService.registerClient();
      log.debug('Video proxy client registered:', clientId);
      return clientId;
    } catch (error) {
      log.error('Failed to register video proxy client:', error);
      throw error;
    }
  });

  ipcMain.handle('video:unregisterClient', async (_event, clientId: string) => {
    try {
      videoProxyService.unregisterClient(clientId);
      log.debug('Video proxy client unregistered:', clientId);
    } catch (error) {
      log.error('Failed to unregister video proxy client:', error);
      throw error;
    }
  });

  ipcMain.handle('video:stopSignatureLoop', async () => {
    try {
      videoProxyService.stopSignatureLoop();
      log.debug('Video signature loop stopped');
    } catch (error) {
      log.error('Failed to stop signature loop:', error);
      throw error;
    }
  });
}
