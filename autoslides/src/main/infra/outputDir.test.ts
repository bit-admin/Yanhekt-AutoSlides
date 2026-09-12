import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { parseOutputDirProblem } from '@common/outputDirAccess';
import { ensureOutputDirSync, probeOutputDir, readOutputDir, recreateOutputDir } from './outputDir';

// Temp folders stand in for both "home" and "a drive": homedir is pointed at a
// sibling folder, so paths under `root` count as outside home.
let root: string;
let fakeHome: string;

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'autoslides-outdir-'));
  fakeHome = fs.mkdtempSync(path.join(os.tmpdir(), 'autoslides-home-'));
  vi.spyOn(os, 'homedir').mockReturnValue(fakeHome);
});

afterEach(() => {
  vi.restoreAllMocks();
  for (const dir of [root, fakeHome]) {
    fs.chmodSync(dir, 0o755);
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

async function problemOf(promise: Promise<unknown>) {
  try {
    await promise;
  } catch (error) {
    return parseOutputDirProblem(error);
  }
  return null;
}

describe('readOutputDir / probeOutputDir', () => {
  it('lists an existing folder', async () => {
    fs.writeFileSync(path.join(root, 'a.mp4'), '');
    expect((await readOutputDir(root)).map((e) => e.name)).toEqual(['a.mp4']);
    expect(await probeOutputDir(root)).toEqual({ ok: true });
  });

  it('reports missing when the parent still exists', async () => {
    const dir = path.join(root, 'AutoSlides');
    expect(await problemOf(readOutputDir(dir))).toEqual({ kind: 'missing', dir });
    const probe = await probeOutputDir(dir);
    expect(probe.ok === false && parseOutputDirProblem(probe.error)).toEqual({ kind: 'missing', dir });
  });

  it('reports unreachable when the parent is gone outside home (disconnected drive)', async () => {
    const dir = path.join(root, 'SN5000', 'Downloads', 'AutoSlides');
    expect(await problemOf(readOutputDir(dir))).toEqual({ kind: 'unreachable', dir });
  });

  it('reports missing, not unreachable, anywhere under home', async () => {
    const dir = path.join(fakeHome, 'Downloads', 'AutoSlides');
    expect(await problemOf(readOutputDir(dir))).toEqual({ kind: 'missing', dir });
  });

  it.skipIf(process.getuid?.() === 0)('reports denied for an unreadable folder', async () => {
    const dir = path.join(root, 'locked');
    fs.mkdirSync(dir);
    fs.chmodSync(dir, 0o000);
    try {
      expect(await problemOf(readOutputDir(dir))).toEqual({ kind: 'denied', dir });
    } finally {
      fs.chmodSync(dir, 0o755);
    }
  });
});

describe('recreateOutputDir', () => {
  it('recreates a missing folder whose parent exists', async () => {
    const dir = path.join(root, 'AutoSlides');
    await recreateOutputDir(dir);
    expect(fs.statSync(dir).isDirectory()).toBe(true);
    await expect(recreateOutputDir(dir)).resolves.toBeUndefined();
  });

  it('refuses to invent a drive path', async () => {
    const dir = path.join(root, 'SN5000', 'AutoSlides');
    expect(await problemOf(recreateOutputDir(dir))).toEqual({ kind: 'unreachable', dir });
    expect(fs.existsSync(path.join(root, 'SN5000'))).toBe(false);
  });

  it('creates intermediate folders under home', async () => {
    const dir = path.join(fakeHome, 'Downloads', 'AutoSlides');
    await recreateOutputDir(dir);
    expect(fs.statSync(dir).isDirectory()).toBe(true);
  });
});

describe('ensureOutputDirSync', () => {
  it('creates, then reports existing', () => {
    const dir = path.join(root, 'AutoSlides');
    expect(ensureOutputDirSync(dir)).toBe('created');
    expect(ensureOutputDirSync(dir)).toBe('exists');
  });

  it('skips a folder whose drive is gone', () => {
    const dir = path.join(root, 'SN5000', 'AutoSlides');
    expect(ensureOutputDirSync(dir)).toBe('unreachable');
    expect(fs.existsSync(path.join(root, 'SN5000'))).toBe(false);
  });

  it('creates the default under home even without ~/Downloads', () => {
    const dir = path.join(fakeHome, 'Downloads', 'AutoSlides');
    expect(ensureOutputDirSync(dir)).toBe('created');
  });
});
