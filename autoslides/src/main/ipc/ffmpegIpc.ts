import { ipcMain } from 'electron';
import type { IpcServices } from './types';

export function registerFfmpegIpcHandlers(services: IpcServices): void {
  const { ffmpegService } = services;

  ipcMain.handle('ffmpeg:getPath', async () => {
    return ffmpegService.getFfmpegPath();
  });

  ipcMain.handle('ffmpeg:isAvailable', async () => {
    return ffmpegService.isAvailable();
  });

  ipcMain.handle('ffmpeg:getPlatformInfo', async () => {
    return ffmpegService.getPlatformInfo();
  });
}
