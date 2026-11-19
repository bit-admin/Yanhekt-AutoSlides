import { ipcMain } from 'electron';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

export function registerWebCaptureIpcHandlers(): void {
  ipcMain.handle('webCapture:getGuestPreloadPath', () =>
    pathToFileURL(path.join(__dirname, 'webviewCapturePreload.js')).href
  );
}
