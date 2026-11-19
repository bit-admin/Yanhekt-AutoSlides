import { invoke } from './invoke';
import type { ElectronAPI } from './electronApi';

export const webCapture: ElectronAPI['webCapture'] = {
  getGuestPreloadPath: () => invoke('webCapture:getGuestPreloadPath'),
};
