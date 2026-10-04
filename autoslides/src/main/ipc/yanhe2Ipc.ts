import { ipcMain } from 'electron';
import type { IpcServices } from './types';
import { broadcastConfig } from './broadcastConfig';
import type { Yanhe2Playback, Yanhe2PlaybackResult, Yanhe2PlaybackStream } from '@common/yanhe2Playback';

// Yanhe 2.0 (aita.yanhekt.cn) account. Every handler takes the signed-in
// account's badge (student id) and plain strings. The JWT crosses the bridge
// only as pasted text coming in, or as `yanhe2:getJwt` going out to the
// Settings field — never inside the broadcast config. Handlers that may change
// a stored session broadcast config so `yanhe2SessionExpiry` follows.
export function registerYanhe2IpcHandlers(services: IpcServices): void {
  const { authService, yanhe2Service, configService, videoProxyService } = services;

  const str = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');
  const broadcast = () => broadcastConfig(configService);

  ipcMain.handle('yanhe2:login', async (_event, account: string, username: string, password: string) => {
    const result = await authService.yanhe2Login(str(account), str(username), typeof password === 'string' ? password : '');
    if (result.success) broadcast();
    return result;
  });

  ipcMain.handle('yanhe2:submitSmsCode', async (_event, account: string, challengeId: string, code: string) => {
    const result = await authService.yanhe2SubmitSmsCode(str(account), str(challengeId), str(code));
    if (result.success) broadcast();
    return result;
  });

  ipcMain.handle('yanhe2:cancelSmsChallenge', async (_event, challengeId: string) => {
    authService.cancelSmsChallenge(str(challengeId));
  });

  ipcMain.handle('yanhe2:autoSignIn', async (_event, account: string) => {
    const result = await authService.yanhe2AutoSignIn(str(account));
    if (result.success) broadcast();
    return result;
  });

  ipcMain.handle('yanhe2:check', async (_event, account: string) => {
    const state = await yanhe2Service.check(str(account));
    broadcast();
    return state;
  });

  ipcMain.handle('yanhe2:signOut', async (_event, account: string) => {
    yanhe2Service.signOut(str(account));
    broadcast();
  });

  // Settings' JWT field, and the menu's id/phone line. Not broadcast: the caller asks for one account.
  ipcMain.handle('yanhe2:getJwt', (_event, account: string) => yanhe2Service.getJwt(str(account)));

  ipcMain.handle('yanhe2:getProfile', (_event, account: string) => yanhe2Service.getProfile(str(account)));

  // Calendar reads. A refused token expires the stored session, so the menu follows.
  ipcMain.handle('yanhe2:calendarDay', async (_event, account: string, query: unknown) => {
    const result = await yanhe2Service.getCalendarDay(str(account), query);
    if (result.kind === 'signed_out') broadcast();
    return result;
  });

  ipcMain.handle('yanhe2:calendarWeek', async (_event, account: string, query: unknown) => {
    const result = await yanhe2Service.getWeekSchedule(str(account), query);
    if (result.kind === 'signed_out') broadcast();
    return result;
  });

  // One session's streams. Recorded media is signed per request with a secret
  // that stays in main, so those URLs are swapped for local proxy ones here;
  // live streams are the unsigned live CDN playlists and go out as they are.
  ipcMain.handle('yanhe2:playback', async (_event, account: string, query: unknown): Promise<Yanhe2PlaybackResult> => {
    const badge = str(account);
    const result = await yanhe2Service.getSubInfo(badge, query);
    if (result.kind === 'signed_out') broadcast();
    if (result.kind !== 'ok') return result;

    const { status, sources, ...details } = result.data;
    if ((status !== 'live' && status !== 'playable') || sources.length === 0) {
      return { kind: 'not_playable', status };
    }
    const recorded = status === 'playable';
    // No phone on the profile means nothing can be signed.
    if (recorded && !yanhe2Service.getPlayIdentity(badge)) return { kind: 'failed' };

    const streams: Yanhe2PlaybackStream[] = [];
    for (const source of sources) {
      streams.push({
        type: source.type,
        format: source.format,
        url: recorded ? await videoProxyService.getYanhe2PlayUrl(badge, source.url) : source.url,
      });
    }
    const data: Yanhe2Playback = { mode: recorded ? 'recorded' : 'live', ...details, streams };
    return { kind: 'ok', data };
  });

  ipcMain.handle('yanhe2:adoptCookies', async (_event, account: string, text: string) => {
    const result = await yanhe2Service.adoptPasted(typeof text === 'string' ? text : '', str(account));
    if (result.success) broadcast();
    return result;
  });

  ipcMain.handle('yanhe2:prepareBrowserSignIn', async () => {
    await yanhe2Service.prepareBrowserSignIn();
  });

  ipcMain.handle('yanhe2:adoptBrowserSession', async (_event, account: string) => {
    const result = await yanhe2Service.adoptBrowserSession(str(account));
    if (result.success) broadcast();
    return result;
  });
}
