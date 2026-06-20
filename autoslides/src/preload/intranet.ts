import { ipcRenderer } from 'electron';

export const intranet = {
  setEnabled: (enabled: boolean) => ipcRenderer.invoke('intranet:setEnabled', enabled),
  getStatus: () => ipcRenderer.invoke('intranet:getStatus'),
  getMappings: () => ipcRenderer.invoke('intranet:getMappings'),
  getNetworkInterfaces: () => ipcRenderer.invoke('intranet:getNetworkInterfaces'),
  getInterfaceIp: () => ipcRenderer.invoke('intranet:getInterfaceIp'),
  setInterfaceIp: (ip: string | null) => ipcRenderer.invoke('intranet:setInterfaceIp', ip),
  checkCampusConnection: () => ipcRenderer.invoke('intranet:checkCampusConnection'),
};
