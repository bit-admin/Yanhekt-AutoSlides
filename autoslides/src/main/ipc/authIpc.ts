import { ipcMain, session } from 'electron';
import type { IpcServices } from './types';

export function registerAuthIpcHandlers(services: IpcServices): void {
  const { authService, apiClient } = services;

  ipcMain.handle('auth:login', async (_event, username: string, password: string) => {
    return await authService.loginAndGetToken(username, password);
  });

  ipcMain.handle('auth:verifyToken', async (_event, token: string) => {
    return await apiClient.verifyToken(token);
  });

  ipcMain.handle('auth:clearBrowserData', async () => {
    try {
      const ses = session.fromPartition('persist:browserlogin');
      const cookies = await ses.cookies.get({});
      for (const cookie of cookies) {
        const domain = cookie.domain?.startsWith('.') ? cookie.domain.slice(1) : cookie.domain;
        if (domain?.includes('yanhekt.cn') || domain?.includes('bit.edu.cn')) {
          const url = `http${cookie.secure ? 's' : ''}://${domain}${cookie.path || '/'}`;
          await ses.cookies.remove(url, cookie.name);
        }
      }
      await ses.clearStorageData({
        storages: ['localstorage', 'cookies', 'cachestorage'],
        quotas: ['temporary']
      });
      return { success: true };
    } catch (error) {
      console.error('Failed to clear browser data:', error);
      return { success: false, error: String(error) };
    }
  });
}
