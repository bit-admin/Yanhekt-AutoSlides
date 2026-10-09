import { ipcMain } from 'electron';
import type { IpcServices } from './types';

/** Settings → Add-ons → Command Line: install state of the PATH wrappers. */
export function registerCliIpcHandlers(services: IpcServices): void {
  const { cliInstallService } = services;

  ipcMain.handle('cli:getStatus', async () => cliInstallService.getStatus());
  ipcMain.handle('cli:install', async () => cliInstallService.install());
  ipcMain.handle('cli:uninstall', async () => cliInstallService.uninstall());
}
