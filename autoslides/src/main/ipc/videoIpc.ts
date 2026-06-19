import { ipcMain } from 'electron';
import type { IpcServices } from './types';
import type { LiveStreamInput, RecordedSessionInput } from '@main/video/videoProxyService';
import type { ScreenThumbnailRequest } from '@main/video/thumbnailService';
import { createLogger } from '@main/infra/logger';
const log = createLogger('VideoIpc');

export function registerVideoIpcHandlers(services: IpcServices): void {
  const { videoProxyService, thumbnailService } = services;

  ipcMain.handle('video:getLiveStreamUrls', async (_event, stream: LiveStreamInput, token: string) => {
    try {
      return await videoProxyService.getLiveStreamUrls(stream, token);
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

  ipcMain.handle('video:stopProxy', async () => {
    try {
      videoProxyService.stopVideoProxy();
      log.debug('Video proxy stopped');
    } catch (error) {
      log.error('Failed to stop video proxy:', error);
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
