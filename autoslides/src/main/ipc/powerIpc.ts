import { ipcMain } from 'electron';
import type { IpcServices } from './types';
import { createLogger } from '@main/infra/logger';
const log = createLogger('PowerIpc');

export function registerPowerIpcHandlers(services: IpcServices): void {
  const { powerManagementService } = services;

  ipcMain.handle('powerManagement:preventSleep', async (_event, holderId: string) => {
    try {
      const success = await powerManagementService.preventSleep(holderId);
      return { success };
    } catch (error) {
      log.error('Failed to prevent system sleep:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  });

  ipcMain.handle('powerManagement:allowSleep', async (_event, holderId: string) => {
    try {
      const success = await powerManagementService.allowSleep(holderId);
      return { success };
    } catch (error) {
      log.error('Failed to allow system sleep:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  });

  ipcMain.handle('powerManagement:isPreventingSleep', async () => {
    try {
      const isPreventing = powerManagementService.isPreventingSleep();
      return { isPreventing };
    } catch (error) {
      log.error('Failed to check sleep prevention status:', error);
      return { isPreventing: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  });
}
