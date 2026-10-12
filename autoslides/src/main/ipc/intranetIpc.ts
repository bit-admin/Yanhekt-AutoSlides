import { ipcMain } from 'electron';
import os from 'node:os';
import type { IpcServices } from './types';
import { probeCampusConnection } from '@main/platform/campusNetworkProbe';

export function registerIntranetIpcHandlers(services: IpcServices): void {
  const { intranetMappingService, configService } = services;

  ipcMain.handle('intranet:getStatus', async () => {
    // Settings and the player ask when they open; make the answer current.
    await intranetMappingService.ensureFresh();
    return intranetMappingService.getNetworkStatus();
  });

  ipcMain.handle('intranet:getMappings', async () => {
    return intranetMappingService.getMappings();
  });

  // Settings → Network → Test Addresses: ask the campus resolver again, then
  // the page times each domain's addresses on its own so rows fill in as they answer.
  ipcMain.handle('intranet:refresh', async () => {
    await intranetMappingService.refresh();
    return { status: intranetMappingService.getNetworkStatus(), mappings: intranetMappingService.getMappings() };
  });

  ipcMain.handle('intranet:probeDomain', async (_event, domain: string) => {
    return intranetMappingService.probeDomain(String(domain));
  });

  ipcMain.handle('intranet:getNetworkInterfaces', async () => {
    const raw = os.networkInterfaces();
    const result: Array<{ name: string; address: string; family: 'IPv4' | 'IPv6'; internal: boolean; mac?: string; cidr: string | null }> = [];
    for (const [name, addrs] of Object.entries(raw)) {
      if (!addrs) continue;
      for (const addr of addrs) {
        if (addr.internal) continue;
        if (addr.family !== 'IPv4') continue;
        result.push({
          name,
          address: addr.address,
          family: addr.family,
          internal: addr.internal,
          mac: addr.mac,
          cidr: addr.cidr ?? null
        });
      }
    }
    return result;
  });

  ipcMain.handle('intranet:getInterfaceIp', async () => {
    return intranetMappingService.getInterfaceIp();
  });

  ipcMain.handle('intranet:setInterfaceIp', async (_event, ip: string | null) => {
    const normalized = ip && ip.trim() !== '' ? ip.trim() : null;
    let warning: string | undefined;

    if (normalized) {
      const raw = os.networkInterfaces();
      let found = false;
      for (const addrs of Object.values(raw)) {
        if (!addrs) continue;
        for (const addr of addrs) {
          if (!addr.internal && addr.address === normalized) {
            found = true;
            break;
          }
        }
        if (found) break;
      }
      if (!found) {
        warning = 'interface-not-found';
      }
    }

    intranetMappingService.setInterfaceIp(normalized);
    return { status: intranetMappingService.getNetworkStatus(), warning };
  });

  ipcMain.handle('intranet:checkCampusConnection', async () => {
    const host = configService.get('campusPortalHost', '10.0.0.55') || '10.0.0.55';
    const useHttps = configService.get('campusPortalUseHttps', false) || false;
    const interfaceIp = intranetMappingService.getInterfaceIp();
    return probeCampusConnection({ host, useHttps, interfaceIp });
  });
}
