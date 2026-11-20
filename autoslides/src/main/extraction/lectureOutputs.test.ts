import { mkdtemp, mkdir, rm, writeFile } from 'fs/promises';
import os from 'os';
import path from 'path';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@main/infra/logger', () => ({ createLogger: () => ({ debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }) }));

import { LectureOutputs } from './lectureOutputs';
import { SlideMetadataService } from './slideMetadataService';

const dirs: string[] = [];
afterEach(async () => {
  await Promise.all(dirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

const extraction = { extractor: 'qt' as const, extractedAt: '2026-11-20T00:00:00.000Z' };

async function setup() {
  const root = await mkdtemp(path.join(os.tmpdir(), 'outputs-'));
  dirs.push(root);
  const metadata = new SlideMetadataService();
  const removed: string[] = [];
  const trashed: string[] = [];
  const outputs = new LectureOutputs({
    metadata,
    removeFolders: async (names) => { removed.push(...names); return { removed: names.length, failed: 0 }; },
    trashFile: async (filePath) => { trashed.push(path.basename(filePath)); },
  });
  return { root, metadata, outputs, removed, trashed };
}

describe('LectureOutputs', () => {
  it('finds a lecture by its id block, whatever the rest of the folder name', async () => {
    const { root, metadata, outputs } = await setup();
    const folder = path.join(root, 'slides_其他名字__c1s2');
    await mkdir(folder);
    await writeFile(path.join(folder, 'Slide_001.png'), 'x');
    await metadata.writeExtraction(folder, { source: { courseId: '1', sessionId: '2' }, extraction });
    await writeFile(path.join(root, 'screen_课程__c1s2.mp4'), 'v');
    await mkdir(path.join(root, 'slides_课程__c1s20'));

    const [hit, none] = await outputs.probe(root, [
      { key: 'a', courseId: '1', sessionId: '2', videoFile: 'screen_课程__c1s2.mp4' },
      { key: 'b', courseId: '1', sessionId: '3', videoFile: 'screen_课程__c1s3.mp4' },
    ]);
    expect(hit).toMatchObject({ key: 'a', videoExists: true, slides: { folders: ['slides_其他名字__c1s2'], slideCount: 1, extracted: true } });
    expect(none).toEqual({ key: 'b', videoExists: false, slides: null });
  });

  it('does not count an empty or unrecorded folder as extracted', async () => {
    const { root, outputs } = await setup();
    await mkdir(path.join(root, 'slides_课程__c1s2'));
    const [state] = await outputs.probe(root, [{ key: 'a', courseId: '1', sessionId: '2' }]);
    expect(state.slides).toMatchObject({ extracted: false, slideCount: 0 });
  });

  it('retires folders and videos, carrying the folder share records to the next extraction', async () => {
    const { root, metadata, outputs, removed, trashed } = await setup();
    const folder = path.join(root, 'slides_课程__c1s2');
    await mkdir(folder);
    await metadata.writeExtraction(folder, { source: { courseId: '1', sessionId: '2' }, extraction });
    await metadata.saveShare(folder, { id: 'old', createdAt: '2026-11-01T00:00:00.000Z', longUrl: 'https://x/#a', files: [], timeline: false });
    await writeFile(path.join(root, 'screen_课程__c1s2.mp4'), 'v');

    expect(await outputs.retire(root, { slidesFolders: ['slides_课程__c1s2', '../x'], videoFiles: ['screen_课程__c1s2.mp4', 'missing.mp4'] }))
      .toEqual({ removed: 2, failed: 0 });
    expect(removed).toEqual(['slides_课程__c1s2']);
    expect(trashed).toEqual(['screen_课程__c1s2.mp4']);

    await rm(folder, { recursive: true });
    await mkdir(folder);
    await metadata.writeExtraction(folder, { source: { courseId: '1', sessionId: '2' }, extraction });
    expect((await metadata.read(folder))?.shares?.map((s) => s.id)).toEqual(['old']);
  });
});
