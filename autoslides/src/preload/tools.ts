import { ipcRenderer } from 'electron';
import { invoke } from './invoke';
import type { ElectronAPI } from './electronApi';

export const tools: ElectronAPI['tools'] = {
  openWindow: (tab?: string) => invoke('tools:openWindow', tab),
  onSwitchTab: (callback: (tab: string) => void) => {
    const handler = (_event: unknown, tab: string) => callback(tab);
    ipcRenderer.on('tools:switchTab', handler);
    return () => ipcRenderer.removeListener('tools:switchTab', handler);
  },
};

export const webCapture: ElectronAPI['webCapture'] = {
  getGuestPreloadPath: (): Promise<string> => invoke('webCapture:getGuestPreloadPath'),
};
