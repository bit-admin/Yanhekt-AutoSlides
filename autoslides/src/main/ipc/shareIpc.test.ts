import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { AxiosHeaders } from 'axios';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { httpFetch } from '@main/infra/http';
import { defaultConfig } from '@main/platform/config/defaults';
import { IntranetApiTransport } from '@main/platform/intranetApiTransport';
import { ShareService } from '@main/platform/shareService';
import { buildShareUrl, encodeSharePayload, type SharePayload } from '@common/shareLink';
import { cloudNotes } from '../../preload/notes';
import { registerShareIpcHandlers } from './shareIpc';
import type { IpcServices } from './types';

const handlers = vi.hoisted(() => new Map<string, (event: unknown, ...args: unknown[]) => Promise<unknown>>());
vi.mock('electron', () => ({
  app: { getName: () => 'AutoSlides', getVersion: () => '0.0.0' },
  ipcMain: { handle: (name: string, handler: (event: unknown, ...args: unknown[]) => Promise<unknown>) => handlers.set(name, handler) },
  ipcRenderer: {
    invoke: async (name: string, ...args: unknown[]) => {
      const handler = handlers.get(name);
      if (!handler) throw new Error(`Unregistered IPC channel: ${name}`);
      return handler(undefined, ...args);
    },
  },
}));
vi.mock('@main/infra/http', () => ({ httpFetch: vi.fn() }));
vi.mock('@main/infra/logger', () => ({ createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() }) }));
vi.mock('@main/infra/sharpService', () => ({ sharpService: { isAvailable: () => false } }));

const shareOrigin = 'https://share.ruc.edu.kg';
const coss = 'https://coss.yanhekt.cn/images';
const uploaded = { host: 'https://coss.yanhekt.cn', path: '/images/2026/1/abcdef0123456789abcdef0123456789.png' };
const imageUrl = `${uploaded.host}${uploaded.path}`;
const courseMeta = { courseTitle: '合成课程', sessionTitle: '合成课时' };
const payload: SharePayload = { v: 3, c: '1', s: '2', p: '2026/1', n: 7, h: 'abcdef01234567', t: '0:4,1:6,0:7' };
const fetchMock = vi.mocked(httpFetch);
const answer = <T>(data: T, status = 200) => ({
  status, statusText: 'OK', headers: {}, config: { headers: new AxiosHeaders() }, data,
});

let outputDirectory: string;

function setup(token: string | null = 'fixture-token') {
  const transport = new IntranetApiTransport();
  const send = vi.spyOn(transport, 'send').mockResolvedValue(answer({ code: 0, data: uploaded }));
  const shareService = new ShareService({
    getAuthToken: () => token,
    getConfig: () => ({ ...defaultConfig, outputDirectory }),
  }, transport);
  registerShareIpcHandlers({ shareService } as IpcServices);
  return send;
}

beforeEach(() => {
  handlers.clear();
  fetchMock.mockReset();
});

afterEach(async () => {
  if (!outputDirectory) return;
  await fs.rm(outputDirectory, { recursive: true, force: true });
  outputDirectory = '';
});

describe('Share through the cloudNotes bridge', () => {
  it('exposes and registers only the Share operations', () => {
    setup();
    const methods = [
      'discardCloneStage', 'downloadImageToFolder', 'exportFolderStatus', 'prepareCloneStage',
      'publishCloneStage', 'resolveShareLink', 'shortenShareUrl', 'uploadImage', 'uploadImageFromPath',
    ];
    expect(Object.keys(cloudNotes).sort()).toEqual(methods);
    expect([...handlers.keys()].sort()).toEqual(methods.map((name) => `cloudNotes:${name}`));
  });

  it('uploads bytes and local images via authenticated MinIO multipart', async () => {
    const send = setup();
    const bytes = Uint8Array.of(0, 255, 1);
    outputDirectory = await fs.mkdtemp(path.join(os.tmpdir(), 'autoslides-share-'));
    const localImage = path.join(outputDirectory, 'Slide_002.JPG');
    await fs.writeFile(localImage, bytes);

    const expected = { ok: true, data: { url: imageUrl } };
    await expect(cloudNotes.uploadImage(bytes.buffer, 'Slide_001.png', 'image/png')).resolves.toEqual(expected);
    await expect(cloudNotes.uploadImageFromPath(localImage)).resolves.toEqual(expected);
    expect(send).toHaveBeenCalledTimes(2);
    for (const [i, [request]] of send.mock.calls.entries()) {
      expect(request).toMatchObject({
        method: 'POST', url: 'https://cbiz.yanhekt.cn/v1/minio/upload', timeout: 120_000,
        headers: { Authorization: 'Bearer fixture-token', 'Xdomain-Client': 'web_user' },
      });
      expect(request.headers).not.toHaveProperty('Content-Type');
      const form = request.data as FormData;
      expect(form.get('bucket')).toBe('notes');
      const file = form.get('file') as File;
      expect(file.name).toBe(i === 0 ? 'Slide_001.png' : 'Slide_002.JPG');
      expect(file.type).toBe(i === 0 ? 'image/png' : 'image/jpeg');
      expect(new Uint8Array(await file.arrayBuffer())).toEqual(bytes);
    }
  });

  it('returns the existing not-signed-in result without uploading', async () => {
    const send = setup(null);
    await expect(cloudNotes.uploadImage(new ArrayBuffer(1), 'Slide_001.png', 'image/png'))
      .resolves.toEqual({ ok: false, error: 'not-signed-in' });
    expect(send).not.toHaveBeenCalled();
  });

  it('shortens with the app User-Agent and the active Yanhekt token', async () => {
    setup();
    const url = `${shareOrigin}/v1/s/Test123`;
    fetchMock.mockResolvedValueOnce(Response.json({ url }));
    await expect(cloudNotes.shortenShareUrl('fixture-fragment')).resolves.toEqual({ ok: true, data: { url } });
    expect(fetchMock).toHaveBeenCalledExactlyOnceWith(`${shareOrigin}/v1/api/shorten`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json', 'User-Agent': expect.stringMatching(/^AutoSlides\/0\.0\.0 /),
        Authorization: 'Bearer fixture-token',
      },
      body: JSON.stringify({ fragment: 'fixture-fragment' }),
    });
  });

  it('reuses short-link metadata, paginates COSS over the shared transport and restores the timeline', async () => {
    const send = setup(null);
    fetchMock.mockResolvedValueOnce(Response.json({ fragment: encodeSharePayload(payload), meta: courseMeta }));
    send
      .mockResolvedValueOnce(answer('<IsTruncated>true</IsTruncated><NextContinuationToken>page+2</NextContinuationToken>'))
      .mockResolvedValueOnce(answer('<Key>2026/1/abcdef0123456789abcdef0123456789.png</Key>'));

    const result = await cloudNotes.resolveShareLink(`${shareOrigin}/v1/s/Test123`);
    expect(result).toMatchObject({
      ok: true,
      data: {
        title: 'c1s2 · 合成课程 · 合成课时', identity: { courseId: '1', sessionId: '2' },
        urls: [imageUrl], missing: 1, lectureMeta: courseMeta,
        timeline: {
          kind: 'recorded',
          events: [
            { changeAt: 4, initialFile: 'Slide_001.png' },
            { changeAt: 10, initialFile: 'Slide_002.png' },
            { changeAt: 17, initialFile: 'Slide_001.png' },
          ],
        },
      },
    });
    expect(fetchMock.mock.calls).toEqual([
      [`${shareOrigin}/v1/api/get?id=Test123`, { headers: { 'User-Agent': expect.stringMatching(/^AutoSlides\//) } }],
    ]);
    expect(result).toMatchObject({ ok: true, data: { sourceLink: { shortUrl: `${shareOrigin}/v1/s/Test123` } } });
    expect(send.mock.calls.map(([request]) => [request.method, request.url, request.responseType])).toEqual([
      ['GET', `${coss}?list-type=2&prefix=2026%2F1%2F&max-keys=1000`, 'text'],
      ['GET', `${coss}?list-type=2&prefix=2026%2F1%2F&max-keys=1000&continuation-token=page%2B2`, 'text'],
    ]);
  });

  it('declines a link that names no session or live lecture, before reading COSS', async () => {
    const send = setup(null);
    const images = { v: 2 as const, p: payload.p, n: payload.n, h: payload.h };
    for (const link of [buildShareUrl(images), buildShareUrl({ ...images, c: '1' })]) {
      await expect(cloudNotes.resolveShareLink(link))
        .resolves.toEqual({ ok: false, error: 'share-link-no-lecture' });
    }
    expect(send).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('asks COSS for a folder\'s one distinct hash alone', async () => {
    const send = setup(null);
    const single = buildShareUrl({ ...payload, v: 2, t: undefined, h: 'abcdef0abcdef0' });
    fetchMock.mockResolvedValueOnce(Response.json({ meta: courseMeta }));
    send.mockResolvedValueOnce(answer('<Key>2026/1/abcdef0123456789abcdef0123456789.png</Key><IsTruncated>true</IsTruncated>'));

    await expect(cloudNotes.resolveShareLink(single)).resolves.toMatchObject({
      ok: true, data: { urls: [imageUrl, imageUrl], missing: 0 },
    });
    expect(send).toHaveBeenCalledOnce();
    expect(send.mock.calls[0][0].url).toBe(`${coss}?list-type=2&prefix=2026%2F1%2Fabcdef0&max-keys=1`);
  });

  it('looks up long-link metadata for a link without a timeline', async () => {
    const send = setup();
    const v2 = buildShareUrl({ ...payload, v: 2, t: undefined });
    send.mockResolvedValueOnce(answer(''));
    fetchMock.mockResolvedValueOnce(Response.json({ meta: courseMeta }));
    await expect(cloudNotes.resolveShareLink(v2)).resolves.toMatchObject({
      ok: true, data: { title: 'c1s2 · 合成课程 · 合成课时', lectureMeta: courseMeta, timeline: null },
    });
    expect(fetchMock).toHaveBeenCalledWith(`${shareOrigin}/v1/api/meta?courseId=1&sessionId=2`, {
      headers: { 'User-Agent': expect.stringMatching(/^AutoSlides\//), Authorization: 'Bearer fixture-token' },
    });
  });

  it('builds a clone in a hidden stage and publishes it under the lecture folder name', async () => {
    const sendSpy = setup();
    outputDirectory = await fs.mkdtemp(path.join(os.tmpdir(), 'autoslides-share-'));
    const identity = { courseId: '1', sessionId: '2' };
    const folderName = 'slides_Example__c1s2';
    const dir = path.join(outputDirectory, folderName);
    await expect(cloudNotes.exportFolderStatus('Example', identity))
      .resolves.toEqual({ ok: true, data: { exists: false, dir, folderName } });

    const stage = await cloudNotes.prepareCloneStage();
    if (!stage.ok) throw new Error('stage');
    expect(stage.data.folderName.startsWith('.')).toBe(true);
    const bytes = Uint8Array.of(137, 80, 78, 71);
    sendSpy.mockResolvedValueOnce(answer(bytes.buffer));
    await expect(cloudNotes.downloadImageToFolder(imageUrl, stage.data.dir, 'Slide_001.png'))
      .resolves.toEqual({ ok: true, data: undefined });
    await expect(cloudNotes.publishCloneStage(stage.data.dir, 'Example', 'fresh', identity))
      .resolves.toEqual({ ok: true, data: { exists: true, dir, folderName } });
    await expect(fs.readFile(path.join(dir, 'Slide_001.png'))).resolves.toEqual(Buffer.from(bytes));
    await expect(fs.access(stage.data.dir)).rejects.toThrow();
    expect(sendSpy).toHaveBeenLastCalledWith(expect.objectContaining({ method: 'GET', url: imageUrl, responseType: 'arraybuffer' }));
    expect(fetchMock).not.toHaveBeenCalled();

    // The name is taken now: fresh refuses, create keeps both.
    const second = await cloudNotes.prepareCloneStage();
    if (!second.ok) throw new Error('stage');
    await expect(cloudNotes.publishCloneStage(second.data.dir, 'Example', 'fresh', identity))
      .resolves.toMatchObject({ ok: false, error: 'clone-target-exists' });
    await expect(cloudNotes.publishCloneStage(second.data.dir, 'Example', 'create', identity))
      .resolves.toEqual({ ok: true, data: { exists: true, dir: `${dir} (2)`, folderName: `${folderName} (2)` } });
  });

  it('refuses to publish or discard anything but a clone stage', async () => {
    setup();
    outputDirectory = await fs.mkdtemp(path.join(os.tmpdir(), 'autoslides-share-'));
    const real = path.join(outputDirectory, 'slides_Keep__c1s2');
    await fs.mkdir(real);
    await expect(cloudNotes.discardCloneStage(real)).resolves.toMatchObject({ ok: false, error: 'invalid-clone-stage' });
    await expect(cloudNotes.publishCloneStage(real, 'Other', 'fresh')).resolves.toMatchObject({ ok: false });
    await expect(fs.access(real)).resolves.toBeUndefined();
  });
});
