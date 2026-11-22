import { describe, expect, it, vi } from 'vitest';
import { sanitizeDownloadName } from '@common/downloadNaming';
import { devDownloadStem, isDevDownloadStem, parseDevPlaybackUrl } from './devPlaybackUrl';
import { rewriteM3u8TsUrls } from './urlHelpers';

vi.mock('@main/infra/logger', () => ({ createLogger: () => ({ error: vi.fn() }) }));

describe('parseDevPlaybackUrl', () => {
  it.each([
    ['https://cvideo.yanhekt.cn/vod/example/VGA/VGA.m3u8', 'yanhekt', 'hls', false, 'recorded'],
    ['https://cvideo.yanhekt.cn/vod/example/SubAudio/mic.aac', 'yanhekt', 'aac', false, 'audio'],
    ['https://clive13.yanhekt.cn/live/demo_Video1.m3u8', 'yanhekt', 'hls', true, 'live'],
    ['https://aita.yanhekt.cn/play/2/vod4/example/Video1/Video1.m3u8', 'yanhe2', 'hls', false, undefined],
    ['https://aita.yanhekt.cn/play/frim_files/ppt2026/example.mp4', 'yanhe2', 'mp4', false, undefined],
    ['https://aita.yanhekt.cn/play/2/vod4/example/SubAudio/mic.aac', 'yanhe2', 'aac', false, undefined],
    ['https://aita.yanhekt.cn/live/demo.m3u8?host=yanhe11&port=83', 'yanhe2', 'hls', true, undefined],
  ])('matches the API media shape %s', (url, platform, format, live, route) => {
    expect(parseDevPlaybackUrl(url)).toEqual({ platform, url, format, live, ...(route ? { route } : {}) });
  });

  it('accepts pasted API slash escapes and discards stale signatures without losing the Yanhe 2.0 live route', () => {
    expect(parseDevPlaybackUrl(' https:\\/\\/aita.yanhekt.cn\\/live\\/demo.m3u8?t=stale&host=yanhe11&port=83#fragment '))
      .toMatchObject({ url: 'https://aita.yanhekt.cn/live/demo.m3u8?host=yanhe11&port=83' });
  });

  it.each([
    null,
    'not a URL',
    'https://www.yanhekt.cn/session/example',
    'https://aita.yanhekt.cn/courseapi/example.mp4',
    'https://aita.yanhekt.cn/play/example.ts',
    'https://aita.yanhekt.cn/play/example.jpg',
    'https://aita.yanhekt.cn/live/example.flv',
    'https://cvideo.yanhekt.cn/vod/example.m3u8?Xvideo_Token=stale',
    'https://aita.yanhekt.cn.example.com/play/example.mp4',
    'https://cvideo.yanhekt.cn:8443/vod/example.m3u8',
    'https://user:pass@aita.yanhekt.cn/play/example.mp4',
    'http://aita.yanhekt.cn/play/example.mp4',
  ])('rejects unsupported inputs: %s', (url) => {
    expect(parseDevPlaybackUrl(url)).toBeNull();
  });
});

describe('devDownloadStem', () => {
  const now = new Date(2026, 10, 22, 9, 5, 7);

  it('names a file without lecture metadata and survives the queue sanitizer', () => {
    const stem = devDownloadStem({ platform: 'yanhekt', url: 'https://cvideo.yanhekt.cn/vod/example/VGA/VGA.m3u8' }, now);
    expect(stem).toMatch(/^dev_yanhekt_VGA_[0-9a-f]{8}_20261122-090507$/);
    expect(isDevDownloadStem(stem)).toBe(true);
    expect(sanitizeDownloadName(stem)).toBe(stem);
  });

  it('keeps odd file names safe', () => {
    const stem = devDownloadStem({ platform: 'yanhe2', url: 'https://aita.yanhekt.cn/play/a/%E8%AF%BE__1.mp4' }, now);
    expect(isDevDownloadStem(stem)).toBe(true);
    expect(sanitizeDownloadName(stem)).toBe(stem);
  });

  it.each(['../evil', 'dev_yanhekt_a/b', 'dev_other_a', 'dev_yanhekt_a__b', '', null])('rejects %s', (value) => {
    expect(isDevDownloadStem(value)).toBe(false);
  });
});

it('proxies an unsigned Yanhekt live segment without a login token', () => {
  const playlistUrl = 'https://clive13.yanhekt.cn/live/demo.m3u8';
  const rewritten = rewriteM3u8TsUrls('#EXTM3U\n#EXTINF:3,\ndemo-1.ts', 12345, playlistUrl, 'live');
  const segment = new URL(rewritten.split('\n')[2]);
  expect(segment.pathname).toBe('/live/demo-1.ts');
  expect(segment.searchParams.get('baseUrl')).toBe(playlistUrl);
  expect(segment.searchParams.has('loginToken')).toBe(false);
});
