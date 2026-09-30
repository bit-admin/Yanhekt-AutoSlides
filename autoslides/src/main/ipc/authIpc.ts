import { ipcMain, session } from 'electron';
import path from 'node:path';
import type { IpcServices } from './types';
import { createLogger } from '@main/infra/logger';
import { decryptPassword, encryptPassword } from '@main/platform/passwordCipher';
import {
  SAVED_LOGIN_LIMITS,
  forgetSavedLogin,
  upsertSavedLogin,
} from '@main/platform/savedLogins';
const log = createLogger('AuthIpc');

export function registerAuthIpcHandlers(services: IpcServices): void {
  const { authService, apiClient, configService } = services;

  // May resolve with a token, a failure, or an `smsChallenge` the renderer has
  // to answer via auth:submitSmsCode. The CAS flow behind the challenge stays
  // parked in the main process; only its opaque id crosses the bridge.
  ipcMain.handle('auth:login', async (_event, username: string, password: string) => {
    return await authService.loginAndGetToken(username, password);
  });

  ipcMain.handle('auth:submitSmsCode', async (_event, challengeId: string, code: string) => {
    return await authService.submitSmsCode(challengeId, code);
  });

  ipcMain.handle('auth:cancelSmsChallenge', async (_event, challengeId: string) => {
    authService.cancelSmsChallenge(challengeId);
    return { success: true };
  });

  ipcMain.handle('auth:verifyToken', async (_event, token: string) => {
    return await apiClient.verifyToken(token);
  });

  // Best-effort server revoke; local sign-out never awaits this for success.
  ipcMain.handle('auth:revokeToken', async (_event, token: string) => {
    await apiClient.revokeToken(token);
  });

  // Saved SSO logins. The list is usernames only — a password crosses the
  // bridge solely when the user picks a row or opens it in Settings.
  ipcMain.handle('auth:listSavedLogins', async () => {
    return configService.getSavedLogins()
      .slice()
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .map(({ badge, username }) => ({ badge, username }));
  });

  ipcMain.handle('auth:getSavedLogin', async (_event, badge: string) => {
    const key = typeof badge === 'string' ? badge.trim() : '';
    if (!key) return null;
    const row = configService.getSavedLogins().find((candidate) => candidate.badge === key);
    if (!row) return null;
    const decrypted = decryptPassword(row.passwordEnc);
    if (!decrypted.ok) return null;
    return { username: row.username, password: decrypted.value };
  });

  ipcMain.handle('auth:saveSavedLogin', async (_event, badge: string, username: string, password: string) => {
    const key = typeof badge === 'string' ? badge.trim() : '';
    const user = typeof username === 'string' ? username.trim() : '';
    const secret = typeof password === 'string' ? password : '';
    if (
      !key || !user || !secret
      || key.length > SAVED_LOGIN_LIMITS.badge
      || user.length > SAVED_LOGIN_LIMITS.username
      || secret.length > SAVED_LOGIN_LIMITS.password
    ) {
      return { ok: false as const, error: 'invalid' as const };
    }
    const encrypted = encryptPassword(secret);
    if (!encrypted.ok) return { ok: false as const, error: encrypted.error };
    configService.setSavedLogins(upsertSavedLogin(configService.getSavedLogins(), {
      badge: key,
      username: user,
      passwordEnc: encrypted.value,
      updatedAt: Date.now(),
    }));
    return { ok: true as const };
  });

  ipcMain.handle('auth:forgetSavedLogin', async (_event, badge: string) => {
    const key = typeof badge === 'string' ? badge.trim() : '';
    if (!key) return;
    configService.setSavedLogins(forgetSavedLogin(configService.getSavedLogins(), key));
  });

  // Guest preload for the browser sign-in <webview>: reports the CAS
  // username/password fields so the saved-logins menu can be drawn over them.
  ipcMain.handle('auth:getBrowserLoginPreloadPath', async () => {
    const absolute = path.join(__dirname, 'webviewSsoPreload.js');
    return new URL(`file://${absolute}`).toString();
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
      log.error('Failed to clear browser data:', error);
      return { success: false, error: String(error) };
    }
  });
}
