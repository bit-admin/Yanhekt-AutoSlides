// What ConfigService does at launch with a hand-edited or damaged config:
// every stored value is repaired before the start-up steps that act on it.
import { beforeEach, describe, expect, it, vi } from 'vitest';

const disk = vi.hoisted(() => ({ data: {} as Record<string, unknown> }));
const effects = vi.hoisted(() => ({ outputDirs: [] as unknown[], themes: [] as unknown[] }));

vi.mock('electron-store', () => ({
  default: class {
    path = '/fake/autoslides-config.json';
    constructor(options: { defaults: Record<string, unknown> }) {
      disk.data = { ...structuredClone(options.defaults), ...disk.data };
    }
    get store() { return disk.data; }
    set store(value: Record<string, unknown>) { disk.data = value; }
    get(key: string) { return disk.data[key]; }
    set(key: string, value: unknown) { disk.data[key] = value; }
    has(key: string) { return key in disk.data; }
    delete(key: string) { delete disk.data[key]; }
  },
}));
vi.mock('electron', () => ({ app: { getPath: () => '/fake', isPackaged: false }, dialog: {}, nativeTheme: { themeSource: 'system', shouldUseDarkColors: false, on() {} } }));
vi.mock('./themeService', () => ({
  ThemeService: class {
    setTheme(mode: unknown) { effects.themes.push(mode); }
    isDarkMode() { return false; }
  },
}));
vi.mock('@main/infra/outputDir', () => ({ ensureOutputDirSync: (dir: unknown) => (effects.outputDirs.push(dir), 'exists') }));
vi.mock('@main/infra/copyrightNoticeFile', () => ({ ensureCopyrightNoticeSync: () => {} }));
vi.mock('./config/schemaFile', () => ({ installConfigSchema: () => {} }));
vi.mock('@main/infra/logger', () => ({ createLogger: () => ({ debug() {}, info() {}, warn() {}, error() {} }) }));

import { ConfigService } from './configService';
import { defaultConfig } from './config/defaults';

beforeEach(() => {
  disk.data = {};
  effects.outputDirs = [];
  effects.themes = [];
});

describe('ConfigService at launch', () => {
  it('repairs the output folder before creating it', () => {
    disk.data = { outputDirectory: 42 };
    new ConfigService();
    expect(effects.outputDirs).toEqual([defaultConfig.outputDirectory]);
  });

  it('repairs the theme before applying it', () => {
    disk.data = { themeMode: ['dark'] };
    new ConfigService();
    expect(effects.themes).toEqual([defaultConfig.themeMode]);
  });

  it('moves a legacy sign-in into the account list even when the list was damaged', () => {
    disk.data = { accounts: 'oops', authToken: '0123456789abcdef0123456789abcdef', userDisplayName: 'Student' };
    const config = new ConfigService();
    const accounts = disk.data.accounts as Array<{ token: string; displayName: string }>;
    expect(Array.isArray(accounts)).toBe(true);
    expect(accounts).toHaveLength(1);
    expect(accounts[0]).toMatchObject({ token: '0123456789abcdef0123456789abcdef', displayName: 'Student' });
    expect(config.getAuthToken()).toBe('0123456789abcdef0123456789abcdef');
  });

  it('keeps a migrated sign-in whose old names were damaged', () => {
    disk.data = { authToken: 'c'.repeat(32), userDisplayName: 7 };
    new ConfigService();
    expect(disk.data.accounts).toMatchObject([{ token: 'c'.repeat(32), displayName: '' }]);
  });

  it('leaves a sound account list alone', () => {
    const accounts = [{ badge: '0000000001', nickname: 'n', displayName: 'd', token: 'a'.repeat(32), addedAt: 1, lastUsedAt: 1 }];
    disk.data = { accounts, authToken: 'b'.repeat(32) };
    new ConfigService();
    expect(disk.data.accounts).toEqual(accounts);
  });
});
