import { ipcMain } from 'electron';
import type {
  SlideMetadata,
  SlideMetadataSource,
  SlideExtractionMeta,
  SlidePostProcessingMeta,
} from '@common/slideMetadataTypes';
import type { IpcServices } from './types';
import { createLogger } from '@main/infra/logger';
const log = createLogger('SlideMetadataIpc');

export function registerSlideMetadataIpcHandlers(services: IpcServices): void {
  const { slideMetadataService } = services;

  ipcMain.handle('slideMetadata:get', async (_event, folderPath: string) => {
    try {
      return await slideMetadataService.read(folderPath);
    } catch (error) {
      log.error('Failed to read slide metadata:', error);
      return null;
    }
  });

  ipcMain.handle(
    'slideMetadata:writeExtraction',
    async (_event, folderPath: string, data: { source: SlideMetadataSource; extraction: SlideExtractionMeta }) => {
      try {
        await slideMetadataService.writeExtraction(folderPath, data);
        return { success: true };
      } catch (error) {
        log.error('Failed to write extraction metadata:', error);
        return { success: false };
      }
    }
  );

  ipcMain.handle(
    'slideMetadata:updatePostProcessing',
    async (_event, folderPath: string, pp: SlidePostProcessingMeta) => {
      try {
        await slideMetadataService.updatePostProcessing(folderPath, pp);
        return { success: true };
      } catch (error) {
        log.error('Failed to update post-processing metadata:', error);
        return { success: false };
      }
    }
  );

  ipcMain.handle('slideMetadata:write', async (_event, folderPath: string, metadata: SlideMetadata) => {
    try {
      await slideMetadataService.write(folderPath, metadata);
      return { success: true };
    } catch (error) {
      log.error('Failed to write slide metadata:', error);
      return { success: false };
    }
  });

  ipcMain.handle('slideMetadata:markReviewed', async (_event, folderPath: string) => {
    try {
      await slideMetadataService.markReviewed(folderPath);
      return { success: true };
    } catch (error) {
      log.error('Failed to mark folder reviewed:', error);
      return { success: false };
    }
  });
}
