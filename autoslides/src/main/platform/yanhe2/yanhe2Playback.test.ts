import { describe, expect, it } from 'vitest';
import { isYanhe2PlayUrl, parseSubInfo, signYanhe2PlayPath, signYanhe2PlayUrl } from './yanhe2Playback';

const identity = { userId: 10001, tenantId: 21, playSigningPhone: '13800138000' };
const TEACHER = 'https://aita.yanhekt.cn/play/2/vod3/2026/09/21/67003639/1/Video1/Video1.m3u8';
const SCREEN = 'https://aita.yanhekt.cn/play/frim_files/ppt2026/2026-09-21/2026-09-21/AAAA_1080p.mp4';
const ROOM = 'https://aita.yanhekt.cn/play/default/2026/09/21/bbbb_1920_1080.mp4';

describe('signYanhe2PlayPath', () => {
  it('matches the golden vector', () => {
    expect(signYanhe2PlayPath('/play/2/vod3/2026/09/21/67003639/1/Video1/Video1.m3u8', identity, 1700000000))
      .toBe('10001-1700000000-64045f6c23579f3de2974d9bb2d122f5');
  });

  it('signs each path on its own', () => {
    const a = signYanhe2PlayPath('/play/a/Video1.m3u8', identity, 1700000000);
    const b = signYanhe2PlayPath('/play/a/Video1_0.ts', identity, 1700000000);
    expect(a).not.toBe(b);
  });
});

describe('signYanhe2PlayUrl', () => {
  it('hashes the pathname only and keeps an existing query', () => {
    const signed = new URL(signYanhe2PlayUrl(`${TEACHER}?clientUUID=x`, identity, 1700000000_000));
    expect(signed.searchParams.get('clientUUID')).toBe('x');
    expect(signed.searchParams.get('t')).toBe('10001-1700000000-64045f6c23579f3de2974d9bb2d122f5');
  });

  it('replaces a stale t', () => {
    const signed = new URL(signYanhe2PlayUrl(`${TEACHER}?t=old`, identity, 1700000000_000));
    expect(signed.searchParams.getAll('t')).toEqual(['10001-1700000000-64045f6c23579f3de2974d9bb2d122f5']);
  });
});

describe('isYanhe2PlayUrl', () => {
  it('accepts playlists, segments and MP4s under /play/', () => {
    expect(isYanhe2PlayUrl(TEACHER)).toBe(true);
    expect(isYanhe2PlayUrl(SCREEN)).toBe(true);
    expect(isYanhe2PlayUrl('https://aita.yanhekt.cn/play/2/vod3/x/Video1_12.ts')).toBe(true);
  });

  it('refuses other hosts, other trees and other files', () => {
    expect(isYanhe2PlayUrl('https://example.com/play/a.m3u8')).toBe(false);
    expect(isYanhe2PlayUrl('http://aita.yanhekt.cn/play/a.m3u8')).toBe(false);
    expect(isYanhe2PlayUrl('https://aita.yanhekt.cn/courseapi/v2/learn-record/learn-record.ts')).toBe(false);
    expect(isYanhe2PlayUrl('https://aita.yanhekt.cn/play/a.jpg')).toBe(false);
    expect(isYanhe2PlayUrl('not a url')).toBe(false);
  });
});

const recorded = (videoList: unknown) => ({
  code: 0,
  msg: 'success',
  data: {
    course_title: '泛函分析',
    sub_title: '2026-09-21第1-2节',
    sub_status: '6',
    start_at: '1789948800',
    end_at: '1789954500',
    duration: '5937',
    room_name: '良乡校区文萃楼-F102',
    lecturer_name: '<teacher>',
    video_list: videoList,
    content: { start_at: 1735113351 },
  },
});

describe('parseSubInfo', () => {
  it('picks recorded streams by type, whatever the key order', () => {
    const forward = parseSubInfo(recorded({
      '0': { type: '3', preview_url: TEACHER },
      '1': { type: '2', preview_url: SCREEN },
      '2': { type: '4', preview_url: ROOM },
    }));
    const reversed = parseSubInfo(recorded({
      '0': { type: '4', preview_url: ROOM },
      '1': { type: '2', preview_url: SCREEN },
      '2': { type: '3', preview_url: TEACHER },
    }));
    const expected = [
      { type: 'camera', format: 'hls', url: TEACHER },
      { type: 'screen', format: 'mp4', url: SCREEN },
      { type: 'room', format: 'mp4', url: ROOM },
    ];
    expect(forward?.sources).toEqual(expected);
    expect(reversed?.sources).toEqual(expected);
    expect(forward).toMatchObject({
      status: 'playable',
      title: '泛函分析',
      startAt: 1789948800,
      endAt: 1789954500,
      duration: 5937,
    });
  });

  it('drops placeholder entries and URLs outside /play/', () => {
    const info = parseSubInfo(recorded({
      '0': { type: '3', preview_url: null },
      '1': { type: '2', preview_url: 'https://example.com/play/a.mp4' },
      '2': { type: null, preview_url: null },
    }));
    expect(info?.sources).toEqual([]);
  });

  it('reads a live session from live_url and leaves output_tts out', () => {
    const info = parseSubInfo({
      code: 0,
      data: {
        course_title: '智慧养老',
        sub_status: '1',
        duration: '0',
        video_list: { '0': { type: '4', preview_url: null } },
        playurl: { '0': '' },
        live_url: {
          output: { m3u8: 'https://clive11.yanhekt.cn/live/217_Video1.m3u8' },
          output_tts: { m3u8: 'https://clive11.yanhekt.cn/live/abc_Video1.m3u8' },
          output_student: { m3u8: 'https://clive11.yanhekt.cn/live/217_VideoRoom.m3u8' },
          output_msg: '',
          output_ppt: { m3u8: 'https://clive11.yanhekt.cn/live/217_VideoVga.m3u8' },
        },
      },
    });
    expect(info?.status).toBe('live');
    expect(info?.sources).toEqual([
      { type: 'camera', format: 'hls', url: 'https://clive11.yanhekt.cn/live/217_Video1.m3u8' },
      { type: 'screen', format: 'hls', url: 'https://clive11.yanhekt.cn/live/217_VideoVga.m3u8' },
      { type: 'room', format: 'hls', url: 'https://clive11.yanhekt.cn/live/217_VideoRoom.m3u8' },
    ]);
  });

  it('gives no streams for a session that has not started', () => {
    const info = parseSubInfo({ code: 0, data: { sub_status: '2', video_list: { '0': { type: '3', preview_url: TEACHER } } } });
    expect(info).toMatchObject({ status: 'upcoming', sources: [] });
  });

  it('refuses another envelope', () => {
    expect(parseSubInfo({ code: 10002, msg: 'x' })).toBeNull();
    expect(parseSubInfo(null)).toBeNull();
  });
});
