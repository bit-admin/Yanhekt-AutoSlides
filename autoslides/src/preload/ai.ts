import { ipcRenderer } from 'electron';

export const ai = {
  classifySingleImage: (base64Image: string, type: 'live' | 'recorded', token?: string, modelOverride?: string) =>
    ipcRenderer.invoke('ai:classifySingleImage', base64Image, type, token, modelOverride),
  classifyMultipleImages: (base64Images: string[], type: 'live' | 'recorded', token?: string, modelOverride?: string) =>
    ipcRenderer.invoke('ai:classifyMultipleImages', base64Images, type, token, modelOverride),
  getBuiltinModelName: (token: string) => ipcRenderer.invoke('ai:getBuiltinModelName', token),
  isConfigured: (token?: string) => ipcRenderer.invoke('ai:isConfigured', token),
  getServiceType: () => ipcRenderer.invoke('ai:getServiceType'),
  getExhaustedModels: () => ipcRenderer.invoke('ai:getExhaustedModels'),
};

export const copilot = {
  requestDeviceCode: () => ipcRenderer.invoke('copilot:requestDeviceCode'),
  pollForAccessToken: (deviceCode: string, interval: number) =>
    ipcRenderer.invoke('copilot:pollForAccessToken', deviceCode, interval),
  getUserInfo: (ghoToken: string) => ipcRenderer.invoke('copilot:getUserInfo', ghoToken),
  validateToken: (ghoToken: string) => ipcRenderer.invoke('copilot:validateToken', ghoToken),
  exchangeToken: (ghoToken: string) => ipcRenderer.invoke('copilot:exchangeToken', ghoToken),
  clearCache: () => ipcRenderer.invoke('copilot:clearCache'),
};
