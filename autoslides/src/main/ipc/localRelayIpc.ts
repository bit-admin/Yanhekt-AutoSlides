import { ipcMain } from 'electron';
import type { IpcServices } from './types';

export function registerLocalRelayIpcHandlers(services: IpcServices): void {
  const { localRelayService } = services;

  ipcMain.handle('localRelay:getStatus', async () => {
    return localRelayService.getStatus();
  });
}
