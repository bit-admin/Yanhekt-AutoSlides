import { ipcMain } from 'electron';
import type { IpcServices } from './types';
import { broadcastConfig } from './broadcastConfig';
import type { Yanhe2ReadResult } from '@common/yanhe2Calendar';
import type { Yanhe2Playback, Yanhe2PlaybackResult, Yanhe2PlaybackStream } from '@common/yanhe2Playback';
import type { Yanhe2Slide } from '@common/yanhe2Slides';
import type { Yanhe2CaptionSyncResult } from '@common/yanhe2CaptionSync';
import type { Yanhe2SubtitlePrepared, Yanhe2SubtitleResult } from '@common/yanhe2Subtitles';
import type { Yanhe2DownloadPrepared } from '@common/yanhe2Download';
import type { Yanhe2SlideSavePrepared, Yanhe2SlideSaveProgress, Yanhe2SlideSaveResult } from '@common/yanhe2SlideSave';

// Yanhe 2.0 (aita.yanhekt.cn) account. Every handler takes the signed-in
// account's badge (student id) and plain strings. The JWT crosses the bridge
// only as pasted text coming in, or as `yanhe2:getJwt` going out to the
// Settings field — never inside the broadcast config. Handlers that may change
// a stored session broadcast config so `yanhe2SessionExpiry` follows.
export function registerYanhe2IpcHandlers(services: IpcServices): void {
  const { authService, yanhe2Service, yanhe2TwinResolver, yanhe2SlideImportService, yanhe2SubtitleService, yanhe2DownloadService, yanhe2CaptionSyncService, configService, videoProxyService } = services;

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

  // Curriculum reads, same rule.
  ipcMain.handle('yanhe2:myCourses', async (_event, account: string) => {
    const result = await yanhe2Service.getMyCourses(str(account));
    if (result.kind === 'signed_out') broadcast();
    return result;
  });

  ipcMain.handle('yanhe2:courseDetail', async (_event, account: string, query: unknown) => {
    const result = await yanhe2Service.getCourseDetail(str(account), query);
    if (result.kind === 'signed_out') broadcast();
    return result;
  });

  // Search reads, same rule.
  ipcMain.handle('yanhe2:terms', async (_event, account: string) => {
    const result = await yanhe2Service.getTerms(str(account));
    if (result.kind === 'signed_out') broadcast();
    return result;
  });

  ipcMain.handle('yanhe2:searchCourses', async (_event, account: string, query: unknown) => {
    const result = await yanhe2Service.searchCourses(str(account), query);
    if (result.kind === 'signed_out') broadcast();
    return result;
  });

  // The same course on the other site, by the registrar's number both keep.
  ipcMain.handle('yanhe2:findYanhektCourse', async (_event, account: string, query: unknown) => {
    const result = await yanhe2TwinResolver.findYanhektCourse(str(account), query);
    if (result.kind === 'signed_out') broadcast();
    return result;
  });

  ipcMain.handle('yanhe2:findYanhe2Course', async (_event, account: string, query: unknown) => {
    const result = await yanhe2TwinResolver.findYanhe2Course(str(account), query);
    if (result.kind === 'signed_out') broadcast();
    return result;
  });

  // One session's streams. Recorded media is signed per request with a secret
  // that stays in main, so those URLs are swapped for local proxy ones here.
  // Live streams are the unsigned live CDN playlists: they go out as they are
  // on the public route and through the local proxy on the intranet one.
  ipcMain.handle('yanhe2:playback', async (_event, account: string, query: unknown): Promise<Yanhe2PlaybackResult> => {
    const badge = str(account);
    const result = await yanhe2Service.getSubInfo(badge, query);
    if (result.kind === 'signed_out') broadcast();
    if (result.kind !== 'ok') return result;

    const { status, sources, audioUrl: upstreamAudio, ...details } = result.data;
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
        url: recorded
          ? await videoProxyService.getYanhe2PlayUrl(badge, source.url)
          : await videoProxyService.getYanhe2LiveUrl(badge, source.url),
      });
    }
    const audioUrl = recorded && upstreamAudio ? await videoProxyService.getYanhe2PlayUrl(badge, upstreamAudio) : '';
    const data: Yanhe2Playback = { mode: recorded ? 'recorded' : 'live', ...details, streams, audioUrl };
    return { kind: 'ok', data };
  });

  // One session's server slides. The images are public, but they are handed
  // out as local proxy URLs so they take the intranet route too.
  ipcMain.handle('yanhe2:slides', async (_event, account: string, query: unknown): Promise<Yanhe2ReadResult<Yanhe2Slide[]>> => {
    const result = await yanhe2Service.getSlides(str(account), query);
    if (result.kind === 'signed_out') broadcast();
    if (result.kind !== 'ok' || result.data.length === 0) return result;
    const urls = await videoProxyService.getYanhe2SlideUrls(result.data.map((slide) => slide.url));
    return { kind: 'ok', data: result.data.map((slide, index) => ({ seconds: slide.seconds, url: urls[index] })) };
  });

  // Saving the server slides as the same lecture's Yanhekt folder. `prepare`
  // finds that lecture and writes nothing; `save` does the work and reports
  // each slide written to the window that asked.
  ipcMain.handle('yanhe2:prepareSlideSave', async (_event, account: string, query: unknown): Promise<Yanhe2SlideSavePrepared> => {
    const result = await yanhe2SlideImportService.prepare(str(account), query);
    if (result.kind === 'signed_out') broadcast();
    return result;
  });

  ipcMain.handle('yanhe2:saveSlides', async (event, account: string, query: unknown): Promise<Yanhe2SlideSaveResult> => {
    const subId = str((query as { subId?: unknown } | null)?.subId);
    const result = await yanhe2SlideImportService.save(str(account), query, (done, total) => {
      if (event.sender.isDestroyed()) return;
      const progress: Yanhe2SlideSaveProgress = { subId, done, total };
      event.sender.send('yanhe2:slideSaveProgress', progress);
    });
    if (result.kind === 'signed_out') broadcast();
    return result;
  });

  // The transcript as a subtitle file beside the same lecture's Yanhekt
  // downloads. `shift` is the caption delay the player uses for this lecture.
  ipcMain.handle('yanhe2:prepareSubtitles', async (_event, account: string, query: unknown): Promise<Yanhe2SubtitlePrepared> => {
    const result = await yanhe2SubtitleService.prepare(str(account), query);
    if (result.kind === 'signed_out') broadcast();
    return result;
  });

  ipcMain.handle('yanhe2:saveSubtitles', async (_event, account: string, query: unknown, shift: unknown): Promise<Yanhe2SubtitleResult> => {
    const result = await yanhe2SubtitleService.save(str(account), query, shift);
    if (result.kind === 'signed_out') broadcast();
    return result;
  });

  // A recording's streams and the Yanhekt lecture they are filed under, before
  // any row is added. The download itself is `download:startYanhe2`.
  ipcMain.handle('yanhe2:prepareDownload', async (_event, account: string, query: unknown): Promise<Yanhe2DownloadPrepared> => {
    const result = await yanhe2DownloadService.prepare(str(account), query);
    if (result.kind === 'signed_out') broadcast();
    return result;
  });

  // One session's transcript, for the player's captions.
  ipcMain.handle('yanhe2:transcript', async (_event, account: string, subId: unknown) => {
    const result = await yanhe2Service.getTranscript(str(account), subId);
    if (result.kind === 'signed_out') broadcast();
    return result;
  });

  // How far one recording's transcript is off the recording. Measured once
  // (minutes of the recording's audio), then answered from the kept result.
  ipcMain.handle('yanhe2:captionSync', async (_event, account: string, query: unknown): Promise<Yanhe2CaptionSyncResult> => {
    const result = await yanhe2CaptionSyncService.measure(str(account), query);
    if (result.kind === 'signed_out') broadcast();
    return result;
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
