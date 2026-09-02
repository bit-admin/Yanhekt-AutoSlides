import { ipcRenderer } from 'electron';
import type { ElectronAPI } from './electronApi';

export const localRelay: ElectronAPI['localRelay'] = {
  getStatus: () => ipcRenderer.invoke('localRelay:getStatus'),
};
