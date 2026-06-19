import { ipcMain, shell } from 'electron';
import { createLogger } from '@main/infra/logger';
const log = createLogger('ShellIpc');

export function registerShellIpcHandlers(): void {
  ipcMain.handle('shell:openExternal', async (_, url: string) => {
    try {
      await shell.openExternal(url);
      return { success: true };
    } catch (error) {
      log.error('Failed to open external URL:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  });

  ipcMain.handle('shell:openPath', async (_, filePath: string) => {
    try {
      await shell.openPath(filePath);
      return { success: true };
    } catch (error) {
      log.error('Failed to open path:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  });
}
