import { ipcMain } from 'electron';
import type { IpcServices } from './types';

// Pinned courses. Main writes the list and broadcasts config itself
// (`PinSyncService`), so these return as soon as the local change is made;
// sending it to Yanhekt and Yanhe 2.0 follows in the background.
export function registerPinsIpcHandlers({ pinSyncService }: IpcServices): void {
  ipcMain.handle('pins:sync', async (_event, owner: unknown) => {
    if (typeof owner !== 'string') return;
    await pinSyncService.sync(owner);
  });

  ipcMain.handle('pins:toggle', (_event, owner: unknown, request: unknown) =>
    pinSyncService.toggle(typeof owner === 'string' ? owner : '', request));

  ipcMain.handle('pins:remove', (_event, owner: unknown, key: unknown) => {
    pinSyncService.remove(typeof owner === 'string' ? owner : '', key);
  });

  ipcMain.handle('pins:upgrade', (_event, owner: unknown, request: unknown) => {
    pinSyncService.upgrade(typeof owner === 'string' ? owner : '', request);
  });
}
