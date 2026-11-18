import { promises as fs } from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const system = vi.hoisted(() => ({ refuse: new Set<string>(), trashed: [] as string[] }));

vi.mock('electron', () => ({
  shell: {
    // The system trash: the item leaves the disk, unless the test refuses it.
    trashItem: async (target: string) => {
      const name = target.split(/[/\\]/).pop() as string;
      if (system.refuse.has(name)) throw new Error('refused');
      const { promises } = await import('fs');
      await promises.rm(target, { recursive: true, force: true });
      system.trashed.push(name);
    },
  },
}));
vi.mock('@main/infra/sharpService', () => ({ sharpService: {} }));
vi.mock('@main/infra/logger', () => ({ createLogger: () => ({ debug() {}, info() {}, warn() {}, error() {} }) }));
vi.mock('@main/infra/pngCopyright', () => ({ withPngCopyright: (buffer: Uint8Array) => buffer }));
vi.mock('@main/infra/copyrightNoticeFile', () => ({ ensureCopyrightNotice: async () => {} }));

import { SlideExtractionService } from './slideExtractionService';

let root: string;
let service: SlideExtractionService;
const FOLDER_A = 'slides_课程_第1周__c70101s850101';
const FOLDER_B = 'slides_课程_第2周__c70101s850102';
const slide = (n: number) => `Slide_${String(n).padStart(3, '0')}.png`;
const manifestPath = () => path.join(root, '.autoslidesTrash', 'trash-manifest.jsonl');

async function addSlide(folder: string, name: string, content = name): Promise<string> {
  const dir = path.join(root, folder);
  await fs.mkdir(dir, { recursive: true });
  const file = path.join(dir, name);
  await fs.writeFile(file, content);
  return file;
}
const trash = (folder: string, name: string) =>
  service.moveToInAppTrash(path.join(root, folder), name, { reason: 'manual' } as never);
const exists = (target: string) => fs.access(target).then(() => true, () => false);
const listed = async () => (await service.getTrashEntries(root)).map(entry => entry.filename).sort();
const idOf = async (name: string) => (await service.getTrashEntries(root)).find(entry => entry.filename === name)!.id;

beforeEach(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), 'autoslides-trash-'));
  service = new SlideExtractionService();
  system.refuse.clear();
  system.trashed.length = 0;
});
afterEach(async () => {
  vi.restoreAllMocks();
  await fs.rm(root, { recursive: true, force: true });
});

describe('the in-app trash and its manifest', () => {
  it('keeps an entry added while a restore is under way', async () => {
    await addSlide(FOLDER_A, slide(1));
    await addSlide(FOLDER_A, slide(2));
    await trash(FOLDER_A, slide(1));
    const id = await idOf(slide(1));

    // Hold the restore at its file move, as a slow disk would.
    let release!: () => void;
    const gate = new Promise<void>(resolve => (release = resolve));
    let reached!: () => void;
    const atMove = new Promise<void>(resolve => (reached = resolve));
    const rename = fs.rename.bind(fs);
    const spy = vi.spyOn(fs, 'rename').mockImplementation(async (from, to) => {
      if (String(to).endsWith(path.join(FOLDER_A, slide(1))) && !String(to).includes('.autoslidesTrash')) {
        reached();
        await gate;
      }
      return rename(from, to);
    });

    const restoring = service.restoreFromTrash([id], root);
    await atMove;
    const trashing = trash(FOLDER_A, slide(2));
    await new Promise(resolve => setTimeout(resolve, 20));
    release();
    await Promise.all([restoring, trashing]);
    spy.mockRestore();

    expect(await listed()).toEqual([slide(2)]);
    expect(await exists(path.join(root, FOLDER_A, slide(1)))).toBe(true);
  });

  it('reports which entries were restored, and keeps the ones that were not', async () => {
    await addSlide(FOLDER_A, slide(1));
    await addSlide(FOLDER_A, slide(2));
    await trash(FOLDER_A, slide(1));
    await trash(FOLDER_A, slide(2));
    const ids = [await idOf(slide(1)), await idOf(slide(2))];
    const rename = fs.rename.bind(fs);
    vi.spyOn(fs, 'rename').mockImplementation(async (from, to) => {
      if (String(from).endsWith(slide(2)) && String(from).includes('.autoslidesTrash')) throw new Error('EPERM');
      return rename(from, to);
    });

    const outcome = await service.restoreTrashEntries(ids, root);
    expect(outcome.restored.map(entry => entry.filename)).toEqual([slide(1)]);
    expect(outcome.failed.map(entry => entry.filename)).toEqual([slide(2)]);
    vi.restoreAllMocks();
    expect(await listed()).toEqual([slide(2)]);
  });

  it('does not restore over a file that is already there', async () => {
    const original = await addSlide(FOLDER_A, slide(1), 'old');
    await trash(FOLDER_A, slide(1));
    await fs.writeFile(original, 'newer');
    const outcome = await service.restoreTrashEntries([await idOf(slide(1))], root);
    expect(outcome.restored).toEqual([]);
    expect(outcome.failed).toHaveLength(1);
    expect(await fs.readFile(original, 'utf8')).toBe('newer');
    expect(await listed()).toEqual([slide(1)]);
  });

  it('leaves the slide where it was when the manifest cannot be written', async () => {
    const file = await addSlide(FOLDER_A, slide(1));
    vi.spyOn(fs, 'appendFile').mockRejectedValue(new Error('ENOSPC'));
    await expect(trash(FOLDER_A, slide(1))).rejects.toThrow('ENOSPC');
    vi.restoreAllMocks();
    expect(await exists(file)).toBe(true);
    expect(await listed()).toEqual([]);
  });

  it('lists nothing for a slide whose move failed, and one entry when it is trashed again', async () => {
    const file = await addSlide(FOLDER_A, slide(1));
    const rename = fs.rename.bind(fs);
    const spy = vi.spyOn(fs, 'rename').mockRejectedValueOnce(new Error('EBUSY'));
    await expect(trash(FOLDER_A, slide(1))).rejects.toThrow('EBUSY');
    spy.mockImplementation(rename);
    expect(await exists(file)).toBe(true);
    expect(await listed()).toEqual([]);

    await trash(FOLDER_A, slide(1));
    expect(await listed()).toEqual([slide(1)]);
  });

  it('keeps listing what Empty Trash could not move to the system trash', async () => {
    await addSlide(FOLDER_A, slide(1));
    await addSlide(FOLDER_B, slide(2));
    await trash(FOLDER_A, slide(1));
    await trash(FOLDER_B, slide(2));
    system.refuse.add(FOLDER_B);

    const outcome = await service.clearTrash(root);
    expect(outcome).toEqual({ cleared: 1, failed: 1 });
    expect(await listed()).toEqual([slide(2)]);

    system.refuse.clear();
    expect(await service.clearTrash(root)).toEqual({ cleared: 1, failed: 0 });
    expect(await listed()).toEqual([]);
    expect(await exists(manifestPath())).toBe(false);
  });

  it('clears selected entries and keeps the rest and the refused ones', async () => {
    for (const n of [1, 2, 3]) {
      await addSlide(FOLDER_A, slide(n));
      await trash(FOLDER_A, slide(n));
    }
    system.refuse.add(slide(2));
    const outcome = await service.clearTrashEntries([await idOf(slide(1)), await idOf(slide(2))], root);
    expect(outcome).toEqual({ cleared: 1, failed: 1 });
    expect(await listed()).toEqual([slide(2), slide(3)]);
  });

  it('never leaves a half-written manifest: a failed rewrite keeps the old one', async () => {
    await addSlide(FOLDER_A, slide(1));
    await addSlide(FOLDER_A, slide(2));
    await trash(FOLDER_A, slide(1));
    await trash(FOLDER_A, slide(2));
    const before = await fs.readFile(manifestPath(), 'utf8');
    vi.spyOn(fs, 'writeFile').mockRejectedValue(new Error('ENOSPC'));
    await expect(service.restoreFromTrash([await idOf(slide(1))], root)).rejects.toThrow('ENOSPC');
    vi.restoreAllMocks();
    expect(await fs.readFile(manifestPath(), 'utf8')).toBe(before);
    // The file did move; its stale line is not listed and goes with the next rewrite.
    expect(await listed()).toEqual([slide(2)]);
    expect((await fs.readdir(path.dirname(manifestPath()))).filter(name => name.endsWith('.tmp'))).toEqual([]);
  });

  it('removes a folder with its trash and prunes only its entries', async () => {
    await addSlide(FOLDER_A, slide(1));
    await addSlide(FOLDER_A, slide(3));
    await addSlide(FOLDER_B, slide(2));
    await trash(FOLDER_A, slide(1));
    await trash(FOLDER_B, slide(2));
    expect(await service.removeFolders([FOLDER_A], root)).toEqual({ removed: 1, failed: 0 });
    expect(await listed()).toEqual([slide(2)]);
    const lines = (await fs.readFile(manifestPath(), 'utf8')).trim().split('\n');
    expect(lines).toHaveLength(1);
  });
});
