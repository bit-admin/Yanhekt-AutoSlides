import { ipcMain } from 'electron';
import type { IpcServices } from './types';

export function registerThemeIpcHandlers(services: IpcServices): void {
  const { configService } = services;
  let tourOriginalTheme: 'system' | 'light' | 'dark' | undefined;

  ipcMain.handle('tour:forceLightTheme', async () => {
    if (tourOriginalTheme === undefined) {
      tourOriginalTheme = configService.getThemeMode();
      configService.setThemeMode('light');
    }
    return tourOriginalTheme;
  });

  ipcMain.handle('tour:restoreTheme', async (_event, originalTheme: 'system' | 'light' | 'dark') => {
    configService.setThemeMode(originalTheme);
    tourOriginalTheme = undefined;
    return configService.getConfig();
  });
}
