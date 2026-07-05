import { ipcMain, dialog } from 'electron';
import { hasTraversalSegment, assertBareFilename } from '@main/infra/pathUtils';
import type { IpcServices } from './types';
import { createLogger } from '@main/infra/logger';
const log = createLogger('OfflineIpc');

// Offline processing legitimately reads user-picked files anywhere on disk,
// so paths are NOT confined to the output directory — but picker/listing
// paths never contain `..` segments, so reject those outright.
function assertNoTraversal(targetPath: string): void {
  if (hasTraversalSegment(targetPath)) {
    throw new Error('Invalid path: contains traversal segments');
  }
}

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
      log.error('Failed to select input folder:', error);
      throw error;
    }
  });

  ipcMain.handle('offline:listImages', async (_event, folderPath: string) => {
    try {
      assertNoTraversal(folderPath);
      return await offlineProcessingService.listImages(folderPath);
    } catch (error) {
      log.error('Failed to list images:', error);
      throw error;
    }
  });

  ipcMain.handle('offline:copyAndConvert', async (_event, inputPath: string, outputDir: string, outputFilename: string, enableColorReduction: boolean) => {
    try {
      assertNoTraversal(inputPath);
      assertNoTraversal(outputDir);
      assertBareFilename(outputFilename);
      await offlineProcessingService.copyAndConvertImage(inputPath, outputDir, outputFilename, enableColorReduction);
      return { success: true };
    } catch (error) {
      log.error('Failed to copy and convert image:', error);
      throw error;
    }
  });

  ipcMain.handle('offline:readImageForAI', async (_event, filePath: string, targetWidth: number, targetHeight: number) => {
    try {
      assertNoTraversal(filePath);
      return await offlineProcessingService.readImageForAI(filePath, targetWidth, targetHeight);
    } catch (error) {
      log.error('Failed to read image for AI:', error);
      throw error;
    }
  });

  ipcMain.handle('offline:readImageBuffer', async (_event, filePath: string) => {
    try {
      assertNoTraversal(filePath);
      return await offlineProcessingService.readImageBuffer(filePath);
    } catch (error) {
      log.error('Failed to read image buffer:', error);
      throw error;
    }
  });

  ipcMain.handle('offline:savePngBuffer', async (_event, outputDir: string, filename: string, buffer: Uint8Array, enableColorReduction: boolean) => {
    try {
      assertNoTraversal(outputDir);
      assertBareFilename(filename);
      await offlineProcessingService.savePngBuffer(outputDir, filename, buffer, enableColorReduction);
    } catch (error) {
      log.error('Failed to save PNG buffer:', error);
      throw error;
    }
  });
}
