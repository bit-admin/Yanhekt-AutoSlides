import { ipcRenderer, type IpcRendererEvent } from 'electron';
import { invoke } from './invoke';
import type { CliControlRequest } from '../shared/cliControl';
import type { ElectronAPI } from './electronApi';

export const cli: ElectronAPI['cli'] = {
  getStatus: () => invoke('cli:getStatus'),
  install: () => invoke('cli:install'),
  uninstall: () => invoke('cli:uninstall'),
  onControlRequest: (callback) => {
    const listener = (_event: IpcRendererEvent, request: CliControlRequest) => callback(request);
    ipcRenderer.on('cli:controlRequest', listener);
    return () => {
      ipcRenderer.removeListener('cli:controlRequest', listener);
    };
  },
  controlReady: () => ipcRenderer.send('cli:controlReady'),
  controlRespond: (response) => ipcRenderer.send('cli:controlResponse', response),
  controlDownloadUpdate: (update) => ipcRenderer.send('cli:controlDownloadUpdate', update),
};
