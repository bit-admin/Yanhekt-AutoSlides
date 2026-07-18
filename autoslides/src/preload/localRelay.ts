import { ipcRenderer } from 'electron';

export const localRelay = {
  getStatus: () => ipcRenderer.invoke('localRelay:getStatus'),
};
