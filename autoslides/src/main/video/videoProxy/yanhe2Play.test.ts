import { describe, expect, it, vi } from 'vitest';

vi.mock('@main/infra/logger', () => ({
  createLogger: () => ({ debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }),
}));

import { YANHE2_PLAY_HEADERS, yanhe2UpstreamHeaders } from './yanhe2Play';

const identity = { userId: 10001, tenantId: 21, playSigningPhone: '13800138000', jwt: 'header.payload.sig' };
const LIVE = 'https://aita.yanhekt.cn/live/0123456789abcdef0123456789abcdef.m3u8?host=yanhe11&port=83';
const LIVE_SEGMENT = 'https://aita.yanhekt.cn/live/0123456789abcdef0123456789abcdef-467.ts?host=yanhe11&port=83';
const RECORDED = 'https://aita.yanhekt.cn/play/2/vod3/2026/09/21/51230000/1/Video1/Video1.m3u8';

describe('yanhe2UpstreamHeaders', () => {
  it('sends the JWT on aita live playlists and segments', () => {
    expect(yanhe2UpstreamHeaders(LIVE, identity)?.Authorization).toBe('Bearer header.payload.sig');
    expect(yanhe2UpstreamHeaders(LIVE_SEGMENT, identity)?.Authorization).toBe('Bearer header.payload.sig');
    expect(yanhe2UpstreamHeaders(LIVE, identity)?.Referer).toBe(YANHE2_PLAY_HEADERS.Referer);
  });

  it('keeps the JWT off recordings and off any other host', () => {
    expect(yanhe2UpstreamHeaders(RECORDED, identity)).toEqual(YANHE2_PLAY_HEADERS);
    expect(yanhe2UpstreamHeaders('https://clive11.yanhekt.cn/live/217_Video1.m3u8', identity)).toEqual(YANHE2_PLAY_HEADERS);
  });

  it('refuses a live request with no JWT', () => {
    expect(yanhe2UpstreamHeaders(LIVE, { ...identity, jwt: undefined })).toBeNull();
    expect(yanhe2UpstreamHeaders(RECORDED, { ...identity, jwt: undefined })).toEqual(YANHE2_PLAY_HEADERS);
  });
});
