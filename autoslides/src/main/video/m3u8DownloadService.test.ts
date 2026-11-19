import { spawn } from 'node:child_process';
import { EventEmitter } from 'node:events';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { expect, it, vi } from 'vitest';
import { createIntranetAxios } from '@main/infra/intranetTransport';
import { M3u8DownloadService, type DownloadProgress, type HlsRequestSigner } from './m3u8DownloadService';

vi.mock('child_process', async (importOriginal) => ({
  ...await importOriginal<typeof import('node:child_process')>(),
  spawn: vi.fn(),
}));
vi.mock('@main/infra/intranetTransport', () => ({ createIntranetAxios: vi.fn() }));
vi.mock('@main/infra/copyrightNoticeFile', () => ({ ensureCopyrightNotice: vi.fn() }));
vi.mock('@main/infra/logger', () => ({ createLogger: () => ({ debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }) }));

it('starts processing at zero after all HLS segments have been downloaded', async () => {
  const outputDirectory = await mkdtemp(path.join(tmpdir(), 'hls-progress-'));
  try {
    const name = 'test-recording';
    // Seed one resumed segment so neither a real media server nor FFmpeg is needed.
    await mkdir(path.join(outputDirectory, name));
    await writeFile(path.join(outputDirectory, name, '0.ts'), 'test segment');
    const get = vi.fn().mockResolvedValue({
      status: 200,
      data: '#EXTM3U\n#EXTINF:4.0,\nsegment.ts\n#EXT-X-ENDLIST\n',
      request: {},
    });
    vi.mocked(createIntranetAxios).mockReturnValue({ instance: { get } as never, destroy: vi.fn() });
    const ffmpeg = Object.assign(new EventEmitter(), { stderr: new EventEmitter() });
    vi.mocked(spawn).mockReturnValue(ffmpeg as never);
    const service = new M3u8DownloadService(
      { getFfmpegPath: () => 'mock-ffmpeg' } as never,
      { getConfig: () => ({ outputDirectory, downloadMaxWorkers: 1, downloadNumRetries: 0 }) } as never,
      {} as never,
      {} as never,
    );
    const signer: HlsRequestSigner = {
      prepare: async () => {}, playlistUrl: url => url, sign: url => url, headers: () => ({}), dispose: () => {},
    };
    const progress = vi.fn<(update: DownloadProgress) => void>();
    const download = service.startSignedDownload('test', 'https://media.example.test/playlist.m3u8', name, progress, signer, { isIntranetMode: false });
    await vi.waitFor(() => expect(spawn).toHaveBeenCalledOnce());
    ffmpeg.emit('close', 0, null);
    await expect(download).resolves.toBe(path.join(outputDirectory, `${name}.mp4`));
    expect(progress.mock.calls.slice(0, 2)).toEqual([
      [{ current: 1, total: 1, phase: 0 }],
      [{ current: 0, total: 100, phase: 1 }],
    ]);
  } finally {
    await rm(outputDirectory, { recursive: true, force: true });
  }
});
