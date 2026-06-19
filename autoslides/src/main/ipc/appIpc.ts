import { ipcMain, app } from 'electron';
import { createLogger } from '@main/infra/logger';
const log = createLogger('AppIpc');

export function registerAppIpcHandlers(): void {
  ipcMain.handle('app:restart', async () => {
    try {
      app.relaunch();
      app.exit(0);
    } catch (error) {
      log.error('Failed to restart app:', error);
      throw error;
    }
  });

  ipcMain.handle('app:getVersion', () => app.getVersion());
}
