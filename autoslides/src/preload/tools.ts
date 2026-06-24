import { ipcRenderer } from 'electron';

export const tools = {
  openWindow: (tab?: string) => ipcRenderer.invoke('tools:openWindow', tab),
  onSwitchTab: (callback: (tab: string) => void) => {
    const handler = (_event: unknown, tab: string) => callback(tab);
    ipcRenderer.on('tools:switchTab', handler);
    return () => ipcRenderer.removeListener('tools:switchTab', handler);
  },
};

export const webCapture = {
  getGuestPreloadPath: (): Promise<string> => ipcRenderer.invoke('webCapture:getGuestPreloadPath'),
};
