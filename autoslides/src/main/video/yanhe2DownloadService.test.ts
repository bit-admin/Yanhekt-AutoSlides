import { describe, expect, it, vi } from 'vitest';
import type { Yanhe2SubInfo } from '@main/platform/yanhe2/yanhe2Playback';

vi.mock('@main/infra/logger', () => ({ createLogger: () => ({ debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }) }));

import { Yanhe2DownloadService } from './yanhe2DownloadService';

const PLAY = 'https://aita.yanhekt.cn/play/1/2';

function subInfo(overrides: Partial<Yanhe2SubInfo> = {}): Yanhe2SubInfo {
  return {
    status: 'playable',
    title: '泛函分析',
    subTitle: '第8-10节',
    teacher: '',
    room: '',
    startAt: 1_790_000_000,
    endAt: 1_790_008_700,
    duration: 8700,
    sources: [
      { type: 'camera', format: 'hls', url: `${PLAY}/camera.m3u8` },
      { type: 'screen', format: 'mp4', url: `${PLAY}/screen.mp4` },
      { type: 'room', format: 'mp4', url: `${PLAY}/room.mp4` },
    ],
    audioUrl: `${PLAY}/SubAudio/07_59_03_42.aac`,
    ...overrides,
  };
}

const twin = {
  kind: 'ok' as const,
  data: {
    course: { id: 80101, name_zh: '泛函分析' },
    session: { session_id: 900101, title: '第4周 星期一 第5大节' },
    target: { courseId: '80101', courseTitle: '泛函分析', sessionId: '900101', sessionTitle: '第4周 星期一 第5大节' },
  },
};

function service(info: unknown, found: unknown = twin) {
  const yanhe2Service = { getSubInfo: vi.fn(async () => info), getPlayIdentity: vi.fn(() => null) };
  const twinResolver = { find: vi.fn(async () => found) };
  const created = new Yanhe2DownloadService(
    yanhe2Service as never,
    twinResolver as never,
    {} as never,
    {} as never,
    {} as never,
  );
  return { created, twinResolver };
}

const query = { courseId: '1', subId: '2' };

describe('Yanhe2DownloadService.prepare', () => {
  it('names the Yanhekt lecture and lists camera, screen and mic, never the room camera', async () => {
    const { created } = service({ kind: 'ok', data: subInfo() });
    expect(await created.prepare('1120000000', query)).toEqual({
      kind: 'ok',
      target: { courseId: '80101', courseTitle: '泛函分析', sessionId: '900101', sessionTitle: '第4周 星期一 第5大节' },
      streams: ['camera', 'screen', 'audio'],
    });
  });

  it('turns down a session that is not a finished recording before asking Yanhekt', async () => {
    const { created, twinResolver } = service({ kind: 'ok', data: subInfo({ status: 'processing' }) });
    expect(await created.prepare('1120000000', query)).toEqual({ kind: 'no_recording' });
    expect(twinResolver.find).not.toHaveBeenCalled();
  });

  it('passes on a failed lookup or an ended Yanhe 2.0 session', async () => {
    expect(await service({ kind: 'ok', data: subInfo() }, { kind: 'network' }).created.prepare('1120000000', query))
      .toEqual({ kind: 'network' });
    expect(await service({ kind: 'signed_out' }).created.prepare('1120000000', query)).toEqual({ kind: 'signed_out' });
  });
});

describe('Yanhe2DownloadService.start', () => {
  it('refuses a stream it does not offer or a file name that is a path', async () => {
    const { created } = service({ kind: 'ok', data: subInfo() });
    const progress = vi.fn();
    await expect(created.start('a', '1120000000', query, 'room', 'room_x', progress)).rejects.toThrow('Bad Yanhe 2.0 download request');
    await expect(created.start('b', '1120000000', query, 'screen', '../screen_x', progress)).rejects.toThrow('Bad Yanhe 2.0 download request');
    await expect(created.start('c', '1120000000', query, 'screen', '.hidden', progress)).rejects.toThrow('Bad Yanhe 2.0 download request');
    expect(created.isActive('a')).toBe(false);
  });
});
