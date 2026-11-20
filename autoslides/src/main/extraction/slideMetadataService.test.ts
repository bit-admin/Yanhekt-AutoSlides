import { mkdtemp, readFile, rm } from 'fs/promises';
import os from 'os';
import path from 'path';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@main/infra/logger', () => ({ createLogger: () => ({ debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }) }));

import { SlideMetadataService } from './slideMetadataService';

const dirs: string[] = [];
afterEach(async () => {
  await Promise.all(dirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

async function folder(): Promise<string> {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'slides-meta-'));
  dirs.push(dir);
  return dir;
}

const extraction = { extractor: 'builtin' as const, extractedAt: '2026-10-21T00:00:00.000Z', trigger: 'watch' as const };

describe('SlideMetadataService.writeExtraction: registrar number', () => {
  it('stores the number the writer passes', async () => {
    const dir = await folder();
    const service = new SlideMetadataService();
    await service.writeExtraction(dir, { source: { courseId: '80101', courseTitle: '泛函分析', courseNumber: 'K-0001' }, extraction });
    const stored = JSON.parse(await readFile(path.join(dir, 'metadata.json'), 'utf8'));
    expect(stored.source).toEqual({ courseId: '80101', courseTitle: '泛函分析', courseNumber: 'K-0001' });
  });

  it('keeps a stored number when a later write for the same course has none, not for another course', async () => {
    const service = new SlideMetadataService();
    const dir = await folder();
    await service.writeExtraction(dir, { source: { courseId: '80101', courseNumber: 'K-0001' }, extraction });
    await service.writeExtraction(dir, { source: { courseId: '80101' }, extraction });
    expect((await service.read(dir))?.source.courseNumber).toBe('K-0001');
    await service.writeExtraction(dir, { source: { courseId: '80101', courseNumber: 'K-0002' }, extraction });
    expect((await service.read(dir))?.source.courseNumber).toBe('K-0002');
    await service.writeExtraction(dir, { source: { courseId: '80102' }, extraction });
    expect((await service.read(dir))?.source.courseNumber).toBeUndefined();
  });
});

describe('SlideMetadataService: Drive records and shares (version 2)', () => {
  const record = (url: string) => ({
    url, md5: url.slice(-36, -4), size: 10, mtimeMs: 1, uploadedAt: '2026-11-20T00:00:00.000Z', updatedAt: '2026-11-20T00:00:00.000Z',
  });
  const share = (id: string, createdAt: string) => ({ id, createdAt, longUrl: `https://x/#${id}`, files: ['Slide_001.png'], timeline: true });

  it('records uploads, marks them removed and restored, and keeps both blocks across a re-extraction write', async () => {
    const dir = await folder();
    const service = new SlideMetadataService();
    expect(await service.recordDriveUploads(dir, { 'Slide_001.png': record('u/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.png') })).toBe('unchanged');

    await service.writeExtraction(dir, { source: { courseId: '1' }, extraction });
    await service.recordDriveUploads(dir, { 'Slide_001.png': record('u/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.png') });
    await service.saveShare(dir, share('s1', '2026-11-20T01:00:00.000Z'));
    await service.markDriveRemoved(dir, ['Slide_001.png', 'Slide_009.png'], true);
    expect((await service.read(dir))?.drive?.files['Slide_001.png'].removedAt).toEqual(expect.any(String));
    await service.markDriveRemoved(dir, ['Slide_001.png'], false);

    await service.writeExtraction(dir, { source: { courseId: '1' }, extraction });
    const stored = await service.read(dir);
    expect(stored?.version).toBe(2);
    expect(stored?.drive?.files['Slide_001.png']).not.toHaveProperty('removedAt');
    expect(stored?.shares?.map((s) => s.id)).toEqual(['s1']);

    await service.removeShare(dir, 's1');
    expect(await service.read(dir)).not.toHaveProperty('shares');
  });

  it('hands carried shares to the next folder of the same lecture only', async () => {
    const service = new SlideMetadataService();
    const other = await folder();
    const parent = await folder();
    const target = path.join(parent, 'slides_课程_第1周__c1s2');
    service.carryShares('__c1s2', [share('old', '2026-11-01T00:00:00.000Z')]);

    await service.writeExtraction(other, { source: { courseId: '9' }, extraction });
    expect((await service.read(other))?.shares).toBeUndefined();

    const { mkdir } = await import('fs/promises');
    await mkdir(target);
    await service.writeExtraction(target, { source: { courseId: '1', sessionId: '2' }, extraction });
    expect((await service.read(target))?.shares?.map((s) => s.id)).toEqual(['old']);
    await service.writeExtraction(target, { source: { courseId: '1', sessionId: '2' }, extraction });
    expect((await service.read(target))?.shares).toHaveLength(1);
  });
});
