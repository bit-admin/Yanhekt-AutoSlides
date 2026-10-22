import { ipcMain } from 'electron';
import type { IpcServices } from './types';
import { createLogger } from '@main/infra/logger';
const log = createLogger('CacheIpc');

export function registerCacheIpcHandlers(services: IpcServices): void {
  const { cacheManagementService, yanhektCatalogStore, courseSnapshotService } = services;

  ipcMain.handle('cache:getStats', async () => {
    try {
      return await cacheManagementService.getStats();
    } catch (error) {
      log.error('Failed to get cache stats:', error);
      return { totalSize: 0, tempFiles: 0 };
    }
  });

  ipcMain.handle('cache:clear', async () => {
    try {
      // The catalog lives in logs/, which the size walk counts, but clearLogFiles
      // only removes autoslides.log. Drop the catalog too, including its memory,
      // or the next flush would write the cleared file straight back.
      yanhektCatalogStore.reset();
      const result = await cacheManagementService.clearCache();
      // Imported snapshot terms were in the cleared folders; read the built-in ones again.
      courseSnapshotService.reset();
      return result;
    } catch (error) {
      log.error('Failed to clear cache:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  });

  ipcMain.handle('cache:resetAllData', async () => {
    try {
      // Config goes back to defaults (catalog off), but logs/ is kept and the
      // app keeps running, so stop recording now rather than at the next launch.
      yanhektCatalogStore.setEnabled(false);
      const result = await cacheManagementService.resetAllData();
      courseSnapshotService.reset();
      return result;
    } catch (error) {
      log.error('Failed to reset all data:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  });
}
