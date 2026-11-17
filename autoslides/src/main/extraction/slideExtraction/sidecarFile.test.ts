import { promises as fs } from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SidecarFile } from './sidecarFile';

interface Doc { n: number; note?: string }
const messages: string[] = [];
const log = { warn: (m: string) => void messages.push(m), error: (m: string) => void messages.push(m) };

let dir: string;
let file: string;
let sidecar: SidecarFile<Doc>;
const onDisk = async () => JSON.parse(await fs.readFile(file, 'utf8')) as Doc;
const names = async () => (await fs.readdir(dir)).sort();

beforeEach(async () => {
  dir = await fs.mkdtemp(path.join(os.tmpdir(), 'autoslides-sidecar-'));
  file = path.join(dir, 'metadata.json');
  sidecar = new SidecarFile<Doc>('metadata', log);
  messages.length = 0;
});
afterEach(async () => {
  vi.restoreAllMocks();
  await fs.rm(dir, { recursive: true, force: true });
});

describe('a JSON sidecar', () => {
  it('applies queued updates in order, each on the result of the one before', async () => {
    const outcomes = await Promise.all(
      [1, 2, 3, 4, 5].map(() => sidecar.mutate(file, current => ({ n: (current?.n ?? 0) + 1 }))),
    );
    expect(outcomes).toEqual(Array(5).fill('written'));
    expect(await onDisk()).toEqual({ n: 5 });
    expect(await names()).toEqual(['metadata.json']);
  });

  it('tells missing, damaged and readable apart', async () => {
    expect(await sidecar.read(file)).toEqual({ state: 'missing' });
    await fs.writeFile(file, '{"n": 1');
    expect((await sidecar.read(file)).state).toBe('invalid');
    await fs.writeFile(file, '[1]');
    expect((await sidecar.read(file)).state).toBe('invalid');
    await fs.writeFile(file, '{"n": 1}');
    expect(await sidecar.read(file)).toEqual({ state: 'ok', value: { n: 1 } });
  });

  it('writes nothing for an update that returns null', async () => {
    expect(await sidecar.mutate(file, current => (current ? { n: 9 } : null))).toBe('unchanged');
    expect(await names()).toEqual([]);
  });

  it('keeps the previous file when a write fails, and says it failed', async () => {
    await sidecar.mutate(file, () => ({ n: 1 }));
    vi.spyOn(fs, 'rename').mockRejectedValueOnce(new Error('ENOSPC'));
    expect(await sidecar.mutate(file, () => ({ n: 2 }))).toBe('failed');
    expect(await onDisk()).toEqual({ n: 1 });
    expect(await names()).toEqual(['metadata.json']);
    // The queue is not wedged.
    expect(await sidecar.mutate(file, current => ({ n: (current?.n ?? 0) + 10 }))).toBe('written');
    expect(await onDisk()).toEqual({ n: 11 });
  });

  it('sets a damaged file aside before writing a new one, and leaves it for an updater that skips', async () => {
    await fs.writeFile(file, '{"n": 1, "note": "half wri');
    expect(await sidecar.mutate(file, current => (current ? { n: 2 } : null))).toBe('unchanged');
    expect(await fs.readFile(file, 'utf8')).toBe('{"n": 1, "note": "half wri');

    expect(await sidecar.mutate(file, current => ({ n: (current?.n ?? 0) + 1 }))).toBe('written');
    expect(await onDisk()).toEqual({ n: 1 });
    const kept = (await names()).filter(name => name.startsWith('metadata.json.damaged-'));
    expect(kept).toHaveLength(1);
    expect(await fs.readFile(path.join(dir, kept[0]), 'utf8')).toBe('{"n": 1, "note": "half wri');
  });

  it('never writes over a file it could not read', async () => {
    await fs.writeFile(file, '{"n": 1}');
    const readFile = fs.readFile.bind(fs);
    vi.spyOn(fs, 'readFile').mockRejectedValueOnce(Object.assign(new Error('EACCES'), { code: 'EACCES' }));
    expect(await sidecar.mutate(file, () => ({ n: 2 }))).toBe('blocked');
    expect(JSON.parse(String(await readFile(file, 'utf8')))).toEqual({ n: 1 });
  });

  it('lets a reader wait for the writes queued before it', async () => {
    const writing = sidecar.mutate(file, () => ({ n: 7 }));
    expect(await sidecar.read(file)).toEqual({ state: 'missing' });
    await sidecar.settled(file);
    expect(await sidecar.read(file)).toEqual({ state: 'ok', value: { n: 7 } });
    await writing;
  });

  it('carries on after an update that throws', async () => {
    await expect(
      sidecar.mutate(file, () => {
        throw new Error('bad update');
      }),
    ).rejects.toThrow('bad update');
    expect(await sidecar.mutate(file, () => ({ n: 1 }))).toBe('written');
  });
});
