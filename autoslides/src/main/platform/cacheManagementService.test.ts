import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const paths = vi.hoisted(() => ({ userData: '', temp: '' }));
const clearStorageData = vi.hoisted(() => vi.fn(async () => {}));

vi.mock('electron', () => {
  const ses = { clearCache: async () => {}, clearCodeCaches: async () => {}, clearStorageData };
  return {
    app: { getPath: (name: string) => (name === 'userData' ? paths.userData : paths.temp), isPackaged: false },
    session: { defaultSession: ses, fromPartition: () => ses },
  };
});
vi.mock('@main/infra/logger', () => ({ createLogger: () => ({ debug() {}, info() {}, warn() {}, error() {} }) }));
vi.mock('@main/infra/logFile', () => ({ clearLogFiles: async () => {}, getLogDir: () => null }));

import { CacheManagementService } from './cacheManagementService';

let root: string;

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'as-reset-'));
  paths.userData = path.join(root, 'userData');
  paths.temp = path.join(root, 'temp');
  for (const name of ['autoslides-config.json', 'models', 'logs']) {
    const target = path.join(paths.userData, name);
    if (name.endsWith('.json')) {
      fs.mkdirSync(paths.userData, { recursive: true });
      fs.writeFileSync(target, '{}');
    } else {
      fs.mkdirSync(target, { recursive: true });
      fs.writeFileSync(path.join(target, 'x'), 'x');
    }
  }
  clearStorageData.mockReset();
  clearStorageData.mockResolvedValue(undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
  fs.rmSync(root, { recursive: true, force: true });
});

describe('factory reset', () => {
  it('removes everything but the logs and says so', async () => {
    const result = await new CacheManagementService().resetAllData();
    expect(result).toEqual({ success: true, notRemoved: [] });
    expect(fs.readdirSync(paths.userData)).toEqual(['logs']);
  });

  it('reports what it could not remove instead of claiming success', async () => {
    const rm = fs.promises.rm;
    vi.spyOn(fs.promises, 'rm').mockImplementation(async (target, options) => {
      if (String(target).endsWith('models')) throw Object.assign(new Error('busy'), { code: 'EBUSY' });
      return rm(target, options);
    });
    const result = await new CacheManagementService().resetAllData();
    expect(result.success).toBe(false);
    expect(result.notRemoved).toEqual(['models']);
    expect(result.error).toContain('models');
    expect(fs.existsSync(path.join(paths.userData, 'autoslides-config.json'))).toBe(false);
  });

  it('counts browser data it could not clear as not removed', async () => {
    clearStorageData.mockRejectedValue(new Error('locked'));
    const result = await new CacheManagementService().resetAllData();
    expect(result.success).toBe(false);
    expect(result.notRemoved).toContain('browser data');
  });
});
