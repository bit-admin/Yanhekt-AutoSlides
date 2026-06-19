import { ipcMain } from 'electron';
import type { CropRect } from '@main/extraction/slideExtractionService';
import type { IpcServices } from './types';
import { createLogger } from '@main/infra/logger';
const log = createLogger('CropIpc');

export function registerCropIpcHandlers(services: IpcServices): void {
  const { configService, slideExtractionService } = services;

  ipcMain.handle('crop:getEntries', async () => {
    try {
      const outputDir = configService.getConfig().outputDirectory;
      return await slideExtractionService.getCropEntries(outputDir);
    } catch (error) {
      log.error('Failed to get crop entries:', error);
      throw error;
    }
  });

  ipcMain.handle('crop:getImageAsBase64', async (_event, cropPath: string) => {
    try {
      return await slideExtractionService.getCropImageAsBase64(cropPath);
    } catch (error) {
      log.error('Failed to get crop image:', error);
      throw error;
    }
  });

  ipcMain.handle('crop:apply', async (_event, imagePath: string, rect: CropRect, autoCropped?: boolean) => {
    try {
      const outputDir = configService.getConfig().outputDirectory;
      await slideExtractionService.applyCrop(imagePath, outputDir, rect, autoCropped);
      return { success: true };
    } catch (error) {
      log.error('Failed to apply crop:', error);
      throw error;
    }
  });

  ipcMain.handle('crop:restore', async (_event, imagePath: string) => {
    try {
      const outputDir = configService.getConfig().outputDirectory;
      await slideExtractionService.restoreCrop(imagePath, outputDir);
      return { success: true };
    } catch (error) {
      log.error('Failed to restore crop:', error);
      throw error;
    }
  });
}
