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

  it('disables a retired Yanhekt watch-notes opt-in without removing the share preference', () => {
    disk.data = {
      watchNotesEnabled: true,
      watchNotesProvider: 'yanhekt',
      cloudStorageInitializedUsers: ['fixture'],
      cloudAutoSyncMode: 'reviewed',
      cloudAutoResyncMode: 'edited',
      cloudShareEmbedTimeline: false,
    };
    const config = new ConfigService().getConfig();
    expect(config).toMatchObject({ watchNotesEnabled: false, watchNotesProvider: 'obsidian', cloudShareEmbedTimeline: false });
    for (const key of ['cloudStorageInitializedUsers', 'cloudAutoSyncMode', 'cloudAutoResyncMode']) {
      expect(config).not.toHaveProperty(key);
      expect(disk.data).not.toHaveProperty(key);
    }
  });

  it('defaults Share Timeline to on and persists either checkbox value', () => {
    const service = new ConfigService();
    expect(service.getConfig().cloudShareEmbedTimeline).toBe(true);
    service.setCloudShareEmbedTimeline(false);
    const reopened = new ConfigService();
    expect(reopened.getConfig().cloudShareEmbedTimeline).toBe(false);
    expect(() => reopened.setCloudShareEmbedTimeline('true' as unknown as boolean)).toThrow(TypeError);
    expect(reopened.getConfig().cloudShareEmbedTimeline).toBe(false);
    reopened.setCloudShareEmbedTimeline(true);
    expect(new ConfigService().getConfig().cloudShareEmbedTimeline).toBe(true);
  });

  it('does not inherit an opt-in from the legacy Yanhekt sync flag', () => {
    disk.data = { cloudWatchSyncEnabled: true };
    const config = new ConfigService().getConfig();
    expect(config).toMatchObject({ watchNotesEnabled: false, watchNotesProvider: 'obsidian' });
    expect(disk.data).not.toHaveProperty('cloudWatchSyncEnabled');
  });

  it.each(['obsidian', 'notion'] as const)('preserves an existing %s destination and opt-in', (provider) => {
    disk.data = { watchNotesEnabled: true, watchNotesProvider: provider };
    const service = new ConfigService();
    service.setWatchNotes({ enabled: false, provider: 'yanhekt' as typeof provider });
    expect(service.getConfig()).toMatchObject({ watchNotesEnabled: true, watchNotesProvider: provider });
  });

  it('leaves a sound account list alone', () => {
    const accounts = [{ badge: '0000000001', nickname: 'n', displayName: 'd', token: 'a'.repeat(32), addedAt: 1, lastUsedAt: 1 }];
    disk.data = { accounts, authToken: 'b'.repeat(32) };
    new ConfigService();
    expect(disk.data.accounts).toEqual(accounts);
  });
});
