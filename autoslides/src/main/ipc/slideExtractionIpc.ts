import { ipcMain } from 'electron';
import { slideExtractionService, TrashMetadata } from '@main/extraction/slideExtractionService';
import { hasTraversalSegment } from '@main/infra/pathUtils';
import type { IpcServices } from './types';
import { createLogger } from '@main/infra/logger';
const log = createLogger('SlideExtractionIpc');

function assertNoTraversal(targetPath: string): void {
  if (hasTraversalSegment(targetPath)) {
    throw new Error('Invalid path: contains traversal segments');
  }
}

export function registerSlideExtractionIpcHandlers(services: IpcServices): void {
  const { configService } = services;

  ipcMain.handle('slideExtraction:saveSlide', async (_event, outputPath: string, filename: string, imageBuffer: Uint8Array) => {
    try {
      const slideConfig = configService.getSlideExtractionConfig();
      const enableColorReduction = slideConfig.enablePngColorReduction ?? true;
      await slideExtractionService.saveSlide(outputPath, filename, imageBuffer, enableColorReduction);
      return { success: true };
    } catch (error) {
      log.error('Failed to save slide:', error);
      throw error;
    }
  });

  ipcMain.handle('slideExtraction:ensureDirectory', async (_event, dirPath: string) => {
    try {
      await slideExtractionService.ensureDirectory(dirPath);
      return { success: true };
    } catch (error) {
      log.error('Failed to ensure directory:', error);
      throw error;
    }
  });

  ipcMain.handle('slideExtraction:deleteSlide', async (_event, outputPath: string, filename: string) => {
    try {
      await slideExtractionService.deleteSlide(outputPath, filename);
      return { success: true };
    } catch (error) {
      log.error('Failed to delete slide:', error);
      throw error;
    }
  });

  ipcMain.handle('slideExtraction:moveToInAppTrash', async (_event, outputPath: string, filename: string, metadata: TrashMetadata) => {
    try {
      await slideExtractionService.moveToInAppTrash(outputPath, filename, metadata);
      // Best-effort timeline update (recorded/builtin folders only have timeline.json).
      try {
        const { slideTimelineService } = services;
        await slideTimelineService.applyTrashOutcome(
          outputPath,
          filename,
          metadata.reason,
          metadata.duplicateOf
        );
      } catch (timelineError) {
        log.warn('Timeline update after trash failed:', timelineError);
      }
      return { success: true };
    } catch (error) {
      log.error('Failed to move slide to in-app trash:', error);
      throw error;
    }
  });

  ipcMain.handle('slideExtraction:readSlideAsBase64', async (_event, outputPath: string, filename: string) => {
    try {
      return await slideExtractionService.readSlideAsBase64(outputPath, filename);
    } catch (error) {
      log.error('Failed to read slide as base64:', error);
      throw error;
    }
  });

  ipcMain.handle('slideExtraction:readSlideForAI', async (_event, outputPath: string, filename: string, targetWidth: number, targetHeight: number) => {
    try {
      return await slideExtractionService.readSlideForAI(outputPath, filename, targetWidth, targetHeight);
    } catch (error) {
      log.error('Failed to read slide for AI:', error);
      throw error;
    }
  });

  ipcMain.handle('slideExtraction:listSlides', async (_event, outputPath: string) => {
    try {
      return await slideExtractionService.listSlides(outputPath);
    } catch (error) {
      log.error('Failed to list slides:', error);
      throw error;
    }
  });

  // Arbitrary-path image read (Results crop/dedup, in-place auto-crop, Developer
  // lab). Not confined to the output directory — only reject `..` segments.
  ipcMain.handle('slideExtraction:readImageBuffer', async (_event, filePath: string) => {
    try {
      assertNoTraversal(filePath);
      return await slideExtractionService.readImageBuffer(filePath);
    } catch (error) {
      log.error('Failed to read image buffer:', error);
      throw error;
    }
  });
}
