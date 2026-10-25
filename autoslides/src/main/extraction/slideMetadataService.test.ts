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
