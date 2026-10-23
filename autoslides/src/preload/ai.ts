import { invoke } from './invoke';
import type { ElectronAPI } from './electronApi';

export const ai: ElectronAPI['ai'] = {
  classifySingleImage: (base64Image: string, token?: string, modelOverride?: string) =>
    invoke('ai:classifySingleImage', base64Image, token, modelOverride),
  classifyMultipleImages: (base64Images: string[], token?: string, modelOverride?: string) =>
    invoke('ai:classifyMultipleImages', base64Images, token, modelOverride),
  getBuiltinModelName: (token: string) => invoke('ai:getBuiltinModelName', token),
  getBuiltinModelInfo: (token: string) => invoke('ai:getBuiltinModelInfo', token),
  isConfigured: (token?: string) => invoke('ai:isConfigured', token),
  getServiceType: () => invoke('ai:getServiceType'),
  getExhaustedModels: () => invoke('ai:getExhaustedModels'),
};

export const copilot: ElectronAPI['copilot'] = {
  requestDeviceCode: () => invoke('copilot:requestDeviceCode'),
  pollForAccessToken: (deviceCode: string, interval: number) =>
    invoke('copilot:pollForAccessToken', deviceCode, interval),
  getUserInfo: (ghoToken: string) => invoke('copilot:getUserInfo', ghoToken),
  validateToken: (ghoToken: string) => invoke('copilot:validateToken', ghoToken),
  exchangeToken: (ghoToken: string) => invoke('copilot:exchangeToken', ghoToken),
  clearCache: () => invoke('copilot:clearCache'),
};
