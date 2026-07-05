import { ipcMain, shell } from 'electron';
import { createLogger } from '@main/infra/logger';
const log = createLogger('ShellIpc');

// Schemes the renderer legitimately opens: web links (release notes, GitHub,
// docs, Yanhekt SSO, Copilot device-flow) and the feedback mailto link.
// Anything else (file:, javascript:, app protocols) is rejected — a renderer
// bug or injected content must not be able to launch arbitrary handlers.
const ALLOWED_EXTERNAL_SCHEMES = new Set(['https:', 'http:', 'mailto:']);

// URL-like (scheme://…) but not a Windows drive path like C:\.
function isUrlLike(value: string): boolean {
  return /^[a-z][a-z0-9+.-]*:/i.test(value) && !/^[a-zA-Z]:[\\/]/.test(value);
}

export function registerShellIpcHandlers(): void {
  ipcMain.handle('shell:openExternal', async (_, url: string) => {
    try {
      const scheme = new URL(url).protocol;
      if (!ALLOWED_EXTERNAL_SCHEMES.has(scheme)) {
        log.warn('Blocked openExternal for disallowed scheme:', scheme, url);
        return { success: false, error: `Blocked URL scheme: ${scheme}` };
      }
      await shell.openExternal(url);
      return { success: true };
    } catch (error) {
      log.error('Failed to open external URL:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  });

  ipcMain.handle('shell:openPath', async (_, filePath: string) => {
    try {
      // openPath is for filesystem paths only — URLs go through openExternal.
      if (isUrlLike(filePath)) {
        log.warn('Blocked openPath for URL-like argument:', filePath);
        return { success: false, error: 'openPath expects a filesystem path' };
      }
      // shell.openPath reports failure via a non-empty result string, not a throw.
      const openError = await shell.openPath(filePath);
      if (openError) {
        log.error('Failed to open path:', openError);
        return { success: false, error: openError };
      }
      return { success: true };
    } catch (error) {
      log.error('Failed to open path:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  });
}
