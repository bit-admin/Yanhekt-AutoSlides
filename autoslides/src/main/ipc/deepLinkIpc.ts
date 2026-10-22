import { ipcMain } from 'electron';
import type { IpcServices } from './types';

/** `autoslides://` links: the renderer says when it can take one (`DeepLinkRouter`). */
export function registerDeepLinkIpcHandlers(services: IpcServices): void {
  const { deepLinkRouter } = services;
  ipcMain.on('deepLink:ready', (event) => deepLinkRouter.markReady(event.sender));
}
