import { ipcRenderer } from 'electron';
import type { ElectronAPI } from './electronApi';

export const ai: ElectronAPI['ai'] = {
  classifySingleImage: (base64Image: string, token?: string, modelOverride?: string) =>
    ipcRenderer.invoke('ai:classifySingleImage', base64Image, token, modelOverride),
  classifyMultipleImages: (base64Images: string[], token?: string, modelOverride?: string) =>
    ipcRenderer.invoke('ai:classifyMultipleImages', base64Images, token, modelOverride),
  getBuiltinModelName: (token: string) => ipcRenderer.invoke('ai:getBuiltinModelName', token),
  getBuiltinModelInfo: (token: string) => ipcRenderer.invoke('ai:getBuiltinModelInfo', token),
  isConfigured: (token?: string) => ipcRenderer.invoke('ai:isConfigured', token),
  getServiceType: () => ipcRenderer.invoke('ai:getServiceType'),
  getExhaustedModels: () => ipcRenderer.invoke('ai:getExhaustedModels'),
};

export const copilot: ElectronAPI['copilot'] = {
  requestDeviceCode: () => ipcRenderer.invoke('copilot:requestDeviceCode'),
  pollForAccessToken: (deviceCode: string, interval: number) =>
    ipcRenderer.invoke('copilot:pollForAccessToken', deviceCode, interval),
  getUserInfo: (ghoToken: string) => ipcRenderer.invoke('copilot:getUserInfo', ghoToken),
  validateToken: (ghoToken: string) => ipcRenderer.invoke('copilot:validateToken', ghoToken),
  exchangeToken: (ghoToken: string) => ipcRenderer.invoke('copilot:exchangeToken', ghoToken),
  clearCache: () => ipcRenderer.invoke('copilot:clearCache'),
};
