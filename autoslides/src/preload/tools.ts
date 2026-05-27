import { ipcRenderer } from 'electron';

export const tools = {
  openWindow: (tab?: string) => ipcRenderer.invoke('tools:openWindow', tab),
  onSwitchTab: (callback: (tab: string) => void) => {
    ipcRenderer.on('tools:switchTab', (_event, tab) => callback(tab));
  },
};

export const addons = {
  openWindow: (tab?: string) => ipcRenderer.invoke('addons:openWindow', tab),
  onSwitchTab: (callback: (tab: string) => void) => {
    ipcRenderer.on('addons:switchTab', (_event, tab) => callback(tab));
  },
};

export const webCapture = {
  getGuestPreloadPath: (): Promise<string> => ipcRenderer.invoke('webCapture:getGuestPreloadPath'),
};
