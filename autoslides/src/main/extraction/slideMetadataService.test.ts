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

describe('SlideMetadataService.setCourseNumber', () => {
  it('adds the number to a folder recorded for that course without one', async () => {
    const dir = await folder();
    const service = new SlideMetadataService();
    await service.writeExtraction(dir, { source: { courseId: '80101', courseTitle: '泛函分析' }, extraction });
    await service.setCourseNumber(dir, '80101', 'K-0001');
    const stored = JSON.parse(await readFile(path.join(dir, 'metadata.json'), 'utf8'));
    expect(stored.source).toEqual({ courseId: '80101', courseTitle: '泛函分析', courseNumber: 'K-0001' });
  });

  it('leaves a folder alone that has no metadata, a number already, or another course', async () => {
    const service = new SlideMetadataService();
    const empty = await folder();
    await service.setCourseNumber(empty, '80101', 'K-0001');
    expect(await service.read(empty)).toBeNull();

    const numbered = await folder();
    await service.writeExtraction(numbered, { source: { courseId: '80101', courseNumber: 'K-9999' }, extraction });
    await service.setCourseNumber(numbered, '80101', 'K-0001');
    expect((await service.read(numbered))?.source.courseNumber).toBe('K-9999');

    const moved = await folder();
    await service.writeExtraction(moved, { source: { courseId: '80102' }, extraction });
    await service.setCourseNumber(moved, '80101', 'K-0001');
    expect((await service.read(moved))?.source.courseNumber).toBeUndefined();
  });
});
