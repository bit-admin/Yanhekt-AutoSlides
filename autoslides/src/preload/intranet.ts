import { ipcRenderer } from 'electron';
import type { ElectronAPI } from './electronApi';

export const intranet: ElectronAPI['intranet'] = {
  getStatus: () => ipcRenderer.invoke('intranet:getStatus'),
  getMappings: () => ipcRenderer.invoke('intranet:getMappings'),
  refresh: () => ipcRenderer.invoke('intranet:refresh'),
  probeDomain: (domain: string) => ipcRenderer.invoke('intranet:probeDomain', domain),
  getNetworkInterfaces: () => ipcRenderer.invoke('intranet:getNetworkInterfaces'),
  getInterfaceIp: () => ipcRenderer.invoke('intranet:getInterfaceIp'),
  setInterfaceIp: (ip: string | null) => ipcRenderer.invoke('intranet:setInterfaceIp', ip),
  checkCampusConnection: () => ipcRenderer.invoke('intranet:checkCampusConnection'),
};
