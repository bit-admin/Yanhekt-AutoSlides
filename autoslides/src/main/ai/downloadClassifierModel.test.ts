import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { Readable } from 'node:stream';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { downloadClassifierModel, STALL_TIMEOUT_MS } from './downloadClassifierModel';
import { SLIDE_CLASSIFIER_RELEASE } from './slideClassifierRelease';

const { get } = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock('electron', () => ({ app: {}, shell: {} }));
vi.mock('@main/infra/http', () => ({ httpClient: { get } }));
vi.mock('@main/infra/logger', () => ({ createLogger: () => ({ debug: vi.fn() }) }));
vi.mock('./slideClassifierRelease', () => ({
  SLIDE_CLASSIFIER_RELEASE: {
    url: 'https://github.com/example/model/releases/download/v1/model.onnx',
    bytes: 5,
    sha256: createHash('sha256').update('model').digest('hex'),
  },
}));

const direct = SLIDE_CLASSIFIER_RELEASE.url;
const mirror = `https://gh-proxy.org/${direct}`;
const response = (body: string, status = 200) => ({ status, data: Readable.from([Buffer.from(body)]) });
let root: string;
let destination: string;

beforeEach(async () => {
  get.mockReset();
  root = await fs.mkdtemp(path.join(os.tmpdir(), 'classifier-download-'));
  destination = path.join(root, 'model.onnx');
});

afterEach(async () => {
  vi.useRealTimers();
  await fs.rm(root, { recursive: true, force: true });
});

describe('downloadClassifierModel', () => {
  it('publishes only verified bytes, with no partial file left behind', async () => {
    get.mockResolvedValueOnce(response('model'));
    await downloadClassifierModel(destination);
    expect(get.mock.calls.map(([url]) => url)).toEqual([direct]);
    expect(await fs.readFile(destination, 'utf8')).toBe('model');
    expect(await fs.readdir(root)).toEqual(['model.onnx']);
  });

  it('uses the release proxy if GitHub is unavailable', async () => {
    get.mockResolvedValueOnce(response('', 503)).mockResolvedValueOnce(response('model'));
    await downloadClassifierModel(destination);
    expect(get.mock.calls.map(([url]) => url)).toEqual([direct, mirror]);
    expect(await fs.readFile(destination, 'utf8')).toBe('model');
  });

  it('rejects even a same-length body when its digest differs, including through the proxy', async () => {
    await fs.writeFile(destination, 'previous file');
    get.mockResolvedValueOnce(response('wrong')).mockResolvedValueOnce(response('wrong'));
    await expect(downloadClassifierModel(destination)).rejects.toThrow('SHA-256');
    expect(await fs.readFile(destination, 'utf8')).toBe('previous file');
    expect(await fs.readdir(root)).toEqual(['model.onnx']);
  });

  it('bounds the body size and cleans up if neither source is usable', async () => {
    get.mockRejectedValueOnce(new Error('network unavailable')).mockResolvedValueOnce(response('too long'));
    await expect(downloadClassifierModel(destination)).rejects.toThrow('pinned size');
    expect(await fs.readdir(root)).toEqual([]);
  });

  it('reports progress against the pinned size', async () => {
    get.mockResolvedValueOnce({ status: 200, data: Readable.from([Buffer.from('mo'), Buffer.from('del')]) });
    const progress: number[] = [];
    await downloadClassifierModel(destination, (fraction) => progress.push(fraction));
    expect(progress).toEqual([0.4, 1]);
  });

  it('has no total deadline but moves to the proxy when bytes stop arriving', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const hang = (_url: string, { signal }: { signal: AbortSignal }) =>
      new Promise((_resolve, reject) => signal.addEventListener('abort', () => reject(signal.reason)));
    get.mockImplementationOnce(hang).mockResolvedValueOnce(response('model'));
    const done = downloadClassifierModel(destination);
    // vi.waitFor would advance the fake clock itself.
    while (get.mock.calls.length === 0) await new Promise((resolve) => setImmediate(resolve));
    await vi.advanceTimersByTimeAsync(STALL_TIMEOUT_MS - 1);
    expect(get).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    await done;
    expect(get.mock.calls.map(([url]) => url)).toEqual([direct, mirror]);
    expect(await fs.readFile(destination, 'utf8')).toBe('model');
  });

  it('clears stale stage folders and superseded pinned versions, never custom models', async () => {
    destination = path.join(root, 'slide-classifier-v2.onnx');
    for (const name of ['slide-classifier-v1.onnx', 'slide-classifier-v1.onnx.removed', 'custom-classifier.onnx', 'slide-detect-v1.onnx']) {
      await fs.writeFile(path.join(root, name), 'x');
    }
    await fs.mkdir(path.join(root, '.classifier-crashed'));
    get.mockResolvedValueOnce(response('model'));
    await downloadClassifierModel(destination);
    expect((await fs.readdir(root)).sort()).toEqual(['custom-classifier.onnx', 'slide-classifier-v2.onnx', 'slide-detect-v1.onnx']);
  });
});
