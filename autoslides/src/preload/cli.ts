import { ipcRenderer } from 'electron';
import type { ElectronAPI } from './electronApi';

export const cli: ElectronAPI['cli'] = {
  getStatus: () => ipcRenderer.invoke('cli:getStatus'),
  install: () => ipcRenderer.invoke('cli:install'),
  uninstall: () => ipcRenderer.invoke('cli:uninstall'),
};
