import { describe, expect, it } from 'vitest';
import { rewriteYanhe2Playlist, yanhe2PlayProxyUrl } from './yanhe2PlayUrls';

const PLAYLIST = 'https://aita.yanhekt.cn/play/2/vod3/2026/09/21/67003639/1/Video1/Video1.m3u8';
const DIR = 'https://aita.yanhekt.cn/play/2/vod3/2026/09/21/67003639/1/Video1/';

describe('rewriteYanhe2Playlist', () => {
  it('sends every segment back through the proxy, unsigned', () => {
    const out = rewriteYanhe2Playlist(
      ['#EXTM3U', '#EXT-X-TARGETDURATION:22', '#EXTINF:20.0,', 'Video1_0.ts', '#EXTINF:20.0,', 'Video1_1.ts', '#EXT-X-ENDLIST', ''].join('\n'),
      PLAYLIST,
      4321,
      '1120231903',
    );
    const lines = out.split('\n');
    expect(lines[3]).toBe(yanhe2PlayProxyUrl(4321, '1120231903', `${DIR}Video1_0.ts`));
    expect(lines[5]).toBe(yanhe2PlayProxyUrl(4321, '1120231903', `${DIR}Video1_1.ts`));
    expect(lines[0]).toBe('#EXTM3U');
    expect(lines[6]).toBe('#EXT-X-ENDLIST');
    // A signature made now would be stale by the end of a long lecture.
    expect(out).not.toMatch(/[?&]t=|%26t%3D|%3Ft%3D/);
  });

  it('leaves a line that points outside /play/ alone', () => {
    const out = rewriteYanhe2Playlist('#EXTM3U\nhttps://example.com/a.ts\n', PLAYLIST, 4321, 'b');
    expect(out.split('\n')[1]).toBe('https://example.com/a.ts');
  });

  it('rewrites a URI attribute', () => {
    const out = rewriteYanhe2Playlist('#EXT-X-MAP:URI="init.mp4"', PLAYLIST, 4321, 'b');
    expect(out).toBe(`#EXT-X-MAP:URI="${yanhe2PlayProxyUrl(4321, 'b', `${DIR}init.mp4`)}"`);
  });
});
