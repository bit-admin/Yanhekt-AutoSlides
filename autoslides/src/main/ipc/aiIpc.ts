import { ipcMain } from 'electron';
import type { IpcServices } from './types';

export function registerAiIpcHandlers(services: IpcServices): void {
  const { aiFilteringService } = services;

  ipcMain.handle('ai:classifySingleImage', async (_event, base64Image: string, token?: string, modelOverride?: string) => {
    return aiFilteringService.classifySingleImage(base64Image, token, modelOverride);
  });

  ipcMain.handle('ai:classifyMultipleImages', async (_event, base64Images: string[], token?: string, modelOverride?: string) => {
    return aiFilteringService.classifyMultipleImages(base64Images, token, modelOverride);
  });

  ipcMain.handle('ai:getBuiltinModelName', async (_event, token: string) => {
    return aiFilteringService.getBuiltinModelName(token);
  });

  ipcMain.handle('ai:isConfigured', async (_event, token?: string) => {
    return aiFilteringService.isConfigured(token);
  });

  ipcMain.handle('ai:getServiceType', async () => {
    return aiFilteringService.getServiceType();
  });

  ipcMain.handle('ai:getExhaustedModels', async () => {
    return aiFilteringService.getExhaustedModels();
  });

  ipcMain.handle('copilot:requestDeviceCode', async () => {
    return aiFilteringService.getCopilotService().requestDeviceCode();
  });

  ipcMain.handle('copilot:pollForAccessToken', async (_event, deviceCode: string, interval: number) => {
    return aiFilteringService.getCopilotService().pollForAccessToken(deviceCode, interval);
  });

  ipcMain.handle('copilot:getUserInfo', async (_event, ghoToken: string) => {
    return aiFilteringService.getCopilotService().getUserInfo(ghoToken);
  });

  ipcMain.handle('copilot:validateToken', async (_event, ghoToken: string) => {
    return aiFilteringService.getCopilotService().validateGhoToken(ghoToken);
  });

  ipcMain.handle('copilot:exchangeToken', async (_event, ghoToken: string) => {
    return aiFilteringService.getCopilotService().exchangeToken(ghoToken);
  });

  ipcMain.handle('copilot:clearCache', async () => {
    aiFilteringService.getCopilotService().clearCache();
  });
}
