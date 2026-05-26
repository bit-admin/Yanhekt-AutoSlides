import { ipcMain, dialog } from 'electron';

export function registerDialogIpcHandlers(): void {
  ipcMain.handle('dialog:openImageFile', async () => {
    try {
      const result = await dialog.showOpenDialog({
        properties: ['openFile'],
        filters: [
          { name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'bmp', 'tiff', 'tif', 'webp'] }
        ],
        title: 'Select Image'
      });
      if (result.canceled || result.filePaths.length === 0) {
        return null;
      }
      return result.filePaths[0];
    } catch (error) {
      console.error('Failed to open image file:', error);
      throw error;
    }
  });

  ipcMain.handle('dialog:openImageFiles', async () => {
    try {
      const result = await dialog.showOpenDialog({
        properties: ['openFile', 'multiSelections'],
        filters: [
          { name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'bmp', 'tiff', 'tif', 'webp'] }
        ],
        title: 'Select Images'
      });
      if (result.canceled || result.filePaths.length === 0) {
        return null;
      }
      return result.filePaths;
    } catch (error) {
      console.error('Failed to open image files:', error);
      throw error;
    }
  });

  ipcMain.handle('dialog:showMessageBox', async (_event, options: Electron.MessageBoxOptions) => {
    try {
      return await dialog.showMessageBox(options);
    } catch (error) {
      console.error('Failed to show message box:', error);
      throw error;
    }
  });

  ipcMain.handle('dialog:showErrorBox', async (_event, title: string, content: string) => {
    try {
      dialog.showErrorBox(title, content);
      return { success: true };
    } catch (error) {
      console.error('Failed to show error box:', error);
      throw error;
    }
  });
}
