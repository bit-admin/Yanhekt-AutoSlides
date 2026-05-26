import { ipcMain, BrowserWindow } from 'electron';

export function registerWindowIpcHandlers(): void {
  ipcMain.handle('window:minimize', async () => {
    const focusedWindow = BrowserWindow.getFocusedWindow();
    if (focusedWindow) {
      focusedWindow.minimize();
      return { success: true };
    }
    return { success: false, error: 'No focused window' };
  });

  ipcMain.handle('window:maximize', async () => {
    const focusedWindow = BrowserWindow.getFocusedWindow();
    if (focusedWindow) {
      if (focusedWindow.isMaximized()) {
        focusedWindow.unmaximize();
      } else {
        focusedWindow.maximize();
      }
      return { success: true, isMaximized: focusedWindow.isMaximized() };
    }
    return { success: false, error: 'No focused window' };
  });

  ipcMain.handle('window:close', async () => {
    const focusedWindow = BrowserWindow.getFocusedWindow();
    if (focusedWindow) {
      focusedWindow.close();
      return { success: true };
    }
    return { success: false, error: 'No focused window' };
  });

  ipcMain.handle('window:isMaximized', async () => {
    const focusedWindow = BrowserWindow.getFocusedWindow();
    if (focusedWindow) {
      return { isMaximized: focusedWindow.isMaximized() };
    }
    return { isMaximized: false };
  });
}
