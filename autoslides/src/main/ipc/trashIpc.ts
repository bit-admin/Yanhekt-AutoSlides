import { ipcMain } from 'electron';
import path from 'path';
import type { IpcServices } from './types';
import { createLogger } from '@main/infra/logger';
const log = createLogger('TrashIpc');

export function registerTrashIpcHandlers(services: IpcServices): void {
  const { configService, slideExtractionService, slideMetadataService } = services;

  ipcMain.handle('trash:getEntries', async () => {
    try {
      const outputDir = configService.getConfig().outputDirectory;
      return await slideExtractionService.getTrashEntries(outputDir);
    } catch (error) {
      log.error('Failed to get trash entries:', error);
      throw error;
    }
  });

  ipcMain.handle('trash:restore', async (_event, ids: string[]) => {
    try {
      const outputDir = configService.getConfig().outputDirectory;
      // Resolve the folders these entries restore into BEFORE the manifest is
      // rewritten, so we can latch `edited` on each (no-op if no metadata).
      const entries = await slideExtractionService.getTrashEntries(outputDir);
      const affectedFolders = new Set(
        entries.filter(e => ids.includes(e.id)).map(e => path.dirname(e.originalPath))
      );
      const result = await slideExtractionService.restoreFromTrash(ids, outputDir);
      for (const folderPath of affectedFolders) {
        await slideMetadataService.markEdited(folderPath);
      }
      return result;
    } catch (error) {
      log.error('Failed to restore from trash:', error);
      throw error;
    }
  });

  ipcMain.handle('trash:clear', async () => {
    try {
      const outputDir = configService.getConfig().outputDirectory;
      return await slideExtractionService.clearTrash(outputDir);
    } catch (error) {
      log.error('Failed to clear trash:', error);
      throw error;
    }
  });

  ipcMain.handle('trash:clearEntries', async (_event, ids: string[]) => {
    try {
      const outputDir = configService.getConfig().outputDirectory;
      return await slideExtractionService.clearTrashEntries(ids, outputDir);
    } catch (error) {
      log.error('Failed to clear selected trash entries:', error);
      throw error;
    }
  });

  ipcMain.handle('trash:removeFolders', async (_event, folderNames: string[]) => {
    try {
      const outputDir = configService.getConfig().outputDirectory;
      return await slideExtractionService.removeFolders(folderNames, outputDir);
    } catch (error) {
      log.error('Failed to remove result folders:', error);
      throw error;
    }
  });

  ipcMain.handle('trash:getImageAsBase64', async (_event, trashPath: string) => {
    try {
      return await slideExtractionService.getTrashImageAsBase64(trashPath);
    } catch (error) {
      log.error('Failed to get trash image:', error);
      throw error;
    }
  });
}
