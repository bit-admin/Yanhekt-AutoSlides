import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FFmpegService } from './ffmpegService';
// eslint-disable-next-line no-restricted-imports -- Exercise the slide video boundary without running a media process.
import { SlideVideoService } from '@main/video/slideVideoService';
import { DEFAULT_SLIDE_VIDEO_OPTIONS } from '@common/slideVideo';

const mocks = vi.hoisted(() => ({
  app: { isPackaged: true, getAppPath: vi.fn(), getPath: vi.fn() },
  existsSync: vi.fn(),
  rm: vi.fn(),
  execFileSync: vi.fn(),
  spawn: vi.fn(),
  log: { debug: vi.fn(), error: vi.fn() },
}));

vi.mock('electron', () => ({ app: mocks.app }));
vi.mock('node:fs', () => ({ default: { existsSync: mocks.existsSync, promises: { rm: mocks.rm } } }));
vi.mock('node:child_process', () => ({ execFileSync: mocks.execFileSync, spawn: mocks.spawn }));
vi.mock('@main/infra/logger', () => ({ createLogger: () => mocks.log }));

const processProperties = Object.getOwnPropertyDescriptors(process);
const appPath = path.resolve('test-app');
const resourcesPath = path.resolve('test resources');

function platformAs(platform: string, arch: string) {
  Object.defineProperties(process, {
    platform: { configurable: true, value: platform },
    arch: { configurable: true, value: arch },
    resourcesPath: { configurable: true, value: resourcesPath },
  });
}

function bundledPath(tool: 'ffmpeg'): string {
  const directory = mocks.app.isPackaged
    ? path.join(resourcesPath, 'media-tools')
    : path.join(appPath, 'vendor', 'media-tools', `${process.platform}-${process.arch}`, 'media-tools');
  return path.join(directory, process.platform === 'win32' ? `${tool}.exe` : tool);
}

beforeEach(() => {
  vi.resetAllMocks();
  mocks.app.isPackaged = true;
  mocks.app.getAppPath.mockReturnValue(appPath);
  mocks.existsSync.mockReturnValue(true);
  mocks.execFileSync.mockImplementation((file: string) =>
    `${path.basename(file).replace(/\.exe$/, '')} version 9.0.2 Copyright (c) FFmpeg developers\n`,
  );
  platformAs('darwin', 'arm64');
});

afterEach(() => {
  for (const key of ['platform', 'arch', 'resourcesPath'] as const) {
    const descriptor = processProperties[key];
    if (descriptor) Object.defineProperty(process, key, descriptor);
    else Reflect.deleteProperty(process, key);
  }
});

describe('bundled media tool resolution', () => {
  it.each([
    [true, 'darwin', 'arm64'],
    [false, 'darwin', 'arm64'],
    [true, 'win32', 'x64'],
    [false, 'win32', 'x64'],
    [true, 'linux', 'x64'],
    [false, 'linux', 'x64'],
  ])('resolves packaged=%s on %s-%s using only its bundle', (packaged, platform, arch) => {
    mocks.app.isPackaged = packaged;
    platformAs(platform, arch);
    const service = new FFmpegService();

    expect(mocks.execFileSync).not.toHaveBeenCalled();
    expect(mocks.existsSync).not.toHaveBeenCalled();
    expect(service.getFfmpegPath()).toBe(bundledPath('ffmpeg'));
    expect(mocks.existsSync.mock.calls).toEqual([[bundledPath('ffmpeg')]]);
    expect(mocks.execFileSync.mock.calls).toEqual([[
      bundledPath('ffmpeg'),
      ['-version'],
      { encoding: 'utf8', stdio: 'pipe', timeout: 30000, windowsHide: true },
    ]]);
    if (packaged) expect(mocks.app.getAppPath).not.toHaveBeenCalled();
  });

  it('caches successful probes across every public entry point', () => {
    const service = new FFmpegService();
    service.warmUp();
    service.warmUp();
    expect(service.isAvailable()).toBe(true);
    expect(service.getPlatformInfo()).toEqual({ platform: 'darwin', ffmpegPath: bundledPath('ffmpeg') });
    expect(service.getFfmpegPath()).toBe(bundledPath('ffmpeg'));
    expect(mocks.execFileSync).toHaveBeenCalledTimes(1);
    expect(mocks.existsSync).toHaveBeenCalledTimes(1);
  });

  it('has no ffprobe to resolve', () => {
    expect('getFfprobePath' in new FFmpegService()).toBe(false);
  });

  it('logs missing binaries without searching elsewhere, and checks again next time', () => {
    mocks.existsSync.mockReturnValue(false);
    const service = new FFmpegService();
    service.warmUp();
    expect(service.isAvailable()).toBe(false);
    expect(mocks.execFileSync).not.toHaveBeenCalled();
    expect(mocks.existsSync.mock.calls).toEqual([[bundledPath('ffmpeg')], [bundledPath('ffmpeg')]]);
    expect(mocks.log.error).toHaveBeenCalledWith('Bundled ffmpeg binary is missing:', bundledPath('ffmpeg'));
  });

  it.each(['EACCES', 'ENOEXEC', 'SIGSEGV', 'ETIMEDOUT'])('rejects broken tools (%s) with no fallback', (reason) => {
    const error = new Error(reason);
    mocks.execFileSync.mockImplementation(() => { throw error; });
    const service = new FFmpegService();
    expect(service.getFfmpegPath()).toBeNull();
    expect(service.getFfmpegPath()).toBeNull();
    expect(mocks.execFileSync).toHaveBeenCalledTimes(2);
    expect(mocks.log.error).toHaveBeenCalledWith('Bundled ffmpeg could not be initialized:', bundledPath('ffmpeg'), error);
  });

  it('recovers after a first probe times out (antivirus scan on first run)', () => {
    const timeout = new Error('ETIMEDOUT');
    mocks.execFileSync
      .mockImplementationOnce(() => { throw timeout; })
      .mockImplementation((file: string) => `${path.basename(file)} version 9.0.2\n`);
    const service = new FFmpegService();
    expect(service.getFfmpegPath()).toBeNull();
    expect(service.getFfmpegPath()).toBe(bundledPath('ffmpeg'));
    expect(service.getFfmpegPath()).toBe(bundledPath('ffmpeg'));
    expect(mocks.execFileSync).toHaveBeenCalledTimes(2);
  });

  it.each(['', 'not a media tool', 'ffprobe version 9.0.2', 'ffmpeg version '])('rejects invalid ffmpeg version output %j', (output) => {
    mocks.execFileSync.mockReturnValue(output);
    const service = new FFmpegService();
    expect(service.getFfmpegPath()).toBeNull();
    expect(mocks.execFileSync).toHaveBeenCalledTimes(1);
    expect(mocks.log.error).toHaveBeenCalledWith('Bundled ffmpeg returned invalid version output:', bundledPath('ffmpeg'));
  });

  it('contains resolution errors', () => {
    mocks.app.isPackaged = false;
    const error = new Error('App path unavailable');
    mocks.app.getAppPath.mockImplementation(() => { throw error; });
    const service = new FFmpegService();
    expect(service.getFfmpegPath()).toBeNull();
    expect(service.isAvailable()).toBe(false);
    expect(mocks.app.getAppPath).toHaveBeenCalledTimes(2);
    expect(mocks.log.error).toHaveBeenCalledWith('Bundled ffmpeg could not be initialized:', undefined, error);
    expect(mocks.execFileSync).not.toHaveBeenCalled();
  });

  it('a slide video never substitutes an adjacent or PATH ffmpeg for a rejected bundle', async () => {
    // Every filesystem path exists, including any adjacent/system executable,
    // but the bundled ffmpeg is invalid. No media process may be spawned.
    mocks.execFileSync.mockReturnValue('not ffmpeg');
    mocks.app.getPath.mockReturnValue(path.resolve('tmp'));
    mocks.rm.mockResolvedValue(undefined);
    const service = new SlideVideoService(new FFmpegService());
    const timeline = { version: 1, extractor: 'builtin', createdAt: '', updatedAt: '', events: [], resolutions: {} } as const;
    await expect(service.make(
      { slidesFolder: path.resolve('slides_x'), timeline: { ...timeline, events: [] }, audioPath: null, options: DEFAULT_SLIDE_VIDEO_OPTIONS },
      () => undefined,
    )).rejects.toThrow('FFmpeg is not available');
    expect(mocks.spawn).not.toHaveBeenCalled();
    expect(mocks.execFileSync).toHaveBeenCalledTimes(1);
    expect(service.isActive()).toBe(false);
  });

});
