import { ipcMain } from 'electron';
import { cacheManagementService } from '../cacheManagementService';

export function registerCacheIpcHandlers(): void {
  ipcMain.handle('cache:getStats', async () => {
    try {
      return await cacheManagementService.getStats();
    } catch (error) {
      console.error('Failed to get cache stats:', error);
      return { totalSize: 0, tempFiles: 0 };
    }
  });

  ipcMain.handle('cache:clear', async () => {
    try {
      return await cacheManagementService.clearCache();
    } catch (error) {
      console.error('Failed to clear cache:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  });

  ipcMain.handle('cache:resetAllData', async () => {
    try {
      return await cacheManagementService.resetAllData();
    } catch (error) {
      console.error('Failed to reset all data:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  });
}
