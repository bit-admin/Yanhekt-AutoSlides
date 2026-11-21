import { promises as fs } from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ShareService } from './shareService';

vi.mock('electron', () => ({ app: { getPath: () => os.tmpdir(), getVersion: () => '0.0.0' } }));
vi.mock('@main/infra/http', () => ({ httpFetch: vi.fn() }));
vi.mock('@main/infra/logger', () => ({ createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() }) }));
vi.mock('@main/infra/sharpService', () => ({ sharpService: { isAvailable: () => false } }));

const STAGE_A = '.autoslides-clone-00000000-0000-4000-8000-000000000001';
const STAGE_B = '.autoslides-clone-00000000-0000-4000-8000-000000000002';
const HOUR = 60 * 60 * 1000;
let root: string;

const exists = (name: string) => fs.access(path.join(root, name)).then(() => true, () => false);
const service = () => new ShareService(
  { getAuthToken: () => null, getConfig: () => ({ outputDirectory: root }) } as never,
  {} as never,
);
const later = async (name: string) => (await fs.stat(path.join(root, name))).mtimeMs + 2 * HOUR;

beforeEach(async () => { root = await fs.mkdtemp(path.join(os.tmpdir(), 'clone-stage-')); });
afterEach(async () => { await fs.rm(root, { recursive: true, force: true }); });

describe('removeAbandonedCloneStages', () => {
  it('removes an old stage that never reached metadata.json', async () => {
    await fs.mkdir(path.join(root, STAGE_A));
    await fs.writeFile(path.join(root, STAGE_A, 'Slide_001.png'), 'x');
    expect(await service().removeAbandonedCloneStages(await later(STAGE_A))).toBe(1);
    expect(await exists(STAGE_A)).toBe(false);
  });

  it('keeps a finished stage, which may be the only copy', async () => {
    await fs.mkdir(path.join(root, STAGE_B));
    await fs.writeFile(path.join(root, STAGE_B, 'metadata.json'), '{}');
    expect(await service().removeAbandonedCloneStages(await later(STAGE_B))).toBe(0);
    expect(await exists(STAGE_B)).toBe(true);
  });

  it('keeps a recent stage and anything not named like a stage', async () => {
    await fs.mkdir(path.join(root, STAGE_A));
    await fs.mkdir(path.join(root, '.autoslides-clone-mine'));
    expect(await service().removeAbandonedCloneStages()).toBe(0);
    expect(await service().removeAbandonedCloneStages(Date.now() + 2 * HOUR)).toBe(1);
    expect(await exists('.autoslides-clone-mine')).toBe(true);
  });
});
