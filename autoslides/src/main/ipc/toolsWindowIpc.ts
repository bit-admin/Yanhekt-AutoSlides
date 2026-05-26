import { ipcMain } from 'electron';
import path from 'node:path';
import type { IpcServices } from './types';

export function registerToolsWindowIpcHandlers(services: IpcServices): void {
  const { windowManager } = services;

  ipcMain.handle('trash:openWindow', async () => {
    windowManager.createToolsWindow('trash');
    return { success: true };
  });

  ipcMain.handle('tools:openWindow', async (_event, tab?: string) => {
    windowManager.createToolsWindow(tab);
    return { success: true };
  });

  ipcMain.handle('addons:openWindow', async (_event, tab?: string) => {
    windowManager.createAddonsWindow(tab);
    return { success: true };
  });

  ipcMain.handle('pdfmaker:openWindow', async () => {
    windowManager.createToolsWindow('pdfmaker');
    return { success: true };
  });

  ipcMain.handle('webCapture:getGuestPreloadPath', async () => {
    const absolute = path.join(__dirname, 'webviewCapturePreload.js');
    return new URL(`file://${absolute}`).toString();
  });
}
