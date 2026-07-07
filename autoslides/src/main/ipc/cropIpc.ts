import { ipcMain } from 'electron';
import path from 'path';
import { hasTraversalSegment } from '@main/infra/pathUtils';
import type { CropRect } from '@main/extraction/slideExtractionService';
import type { IpcServices } from './types';
import { createLogger } from '@main/infra/logger';
const log = createLogger('CropIpc');

// Image/crop paths arrive from our own listings/manifests — they never
// contain `..` segments; reject any that do (defense in depth).
function assertNoTraversal(targetPath: string): void {
  if (hasTraversalSegment(targetPath)) {
    throw new Error('Invalid path: contains traversal segments');
  }
}

export function registerCropIpcHandlers(services: IpcServices): void {
  const { configService, slideExtractionService, slideMetadataService } = services;

  // After a crop/restore, recompute whether any active crop remains for the
  // folder so metadata.json's `review.cropped` reflects current state.
  const folderStillCropped = async (folderPath: string, outputDir: string): Promise<boolean> => {
    const folderName = path.basename(folderPath);
    const entries = await slideExtractionService.getCropEntries(outputDir);
    return entries.some(entry => entry.originalParentFolder === folderName);
  };

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
      assertNoTraversal(cropPath);
      return await slideExtractionService.getCropImageAsBase64(cropPath);
    } catch (error) {
      log.error('Failed to get crop image:', error);
      throw error;
    }
  });

  ipcMain.handle('crop:apply', async (_event, imagePath: string, rect: CropRect, autoCropped?: boolean) => {
    try {
      assertNoTraversal(imagePath);
      const outputDir = configService.getConfig().outputDirectory;
      await slideExtractionService.applyCrop(imagePath, outputDir, rect, autoCropped);
      // Human crop during review: stage `edited` + cropped, latched to disk
      // once the renderer confirms the user returned to the folder list.
      slideMetadataService.stageEdited(path.dirname(imagePath), { cropped: true });
      return { success: true };
    } catch (error) {
      log.error('Failed to apply crop:', error);
      throw error;
    }
  });

  ipcMain.handle('crop:restore', async (_event, imagePath: string) => {
    try {
      assertNoTraversal(imagePath);
      const outputDir = configService.getConfig().outputDirectory;
      await slideExtractionService.restoreCrop(imagePath, outputDir);
      const folderPath = path.dirname(imagePath);
      slideMetadataService.stageEdited(folderPath, {
        cropped: await folderStillCropped(folderPath, outputDir),
      });
      return { success: true };
    } catch (error) {
      log.error('Failed to restore crop:', error);
      throw error;
    }
  });
}
