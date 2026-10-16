import { ipcMain } from 'electron';
import type { CliControlResponse, CliDownloadUpdate } from '@common/cliControl';
import type { IpcServices } from './types';

/**
 * Settings → Add-ons → Command Line: install state of the PATH wrappers; and
 * the renderer's answers to `autoslides` commands (`@common/cliControl`).
 */
export function registerCliIpcHandlers(services: IpcServices): void {
  const { cliInstallService, cliControlBridge } = services;

  ipcMain.handle('cli:getStatus', async () => cliInstallService.getStatus());
  ipcMain.handle('cli:install', async () => cliInstallService.install());
  ipcMain.handle('cli:uninstall', async () => cliInstallService.uninstall());

  ipcMain.on('cli:controlReady', (event) => cliControlBridge.markReady(event.sender));
  ipcMain.on('cli:controlResponse', (event, response: CliControlResponse) =>
    cliControlBridge.handleResponse(event.sender, response)
  );
  ipcMain.on('cli:controlDownloadUpdate', (event, update: CliDownloadUpdate) =>
    cliControlBridge.handleDownloadUpdate(event.sender, update)
  );
}
