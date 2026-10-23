import { invoke } from './invoke';
import type { ElectronAPI } from './electronApi';

export const localRelay: ElectronAPI['localRelay'] = {
  getStatus: () => invoke('localRelay:getStatus'),
};
