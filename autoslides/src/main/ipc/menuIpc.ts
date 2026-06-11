import { ipcMain, BrowserWindow, app, shell } from 'electron';
import path from 'node:path';

export function registerMenuIpcHandlers(): void {
  ipcMain.handle('menu:openTermsAndConditions', async () => {
    try {
      const termsPath = app.isPackaged
        ? path.join(process.resourcesPath, 'terms/terms.rtf')
        : path.join(__dirname, '../../resources/terms/terms.rtf');
      await shell.openPath(termsPath);
      return { success: true };
    } catch (error) {
      console.error('Failed to open Terms and Conditions:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  });

  ipcMain.handle('menu:requestOpenSettings', async () => {
    try {
      const focusedWindow = BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows()[0];
      if (focusedWindow) {
        focusedWindow.webContents.send('menu:openSettings');
        return { success: true };
      }
      return { success: false, error: 'No window available' };
    } catch (error) {
      console.error('Failed to open settings:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  });

  ipcMain.handle('menu:reload', async () => {
    try {
      const focusedWindow = BrowserWindow.getFocusedWindow();
      if (focusedWindow) {
        focusedWindow.reload();
        return { success: true };
      }
      return { success: false, error: 'No focused window' };
    } catch (error) {
      console.error('Failed to reload window:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  });

  ipcMain.handle('menu:forceReload', async () => {
    try {
      const focusedWindow = BrowserWindow.getFocusedWindow();
      if (focusedWindow) {
        focusedWindow.webContents.reloadIgnoringCache();
        return { success: true };
      }
      return { success: false, error: 'No focused window' };
    } catch (error) {
      console.error('Failed to force reload window:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  });

  ipcMain.handle('menu:toggleDevTools', async () => {
    try {
      const focusedWindow = BrowserWindow.getFocusedWindow();
      if (focusedWindow) {
        focusedWindow.webContents.toggleDevTools();
        return { success: true };
      }
      return { success: false, error: 'No focused window' };
    } catch (error) {
      console.error('Failed to toggle dev tools:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  });

  ipcMain.handle('menu:resetZoom', async () => {
    try {
      const focusedWindow = BrowserWindow.getFocusedWindow();
      if (focusedWindow) {
        focusedWindow.webContents.setZoomLevel(0);
        return { success: true };
      }
      return { success: false, error: 'No focused window' };
    } catch (error) {
      console.error('Failed to reset zoom:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  });

  ipcMain.handle('menu:zoomIn', async () => {
    try {
      const focusedWindow = BrowserWindow.getFocusedWindow();
      if (focusedWindow) {
        const currentZoom = focusedWindow.webContents.getZoomLevel();
        focusedWindow.webContents.setZoomLevel(currentZoom + 0.5);
        return { success: true };
      }
      return { success: false, error: 'No focused window' };
    } catch (error) {
      console.error('Failed to zoom in:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  });

  ipcMain.handle('menu:zoomOut', async () => {
    try {
      const focusedWindow = BrowserWindow.getFocusedWindow();
      if (focusedWindow) {
        const currentZoom = focusedWindow.webContents.getZoomLevel();
        focusedWindow.webContents.setZoomLevel(currentZoom - 0.5);
        return { success: true };
      }
      return { success: false, error: 'No focused window' };
    } catch (error) {
      console.error('Failed to zoom out:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  });

  ipcMain.handle('menu:toggleFullscreen', async () => {
    try {
      const focusedWindow = BrowserWindow.getFocusedWindow();
      if (focusedWindow) {
        focusedWindow.setFullScreen(!focusedWindow.isFullScreen());
        return { success: true };
      }
      return { success: false, error: 'No focused window' };
    } catch (error) {
      console.error('Failed to toggle fullscreen:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  });
}
