import { ipcMain, app } from 'electron';

export function registerAppIpcHandlers(): void {
  ipcMain.handle('app:restart', async () => {
    try {
      app.relaunch();
      app.exit(0);
    } catch (error) {
      console.error('Failed to restart app:', error);
      throw error;
    }
  });

  ipcMain.handle('app:getVersion', () => app.getVersion());
}
