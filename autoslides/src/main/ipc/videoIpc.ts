import { ipcMain } from 'electron';
import type { IpcServices } from './types';
import type { LiveStreamInput, RecordedSessionInput } from '@main/video/videoProxyService';

export function registerVideoIpcHandlers(services: IpcServices): void {
  const { videoProxyService } = services;

  ipcMain.handle('video:getLiveStreamUrls', async (_event, stream: LiveStreamInput, token: string) => {
    try {
      return await videoProxyService.getLiveStreamUrls(stream, token);
    } catch (error) {
      console.error('Failed to get live stream URLs:', error);
      throw error;
    }
  });

  ipcMain.handle('video:getVideoPlaybackUrls', async (_event, session: RecordedSessionInput, token: string) => {
    try {
      return await videoProxyService.getVideoPlaybackUrls(session, token);
    } catch (error) {
      console.error('Failed to get video playback URLs:', error);
      throw error;
    }
  });

  ipcMain.handle('video:registerClient', async () => {
    try {
      const clientId = videoProxyService.registerClient();
      console.log('Video proxy client registered:', clientId);
      return clientId;
    } catch (error) {
      console.error('Failed to register video proxy client:', error);
      throw error;
    }
  });

  ipcMain.handle('video:unregisterClient', async (_event, clientId: string) => {
    try {
      videoProxyService.unregisterClient(clientId);
      console.log('Video proxy client unregistered:', clientId);
    } catch (error) {
      console.error('Failed to unregister video proxy client:', error);
      throw error;
    }
  });

  ipcMain.handle('video:stopProxy', async () => {
    try {
      videoProxyService.stopVideoProxy();
      console.log('Video proxy stopped');
    } catch (error) {
      console.error('Failed to stop video proxy:', error);
      throw error;
    }
  });

  ipcMain.handle('video:stopSignatureLoop', async () => {
    try {
      videoProxyService.stopSignatureLoop();
      console.log('Video signature loop stopped');
    } catch (error) {
      console.error('Failed to stop signature loop:', error);
      throw error;
    }
  });
}
