import { invoke } from './invoke';
import type { ElectronAPI } from './electronApi';

export const intranet: ElectronAPI['intranet'] = {
  getStatus: () => invoke('intranet:getStatus'),
  getMappings: () => invoke('intranet:getMappings'),
  refresh: () => invoke('intranet:refresh'),
  probeDomain: (domain: string) => invoke('intranet:probeDomain', domain),
  getNetworkInterfaces: () => invoke('intranet:getNetworkInterfaces'),
  getInterfaceIp: () => invoke('intranet:getInterfaceIp'),
  setInterfaceIp: (ip: string | null) => invoke('intranet:setInterfaceIp', ip),
  checkCampusConnection: () => invoke('intranet:checkCampusConnection'),
};
