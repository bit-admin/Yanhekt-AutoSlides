import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ConfigService } from '@main/platform/configService';
import { MlClassifierModelService } from './mlClassifierModelService';
import { SLIDE_CLASSIFIER_RELEASE } from './slideClassifierRelease';

const { app, download } = vi.hoisted(() => ({
  app: { isPackaged: true, getPath: vi.fn(), getAppPath: vi.fn() },
  download: vi.fn(),
}));
vi.mock('electron', () => ({ app }));
vi.mock('@main/infra/logger', () => ({ createLogger: () => ({ warn: vi.fn() }) }));
vi.mock('./downloadClassifierModel', () => ({ downloadClassifierModel: download }));
vi.mock('./slideClassifierRelease', () => ({
  SLIDE_CLASSIFIER_RELEASE: { filename: 'classifier-v1.onnx', version: 'classifier-v1', bytes: 5 },
}));

let root: string;
let destination: string;
let mode: 'ml' | 'llm';
let active: 'builtin' | 'custom';
let customName: string | null;
let service: MlClassifierModelService;
const oldResourcesPath = Object.getOwnPropertyDescriptor(process, 'resourcesPath');
const cfg = {
  getAIClassifierMode: () => mode,
  getAIFilteringConfig: () => ({ mlClassifierActiveModel: active, mlClassifierCustomModelName: customName }),
  setMlClassifierActiveModel: (model: typeof active) => { active = model; },
  setMlClassifierCustomModelName: (name: string | null) => { customName = name; },
} as ConfigService;

async function put(filename: string, contents = 'model') {
  await fs.mkdir(path.dirname(filename), { recursive: true });
  await fs.writeFile(filename, contents);
}

beforeEach(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), 'classifier-service-'));
  Object.defineProperty(process, 'resourcesPath', { configurable: true, value: path.join(root, 'packaged') });
  app.getPath.mockReturnValue(path.join(root, 'userData'));
  app.getAppPath.mockReturnValue(path.join(root, 'checkout'));
  destination = path.join(app.getPath(), 'models', SLIDE_CLASSIFIER_RELEASE.filename);
  app.isPackaged = true;
  download.mockReset().mockImplementation((file: string) => put(file));
  mode = 'llm';
  active = 'builtin';
  customName = null;
  service = new MlClassifierModelService(cfg);
});

afterEach(async () => {
  if (oldResourcesPath) Object.defineProperty(process, 'resourcesPath', oldResourcesPath);
  else Reflect.deleteProperty(process, 'resourcesPath');
  await fs.rm(root, { recursive: true, force: true });
});

describe('optional classifier model', () => {
  it('never downloads in development, even with ML selected and the tracked file absent', async () => {
    app.isPackaged = false;
    mode = 'ml';
    service.prepareConfiguredModel();
    expect(service.getModelInfo()).toMatchObject({ builtinSource: 'missing', canDownload: false });
    await expect(service.readModelBuffer()).rejects.toThrow('not found');
    await service.downloadDefaultModel();
    const tracked = path.join(app.getAppPath(), 'resources', 'models', SLIDE_CLASSIFIER_RELEASE.filename);
    await put(tracked, 'development');
    expect(service.getModelInfo().builtinSource).toBe('development');
    expect(Buffer.from(await service.readModelBuffer()).toString()).toBe('development');
    expect(download).not.toHaveBeenCalled();
  });

  it('uses custom, then bundled, then downloaded copies without reaching the network', async () => {
    const bundled = path.join(process.resourcesPath, 'models', SLIDE_CLASSIFIER_RELEASE.filename);
    await put(bundled, 'bundled');
    await put(destination);
    await put(service.getCustomModelPath(), 'custom');
    active = 'custom';
    mode = 'ml';
    service.prepareConfiguredModel();
    expect(Buffer.from(await service.readModelBuffer()).toString()).toBe('custom');
    await service.deleteCustomModel();
    service.deleteDownloadedModel();
    expect(service.getModelInfo()).toMatchObject({ builtinSource: 'bundled', downloadedSizeBytes: null });
    expect(Buffer.from(await service.readModelBuffer()).toString()).toBe('bundled');
    await fs.unlink(bundled);
    await put(destination);
    expect(service.getModelInfo()).toMatchObject({ builtinSource: 'downloaded', canDownload: false });
    expect(Buffer.from(await service.readModelBuffer()).toString()).toBe('model');
    expect(download).not.toHaveBeenCalled();
  });

  it('does not warm in LLM mode, but coalesces concurrent first-use checks from the Developer lab', async () => {
    const listener = vi.fn();
    service.subscribe(listener);
    service.prepareConfiguredModel();
    expect(download).not.toHaveBeenCalled();
    const a = service.readModelBuffer();
    const b = service.readModelBuffer();
    expect(service.getModelInfo().downloadStatus).toBe('downloading');
    expect(Buffer.from(await a).toString()).toBe('model');
    expect(Buffer.from(await b).toString()).toBe('model');
    expect(download).toHaveBeenCalledExactlyOnceWith(destination, expect.any(Function));
    expect(listener.mock.calls.map(([info]) => info.downloadStatus)).toEqual(['downloading', 'idle']);
  });

  it('warms in ML mode, preserves a deliberate deletion across launches, and restores on demand', async () => {
    mode = 'ml';
    service.prepareConfiguredModel();
    await service.downloadDefaultModel(); // join warmup
    expect(download).toHaveBeenCalledTimes(1);
    expect(service.deleteDownloadedModel()).toMatchObject({ builtinSource: 'missing', downloadedSizeBytes: null });
    const reopened = new MlClassifierModelService(cfg);
    reopened.prepareConfiguredModel();
    expect(download).toHaveBeenCalledTimes(1);
    expect(Buffer.from(await reopened.readModelBuffer()).toString()).toBe('model');
    expect(download).toHaveBeenCalledTimes(2);
    await expect(fs.stat(`${destination}.removed`)).rejects.toMatchObject({ code: 'ENOENT' });
  });

  it('does not warm when a custom model already exists, even with no default copy', async () => {
    active = 'custom';
    mode = 'ml';
    await put(service.getCustomModelPath(), 'custom');
    service.prepareConfiguredModel({ afterModeChange: true });
    expect(Buffer.from(await service.readModelBuffer()).toString()).toBe('custom');
    expect(download).not.toHaveBeenCalled();
  });

  it('reports a failed download and retries on explicit use', async () => {
    download.mockRejectedValueOnce(new Error('offline'));
    await expect(service.readModelBuffer()).rejects.toThrow('Check your connection');
    expect(service.getModelInfo()).toMatchObject({ builtinSource: 'missing', downloadStatus: 'failed' });
    await service.downloadDefaultModel();
    expect(service.getModelInfo()).toMatchObject({ builtinSource: 'downloaded', downloadStatus: 'idle' });
  });

  it('broadcasts whole-percent download progress and clears it when done', async () => {
    let finish!: () => void;
    download.mockImplementationOnce(async (file: string, onProgress: (fraction: number) => void) => {
      await Promise.resolve(); // bytes arrive after the download has started
      onProgress(0.004); // still 0%: no broadcast
      onProgress(0.42);
      onProgress(0.429); // still 42%
      await new Promise<void>((resolve) => { finish = resolve; });
      await put(file);
    });
    const listener = vi.fn();
    service.subscribe(listener);
    const done = service.downloadDefaultModel();
    expect(service.getModelInfo()).toMatchObject({ downloadStatus: 'downloading', downloadPercent: 0 });
    await Promise.resolve();
    expect(service.getModelInfo()).toMatchObject({ downloadStatus: 'downloading', downloadPercent: 42 });
    finish();
    await done;
    expect(listener.mock.calls.map(([info]) => info.downloadPercent)).toEqual([0, 42, null]);
    expect(service.getModelInfo()).toMatchObject({ downloadStatus: 'idle', downloadPercent: null });
  });
});
