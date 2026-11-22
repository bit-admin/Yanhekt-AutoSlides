import { buildSlideShareLink } from '@common/shareCreation';
import { mkdtemp, mkdir, rm, symlink, utimes, writeFile } from 'fs/promises';
import os from 'os';
import path from 'path';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@main/infra/logger', () => ({ createLogger: () => ({ debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }) }));

import { decodeSharePayload } from '@common/shareLink';
import { recordCaptureConfirmed, type SlideTimeline } from '@common/sidecars/timeline';
import { DriveService, md5Of } from './driveService';
import { SlideMetadataService } from './slideMetadataService';

const dirs: string[] = [];
afterEach(async () => {
  await Promise.all(dirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

const extraction = { extractor: 'qt' as const, extractedAt: '2026-11-20T00:00:00.000Z' };

async function setup(withMetadata = true, timeline: SlideTimeline | null = null) {
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
  const timelines = { read: vi.fn(async () => timeline) };
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
    // Uploads run three at a time, so the first two may finish in either order.
    expect([...uploads].sort()).toEqual(['Slide_001.png', 'Slide_002.png', 'Slide_002.png']);
    const record = (await metadata.read(folder))?.drive?.files['Slide_002.png'];
    expect(record?.md5).toBe(md5Of(Buffer.from('two, cropped')));
    expect((record?.uploadedAt ?? '') <= (record?.updatedAt ?? '')).toBe(true);
  });

  it('shares symlinked slides and leaves out one whose target is gone', async () => {
    const { root, folder, service, uploads } = await setup();
    await writeFile(path.join(root, 'three.png'), 'three');
    await symlink(path.join(root, 'three.png'), path.join(folder, 'Slide_003.png'));
    await symlink(path.join(root, 'missing.png'), path.join(folder, 'Slide_004.png'));
    const result = await service.uploadFolder(folder, () => {});
    expect(result).toMatchObject({ ok: true, data: { phase: 'done', total: 3, done: 3 } });
    expect([...uploads].sort()).toEqual(['Slide_001.png', 'Slide_002.png', 'Slide_003.png']);
  });

  it('stops and says so when the account is signed out mid-run', async () => {
    const { folder, service, uploader } = await setup();
    uploader.uploadImage.mockRejectedValue(Object.assign(new Error('Not signed in'), { name: 'ShareAuthError' }));
    const result = await service.uploadFolder(folder, () => {});
    expect(result).toMatchObject({ ok: true, data: { phase: 'cancelled', error: 'sign-in', done: 0 } });
    expect(result.ok && result.data.failed).toBeGreaterThan(0);
  });

  it('marks no link current once the slides change, until they are shared again', async () => {
    const { folder, service } = await setup();
    await service.uploadFolder(folder, () => {});
    expect((await service.folderSummary(folder)).shares.map((s) => s.current)).toEqual([true]);
    await writeFile(path.join(folder, 'Slide_001.png'), 'one, cropped');
    expect((await service.folderSummary(folder)).shares.map((s) => s.current)).toEqual([false]);
  });

  it('records a share link version for each fully uploaded state, and shortens one', async () => {
    const { folder, service, uploader } = await setup();
    expect((await service.folderSummary(folder)).shares).toEqual([]);
    await service.uploadFolder(folder, () => {});
    const first = (await service.folderSummary(folder)).shares;
    expect(first).toHaveLength(1);
    expect(first[0]).toMatchObject({ imageCount: 2, canShorten: true, timeline: false });
    expect(first[0].longUrl).toMatch(/^https:\/\/share\.ruc\.edu\.kg\/v1#/);
    expect(decodeSharePayload(first[0].longUrl.slice(first[0].longUrl.indexOf('#')))).toMatchObject({ v: 2, c: '1', s: '2', n: 7 });
    // Read again: the same link is not recorded twice.
    expect((await service.folderSummary(folder)).shares).toHaveLength(1);

    // A crop keeps the old link listed; uploading it again adds a second version.
    await writeFile(path.join(folder, 'Slide_002.png'), 'two, cropped');
    expect((await service.folderSummary(folder)).shares).toHaveLength(1);
    await service.uploadFolder(folder, () => {});
    const second = (await service.folderSummary(folder)).shares;
    expect(second).toHaveLength(2);
    expect(second[0].id).toBe(first[0].id);
    expect(second[1].longUrl).not.toBe(first[0].longUrl);

    expect(await service.shortenShare(folder, first[0].id)).toMatchObject({ ok: true, data: { shortUrl: 'https://share.ruc.edu.kg/v1/s/abc' } });
    expect(await service.shortenShare(folder, first[0].id)).toMatchObject({ ok: true });
    expect(uploader.shortenShareUrl).toHaveBeenCalledTimes(1);
    expect((await service.folderSummary(folder)).shares[0].shortUrl).toBe('https://share.ruc.edu.kg/v1/s/abc');
    expect(await service.shortenShare(folder, 'missing')).toMatchObject({ ok: false, error: 'not-found' });

    // Removing: the current link stays, an older one can go, the last one stays.
    expect(second.map((s) => s.current)).toEqual([false, true]);
    expect(await service.removeShare(folder, second[1].id)).toMatchObject({ ok: false, error: 'current-link' });
    expect(await service.removeShare(folder, second[0].id)).toMatchObject({ ok: true });
    expect((await service.folderSummary(folder)).shares.map((s) => s.id)).toEqual([second[1].id]);
    await writeFile(path.join(folder, 'Slide_001.png'), 'one, cropped');
    const [only] = (await service.folderSummary(folder)).shares;
    expect(only.current).toBe(false);
    expect(await service.removeShare(folder, only.id)).toMatchObject({ ok: false, error: 'last-link' });
  });

  it('puts the timeline in the link whenever the folder has one', async () => {
    let timeline = recordCaptureConfirmed(null, { changeAt: 0, confirmedAt: 2, file: 'Slide_001.png' });
    timeline = recordCaptureConfirmed(timeline, { changeAt: 90, confirmedAt: 92, file: 'Slide_002.png' });
    const { folder, service, metadata } = await setup(true, timeline);
    await service.uploadFolder(folder, () => {});
    const [share] = (await service.folderSummary(folder)).shares;
    expect(share.timeline).toBe(true);
    expect(decodeSharePayload(share.longUrl.slice(share.longUrl.indexOf('#')))).toMatchObject({ v: 3, t: '0:0,1:90' });
    expect((await metadata.read(folder))?.shares?.[0].timeline).toBe(true);
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

  it('reports empty folders and upload records that could not be saved', async () => {
    const { folder, service, metadata, uploads } = await setup();
    for (const name of ['Slide_001.png', 'Slide_002.png']) await rm(path.join(folder, name));
    expect(await service.uploadFolder(folder, () => {})).toMatchObject({
      ok: true, data: { phase: 'error', error: 'No extracted slides to share' },
    });
    expect(uploads).toEqual([]);

    await writeFile(path.join(folder, 'Slide_001.png'), 'one');
    vi.spyOn(metadata, 'recordDriveUploads').mockResolvedValueOnce('blocked');
    expect(await service.uploadFolder(folder, () => {})).toMatchObject({
      ok: true, data: { done: 0, failed: 1, total: 1 },
    });
  });

  it('refuses unrecognised folders and signed-out uploads', async () => {
    const { folder, service } = await setup(false);
    expect(await service.uploadFolder(folder, () => {})).toMatchObject({ ok: false, error: 'not-recognised' });
    expect((await service.folderSummary(folder)).recognised).toBe(false);
    const signedOut = new DriveService({} as never, new SlideMetadataService(), { read: async () => null } as never, () => false);
    expect(await signedOut.uploadFolder(folder, () => {})).toMatchObject({ ok: false, error: 'sign-in' });
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

  it('keeps the short link a clone came from, and refuses a foreign one', async () => {
    const { folder, service, metadata } = await setup(false);
    const one = md5Of(Buffer.from('one'));
    const slides = [{ filename: 'Slide_001.png', url: `https://coss.yanhekt.cn/images/2026/10/${one}.png` }];
    const longUrl = buildSlideShareLink({ courseId: '1', sessionId: '2' }, slides)?.longUrl ?? '';
    const shortUrl = 'https://share.ruc.edu.kg/v1/s/Test123';

    await service.recordClone(folder, { source: { courseId: '1', sessionId: '2' }, slides, sourceLink: { longUrl: longUrl.replace('share.ruc.edu.kg', 'example.test'), shortUrl } });
    expect((await metadata.read(folder))?.shares).toBeUndefined();

    await service.recordClone(folder, { source: { courseId: '1', sessionId: '2' }, slides, sourceLink: { longUrl, shortUrl } });
    expect((await metadata.read(folder))?.shares).toMatchObject([{ longUrl, shortUrl, files: ['Slide_001.png'], timeline: false }]);
  });
});
