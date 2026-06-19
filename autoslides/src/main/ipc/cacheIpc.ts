import { ipcMain } from 'electron';
import type { IpcServices } from './types';
import { createLogger } from '@main/infra/logger';
const log = createLogger('CacheIpc');

export function registerCacheIpcHandlers(services: IpcServices): void {
  const { cacheManagementService } = services;

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
      return await cacheManagementService.clearCache();
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
      return await cacheManagementService.resetAllData();
    } catch (error) {
      log.error('Failed to reset all data:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  });
}
