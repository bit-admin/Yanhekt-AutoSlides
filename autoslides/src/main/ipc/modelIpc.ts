import { ipcMain, dialog } from 'electron';
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

  ipcMain.handle('mlClassifier:getModelInfo', async () => {
    return mlClassifierModelService.getModelInfo();
  });

  ipcMain.handle('mlClassifier:getModelBuffer', async () => {
    return mlClassifierModelService.readModelBuffer();
  });

  ipcMain.handle('mlClassifier:selectAndImportModel', async () => {
    try {
      return await mlClassifierModelService.selectAndImportModel();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await dialog.showErrorBox('Custom Classifier Model Import Failed', message);
      return mlClassifierModelService.getModelInfo();
    }
  });

  ipcMain.handle('mlClassifier:deleteCustomModel', async () => {
    return mlClassifierModelService.deleteCustomModel();
  });
}
