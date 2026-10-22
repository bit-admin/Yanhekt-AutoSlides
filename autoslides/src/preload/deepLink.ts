import { ipcRenderer, type IpcRendererEvent } from 'electron';
import type { DeepLink } from '../shared/deepLink';
import type { ElectronAPI } from './electronApi';

export const deepLink: ElectronAPI['deepLink'] = {
  onOpen: (callback) => {
    const listener = (_event: IpcRendererEvent, link: DeepLink) => callback(link);
    ipcRenderer.on('deepLink:open', listener);
    return () => {
      ipcRenderer.removeListener('deepLink:open', listener);
    };
  },
  ready: () => ipcRenderer.send('deepLink:ready'),
};
