import { BrowserWindow, ipcMain, dialog } from 'electron';
import type { IpcServices } from './types';

export function registerModelIpcHandlers(services: IpcServices): void {
  const { autoCropModelService, mlClassifierModelService } = services;

  ipcMain.handle('autoCrop:getModelInfo', async () => {
    return autoCropModelService.getModelInfo();
  });

  ipcMain.handle('autoCrop:getModelBuffer', async () => {
    return autoCropModelService.readModelBuffer();
  });

  ipcMain.handle('autoCrop:selectAndImportModel', async () => {
    try {
      return await autoCropModelService.selectAndImportModel();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await dialog.showErrorBox('Custom Model Import Failed', message);
      return autoCropModelService.getModelInfo();
    }
  });

  ipcMain.handle('autoCrop:deleteCustomModel', async () => {
    return autoCropModelService.deleteCustomModel();
  });

  mlClassifierModelService.subscribe((info) => {
    for (const window of BrowserWindow.getAllWindows()) {
      if (!window.isDestroyed() && !window.webContents.isDestroyed()) window.webContents.send('mlClassifier:modelInfo', info);
    }
  });

  ipcMain.handle('mlClassifier:getModelInfo', async () => {
    return mlClassifierModelService.getModelInfo();
  });

  ipcMain.handle('mlClassifier:downloadDefaultModel', async () => {
    // Expected network failures are reflected in the returned status.
    await mlClassifierModelService.downloadDefaultModel().catch(() => {});
    return mlClassifierModelService.getModelInfo();
  });

  ipcMain.handle('mlClassifier:deleteDownloadedModel', async () => {
    return mlClassifierModelService.deleteDownloadedModel();
  });

  ipcMain.handle('mlClassifier:getModelBuffer', async () => {
    return mlClassifierModelService.readModelBuffer();
  });

  ipcMain.handle('mlClassifier:selectAndImportModel', async () => {
    try {
      return await mlClassifierModelService.selectAndImportModel();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      dialog.showErrorBox('Custom Classifier Model Import Failed', message);
      return null;
    }
  });

  ipcMain.handle('mlClassifier:deleteCustomModel', async () => {
    await mlClassifierModelService.deleteCustomModel();
    mlClassifierModelService.prepareConfiguredModel();
    return mlClassifierModelService.getModelInfo();
  });
}
