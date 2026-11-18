import { ipcMain } from 'electron';
import path from 'path';
import type { IpcServices } from './types';
import { createLogger } from '@main/infra/logger';
const log = createLogger('TrashIpc');

type RestoreDeps = Pick<IpcServices, 'slideExtractionService' | 'slideMetadataService' | 'slideTimelineService'>;

/**
 * Restore trash entries and record the restore where it belongs: `edited` on
 * the folders, and the timeline's current slide. Both follow the files that
 * actually came back. An entry whose file could not be moved changes neither,
 * or the timeline would point at a slide that is not in the folder.
 */
export async function restoreTrash(
  deps: RestoreDeps,
  ids: string[],
  outputDir: string,
): Promise<{ restored: number; failed: number }> {
  const outcome = await deps.slideExtractionService.restoreTrashEntries(ids, outputDir);
  const folders = new Set(outcome.restored.map(entry => path.dirname(entry.originalPath)));
  for (const folderPath of folders) {
    deps.slideMetadataService.stageEdited(folderPath);
  }
  // Best-effort: the file is back either way; a timeline that could not be
  // updated is logged with the file it concerns.
  for (const entry of outcome.restored) {
    try {
      await deps.slideTimelineService.restoreCanonical(path.dirname(entry.originalPath), {
        file: entry.filename,
      });
    } catch (timelineError) {
      log.warn(`Timeline restoreCanonical failed for ${entry.filename}:`, timelineError);
    }
  }
  return { restored: outcome.restored.length, failed: outcome.failed.length };
}

export function registerTrashIpcHandlers(services: IpcServices): void {
  const { configService, slideExtractionService, slideMetadataService, slideTimelineService } = services;

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
      return await restoreTrash({ slideExtractionService, slideMetadataService, slideTimelineService }, ids, outputDir);
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
