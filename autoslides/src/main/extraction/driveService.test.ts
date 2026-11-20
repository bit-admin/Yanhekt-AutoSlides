import { mkdtemp, mkdir, rm, utimes, writeFile } from 'fs/promises';
import os from 'os';
import path from 'path';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@main/infra/logger', () => ({ createLogger: () => ({ debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }) }));

import { DriveService, md5Of } from './driveService';
import { SlideMetadataService } from './slideMetadataService';

const dirs: string[] = [];
afterEach(async () => {
  await Promise.all(dirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

const extraction = { extractor: 'qt' as const, extractedAt: '2026-11-20T00:00:00.000Z' };

async function setup(withMetadata = true) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'drive-'));
  dirs.push(root);
  const folder = path.join(root, 'slides_课程_第1周__c1s2');
  await mkdir(folder);
  await writeFile(path.join(folder, 'Slide_001.png'), 'one');
  await writeFile(path.join(folder, 'Slide_002.png'), 'two');
  const metadata = new SlideMetadataService();
  if (withMetadata) await metadata.writeExtraction(folder, { source: { courseId: '1', sessionId: '2' }, extraction });
  const uploads: string[] = [];
  const uploader = {
    uploadImage: vi.fn(async (bytes: ArrayBuffer | Uint8Array, filename: string) => {
      uploads.push(filename);
      return { url: `https://coss.yanhekt.cn/images/2026/11/${md5Of(new Uint8Array(bytes as ArrayBuffer))}.png` };
    }),
    shortenShareUrl: vi.fn(async () => ({ url: 'https://share.ruc.edu.kg/v1/s/abc' })),
  };
  const timelines = { read: vi.fn(async () => null) };
  const service = new DriveService(uploader as never, metadata, timelines as never, () => true);
  return { root, folder, metadata, service, uploads, uploader };
}

describe('DriveService', () => {
  it('uploads each slide once, and again only after the file changes', async () => {
    const { folder, service, uploads, metadata } = await setup();
    const first = await service.uploadFolder(folder, () => {});
    expect(first).toMatchObject({ ok: true, data: { phase: 'done', total: 2, done: 2, skipped: 0 } });
    expect((await service.folderSummary(folder)).counts).toMatchObject({ uploaded: 2, status: 'uploaded' });

    await service.uploadFolder(folder, () => {});
    expect(uploads).toHaveLength(2);

    await writeFile(path.join(folder, 'Slide_002.png'), 'two, cropped');
    expect((await service.folderSummary(folder)).counts).toMatchObject({ uploaded: 1, changed: 1, status: 'changed' });
    await service.uploadFolder(folder, () => {});
    expect(uploads).toEqual(['Slide_001.png', 'Slide_002.png', 'Slide_002.png']);
    const record = (await metadata.read(folder))?.drive?.files['Slide_002.png'];
    expect(record?.md5).toBe(md5Of(Buffer.from('two, cropped')));
    expect((record?.uploadedAt ?? '') <= (record?.updatedAt ?? '')).toBe(true);
  });

  it('counts restored original bytes as uploaded without sending them', async () => {
    const { folder, service, uploads } = await setup();
    await service.uploadFolder(folder, () => {});
    const later = new Date(Date.now() + 60_000);
    await utimes(path.join(folder, 'Slide_001.png'), later, later);
    expect((await service.folderSummary(folder)).counts.uploaded).toBe(2);
    await service.uploadFolder(folder, () => {});
    expect(uploads).toHaveLength(2);
  });

  it('does not record an upload whose URL names other bytes', async () => {
    const { folder, service, uploader } = await setup();
    uploader.uploadImage.mockResolvedValueOnce({ url: 'https://coss.yanhekt.cn/images/2026/11/00000000000000000000000000000000.png' });
    const result = await service.uploadFolder(folder, () => {});
    expect(result).toMatchObject({ ok: true, data: { done: 1, failed: 1 } });
  });

  it('refuses unrecognised folders and signed-out uploads', async () => {
    const { folder, service } = await setup(false);
    expect(await service.uploadFolder(folder, () => {})).toMatchObject({ ok: false, error: 'not-recognised' });
    expect((await service.folderSummary(folder)).recognised).toBe(false);
    const signedOut = new DriveService({} as never, new SlideMetadataService(), { read: async () => null } as never, () => false);
    expect(await signedOut.uploadFolder(folder, () => {})).toMatchObject({ ok: false, error: 'sign-in' });
  });

  it('makes a share link only when every slide is uploaded, and records it', async () => {
    const { folder, service } = await setup();
    expect(await service.createShare(folder, { timeline: true, shorten: true })).toMatchObject({ ok: false, error: 'not-uploaded', count: 2 });
    await service.uploadFolder(folder, () => {});
    const made = await service.createShare(folder, { timeline: true, shorten: true });
    expect(made).toMatchObject({ ok: true, data: { shortUrl: 'https://share.ruc.edu.kg/v1/s/abc', files: ['Slide_001.png', 'Slide_002.png'], timeline: false } });
    if (!made.ok) return;
    expect(made.data.longUrl).toMatch(/^https:\/\/share\.ruc\.edu\.kg\/v1\/?#/);
    expect((await service.folderSummary(folder)).shares).toHaveLength(1);
    await service.removeShare(folder, made.data.id);
    expect((await service.folderSummary(folder)).shares).toHaveLength(0);
  });

  it('records a cloned folder: share extractor, and uploads only for bytes its URL names', async () => {
    const { folder, service, metadata } = await setup(false);
    const one = md5Of(Buffer.from('one'));
    const result = await service.recordClone(folder, {
      source: { courseId: '1', sessionId: '2', courseTitle: '课程' },
      slides: [
        { filename: 'Slide_001.png', url: `https://coss.yanhekt.cn/images/2026/10/${one}.png` },
        { filename: 'Slide_002.png', url: 'https://coss.yanhekt.cn/images/2026/10/11111111111111111111111111111111.png' },
        { filename: '../x.png', url: `https://coss.yanhekt.cn/images/2026/10/${one}.png` },
      ],
    });
    expect(result).toEqual({ ok: true, data: null });
    const stored = await metadata.read(folder);
    expect(stored?.extraction.extractor).toBe('share');
    expect(Object.keys(stored?.drive?.files ?? {})).toEqual(['Slide_001.png']);
    expect((await service.folderSummary(folder)).counts).toMatchObject({ uploaded: 1, notUploaded: 1, status: 'partial' });
  });
});
