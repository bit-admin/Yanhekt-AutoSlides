import { ipcMain } from 'electron';
import type { IpcServices } from './types';

export function registerPowerIpcHandlers(services: IpcServices): void {
  const { powerManagementService } = services;

  ipcMain.handle('powerManagement:preventSleep', async () => {
    try {
      const success = await powerManagementService.preventSleep();
      return { success };
    } catch (error) {
      console.error('Failed to prevent system sleep:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  });

  ipcMain.handle('powerManagement:allowSleep', async () => {
    try {
      const success = await powerManagementService.allowSleep();
      return { success };
    } catch (error) {
      console.error('Failed to allow system sleep:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  });

  ipcMain.handle('powerManagement:isPreventingSleep', async () => {
    try {
      const isPreventing = powerManagementService.isPreventingSleep();
      return { isPreventing };
    } catch (error) {
      console.error('Failed to check sleep prevention status:', error);
      return { isPreventing: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  });
}
