import { ipcMain, dialog } from 'electron';
import type { IpcServices } from './types';

export function registerOfflineIpcHandlers(services: IpcServices): void {
  const { offlineProcessingService } = services;

  ipcMain.handle('offline:selectInputFolder', async () => {
    try {
      const result = await dialog.showOpenDialog({
        properties: ['openDirectory'],
        title: 'Select Input Folder'
      });
      if (result.canceled || result.filePaths.length === 0) {
        return null;
      }
      return result.filePaths[0];
    } catch (error) {
      console.error('Failed to select input folder:', error);
      throw error;
    }
  });

  ipcMain.handle('offline:listImages', async (_event, folderPath: string) => {
    try {
      return await offlineProcessingService.listImages(folderPath);
    } catch (error) {
      console.error('Failed to list images:', error);
      throw error;
    }
  });

  ipcMain.handle('offline:copyAndConvert', async (_event, inputPath: string, outputDir: string, outputFilename: string, enableColorReduction: boolean) => {
    try {
      await offlineProcessingService.copyAndConvertImage(inputPath, outputDir, outputFilename, enableColorReduction);
      return { success: true };
    } catch (error) {
      console.error('Failed to copy and convert image:', error);
      throw error;
    }
  });

  ipcMain.handle('offline:readImageForAI', async (_event, filePath: string, targetWidth: number, targetHeight: number) => {
    try {
      return await offlineProcessingService.readImageForAI(filePath, targetWidth, targetHeight);
    } catch (error) {
      console.error('Failed to read image for AI:', error);
      throw error;
    }
  });

  ipcMain.handle('offline:readImageBuffer', async (_event, filePath: string) => {
    try {
      return await offlineProcessingService.readImageBuffer(filePath);
    } catch (error) {
      console.error('Failed to read image buffer:', error);
      throw error;
    }
  });

  ipcMain.handle('offline:savePngBuffer', async (_event, outputDir: string, filename: string, buffer: Uint8Array, enableColorReduction: boolean) => {
    try {
      await offlineProcessingService.savePngBuffer(outputDir, filename, buffer, enableColorReduction);
    } catch (error) {
      console.error('Failed to save PNG buffer:', error);
      throw error;
    }
  });
}
