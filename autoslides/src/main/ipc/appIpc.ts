import { ipcMain, app, shell } from 'electron';
import { createLogger } from '@main/infra/logger';
import { getLogDir, writeLogMessage } from '@main/infra/logFile';
import {
  LOG_LEVELS,
  LOG_SOURCES,
  MAX_MESSAGE_CHARS,
  type LogLevel,
  type LogSource,
} from '@common/logFormat';
const log = createLogger('AppIpc');

export function registerAppIpcHandlers(): void {
  ipcMain.handle('app:restart', async () => {
    try {
      app.relaunch();
      app.exit(0);
    } catch (error) {
      log.error('Failed to restart app:', error);
      throw error;
    }
  });

  // Quit the whole app. window:close is not a quit on macOS — the app stays in
  // the Dock after its last window closes. app.quit() still runs the busy-work
  // close guard in main.ts (before-quit → window 'close').
  ipcMain.handle('app:quit', () => {
    app.quit();
  });

  ipcMain.handle('app:getVersion', () => app.getVersion());

  // Renderer log forwarding. Fire-and-forget (`send`, not `invoke`), and the
  // renderer has already formatted everything into strings.
  ipcMain.on('log:write', (_event, level: unknown, source: unknown, namespace: unknown, message: unknown) => {
    if (!LOG_LEVELS.includes(level as LogLevel)) return;
    const src = LOG_SOURCES.includes(source as LogSource) && source !== 'main' ? (source as LogSource) : 'renderer';
    const ns = typeof namespace === 'string' ? namespace.slice(0, 64) : 'unknown';
    const text = typeof message === 'string' ? message.slice(0, MAX_MESSAGE_CHARS) : String(message);
    writeLogMessage(level as LogLevel, src, ns, text);
  });

  ipcMain.handle('app:getLogDir', () => getLogDir());

  ipcMain.handle('app:openLogFolder', async () => {
    const dir = getLogDir();
    if (!dir) return { success: false, error: 'Log folder is not available' };
    // shell.openPath reports failure via a non-empty result string, not a throw.
    const openError = await shell.openPath(dir);
    return openError ? { success: false, error: openError } : { success: true };
  });
}
