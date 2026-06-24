import { ipcMain } from 'electron';
import path from 'node:path';
import type { IpcServices } from './types';

export function registerToolsWindowIpcHandlers(services: IpcServices): void {
  const { windowManager } = services;

  ipcMain.handle('tools:openWindow', async (_event, tab?: string) => {
    windowManager.createToolsWindow(tab);
    return { success: true };
  });

  ipcMain.handle('webCapture:getGuestPreloadPath', async () => {
    const absolute = path.join(__dirname, 'webviewCapturePreload.js');
    return new URL(`file://${absolute}`).toString();
  });
}
