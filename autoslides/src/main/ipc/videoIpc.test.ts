import { describe, expect, it, vi } from 'vitest';
import type { DevPlaybackResult } from '@common/devPlayback';
import type { IpcServices } from './types';
import { registerVideoIpcHandlers } from './videoIpc';

const handlers = vi.hoisted(() => new Map<string, (...args: unknown[]) => Promise<DevPlaybackResult>>());
vi.mock('electron', () => ({
  ipcMain: { handle: (channel: string, handler: (...args: unknown[]) => Promise<DevPlaybackResult>) => handlers.set(channel, handler) },
}));
vi.mock('@main/infra/logger', () => ({ createLogger: () => ({ warn: vi.fn() }) }));

const LIVE = 'https://aita.yanhekt.cn/live/demo.m3u8?host=yanhe11&port=83';
const RECORDING = 'https://cvideo.yanhekt.cn/vod/example/VGA/VGA.m3u8';
const AUDIO = 'https://cvideo.yanhekt.cn/vod/example/SubAudio/mic.aac';

function setup() {
  const configService = {
    getDeveloperMode: vi.fn(() => true),
    getAuthToken: vi.fn<() => string | null>(() => 'fixture-token'),
    getPreferAnonymousApiRequests: vi.fn(() => false),
  };
  const yanhe2Service = { getPlayIdentity: vi.fn<() => object | null>(() => ({})) };
  const videoProxyService = {
    registerClient: vi.fn(() => 'client_1'),
    unregisterClient: vi.fn(),
    getYanhe2PlayUrl: vi.fn(async () => 'http://localhost:1234/yanhe2'),
    getYanhektPlayUrl: vi.fn(async () => 'http://localhost:1234/recorded'),
  };
  registerVideoIpcHandlers({ configService, yanhe2Service, videoProxyService } as unknown as IpcServices);
  const handler = handlers.get('video:prepareDevPlayback')!;
  return { prepare: (url: string, account = '') => handler(undefined, url, account), configService, yanhe2Service, videoProxyService };
}

describe('video:prepareDevPlayback', () => {
  it('refuses requests while developer mode is off or the URL is unsupported', async () => {
    const { prepare, configService, videoProxyService } = setup();
    configService.getDeveloperMode.mockReturnValueOnce(false);
    await expect(prepare(RECORDING)).resolves.toEqual({ kind: 'disabled' });
    await expect(prepare('https://example.com/demo.mp4')).resolves.toEqual({ kind: 'invalidUrl' });
    expect(videoProxyService.registerClient).not.toHaveBeenCalled();
  });

  it('uses the selected badge and the normal Yanhe 2.0 playback proxy', async () => {
    const { prepare, yanhe2Service, videoProxyService } = setup();
    await expect(prepare(LIVE, '123456')).resolves.toMatchObject({ kind: 'ok', platform: 'yanhe2', format: 'hls', live: true, clientId: 'client_1' });
    expect(yanhe2Service.getPlayIdentity).toHaveBeenCalledWith('123456');
    expect(videoProxyService.getYanhe2PlayUrl).toHaveBeenCalledWith('123456', LIVE);
  });

  it('reports a missing Yanhe 2.0 session before starting a proxy client', async () => {
    const { prepare, yanhe2Service, videoProxyService } = setup();
    yanhe2Service.getPlayIdentity.mockReturnValue(null);
    await expect(prepare(LIVE, '123456')).resolves.toEqual({ kind: 'yanhe2SignIn' });
    expect(videoProxyService.registerClient).not.toHaveBeenCalled();
  });

  it('uses the stored Yanhekt token only for a recorded HLS playlist', async () => {
    const { prepare, configService, videoProxyService } = setup();
    const live = 'https://clive13.yanhekt.cn/live/demo_Video1.m3u8';
    await expect(prepare(RECORDING)).resolves.toMatchObject({ kind: 'ok', platform: 'yanhekt', format: 'hls', live: false });
    await expect(prepare(AUDIO)).resolves.toMatchObject({ kind: 'ok', format: 'aac' });
    await expect(prepare(live)).resolves.toMatchObject({ kind: 'ok', format: 'hls', live: true });
    expect(configService.getAuthToken).toHaveBeenCalledTimes(1);
    expect(videoProxyService.getYanhektPlayUrl).toHaveBeenNthCalledWith(1, 'recorded', RECORDING, 'fixture-token');
    expect(videoProxyService.getYanhektPlayUrl).toHaveBeenNthCalledWith(2, 'audio', AUDIO, undefined);
    expect(videoProxyService.getYanhektPlayUrl).toHaveBeenNthCalledWith(3, 'live', live, undefined);
  });

  it('asks for a Yanhekt sign-in while Anonymous API requests is off', async () => {
    const { prepare, configService, videoProxyService } = setup();
    configService.getAuthToken.mockReturnValue(null);
    await expect(prepare(RECORDING)).resolves.toEqual({ kind: 'yanhektSignIn' });
    expect(videoProxyService.registerClient).not.toHaveBeenCalled();
  });

  it('plays a signed-out Yanhekt recording while Anonymous API requests is on', async () => {
    const { prepare, configService, videoProxyService } = setup();
    configService.getAuthToken.mockReturnValue(null);
    configService.getPreferAnonymousApiRequests.mockReturnValue(true);
    await expect(prepare(RECORDING)).resolves.toMatchObject({ kind: 'ok', platform: 'yanhekt', format: 'hls' });
    expect(videoProxyService.getYanhektPlayUrl).toHaveBeenCalledWith('recorded', RECORDING, undefined);
  });

  it('releases the proxy client if preparation fails', async () => {
    const { prepare, videoProxyService } = setup();
    videoProxyService.getYanhektPlayUrl.mockRejectedValueOnce(new Error('fixture proxy failure'));
    await expect(prepare(AUDIO)).resolves.toEqual({ kind: 'proxyFailed' });
    expect(videoProxyService.unregisterClient).toHaveBeenCalledWith('client_1');
  });
});
