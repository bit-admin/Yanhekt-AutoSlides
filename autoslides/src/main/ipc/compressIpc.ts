import { ipcMain, dialog, app } from 'electron';
import path from 'node:path';
import type { IpcServices } from './types';
import type { CompressLectureOptions } from '@main/video/compressLectureService';

export function registerCompressIpcHandlers(services: IpcServices): void {
  const { compressLectureService } = services;

  ipcMain.handle('compressLecture:selectInput', async () => {
    try {
      const result = await dialog.showOpenDialog({
        properties: ['openFile'],
        filters: [
          { name: 'Videos', extensions: ['mp4', 'mkv', 'mov', 'avi', 'webm', 'm4v', 'ts'] }
        ],
        title: 'Select Screen Recording'
      });

      if (result.canceled || result.filePaths.length === 0) {
        return null;
      }
      return result.filePaths[0];
    } catch (error) {
      console.error('Failed to select compression input file:', error);
      throw error;
    }
  });

  ipcMain.handle('compressLecture:selectOutput', async (_event, defaultPath?: string) => {
    try {
      const fallbackPath = path.join(app.getPath('downloads'), 'compressed.mp4');
      const result = await dialog.showSaveDialog({
        title: 'Save Compressed Video',
        defaultPath: defaultPath || fallbackPath,
        filters: [
          { name: 'MP4', extensions: ['mp4'] },
          { name: 'MKV', extensions: ['mkv'] },
          { name: 'All Files', extensions: ['*'] }
        ]
      });

      if (result.canceled || !result.filePath) {
        return null;
      }
      return result.filePath;
    } catch (error) {
      console.error('Failed to select compression output file:', error);
      throw error;
    }
  });

  ipcMain.handle('compressLecture:preview', async (_event, options: CompressLectureOptions) => {
    return await compressLectureService.preview(options);
  });

  ipcMain.handle('compressLecture:start', async (event, options: CompressLectureOptions) => {
    const progressCallback = (progress: { phase: string; current: number; total: number; message?: string }) => {
      event.sender.send('compressLecture:progress', progress);
    };

    try {
      const result = await compressLectureService.start(options, progressCallback);
      event.sender.send('compressLecture:completed', result);
      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Compression failed';
      event.sender.send('compressLecture:error', errorMessage);
      throw error;
    }
  });

  ipcMain.handle('compressLecture:cancel', async () => {
    return compressLectureService.cancel();
  });

  ipcMain.handle('compressLecture:isActive', async () => {
    return compressLectureService.isActive();
  });
}
