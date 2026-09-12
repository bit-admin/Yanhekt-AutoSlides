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

  // Quit the whole app. window:close is not a quit on macOS — the app stays in
  // the Dock after its last window closes. app.quit() still runs the busy-work
  // close guard in main.ts (before-quit → window 'close').
  ipcMain.handle('app:quit', () => {
    app.quit();
  });

  ipcMain.handle('app:getVersion', () => app.getVersion());
}
