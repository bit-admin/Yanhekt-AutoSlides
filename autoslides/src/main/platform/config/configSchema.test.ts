import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import Ajv from 'ajv';
import { describe, expect, it } from 'vitest';
import schema from './appConfig.schema.json';
import { defaultConfig } from './defaults';
import { repairStoredConfig, type RepairableStore } from './repair';
import { CONFIG_SCHEMA_FILE_NAME, CONFIG_SCHEMA_REF, installConfigSchema } from './schemaFile';

function fakeStore(initial: Record<string, unknown>) {
  const data: Record<string, unknown> = JSON.parse(JSON.stringify(initial));
  const writes: string[] = [];
  const store: RepairableStore = {
    has: (key) => key in data,
    get: (key) => data[key],
    set: (key, value) => {
      writes.push(key);
      data[key] = value;
    },
    delete: (key) => {
      writes.push(key);
      delete data[key];
    },
  };
  return { store, data, writes };
}

function storedDefaults(): Record<string, unknown> {
  return JSON.parse(JSON.stringify(defaultConfig));
}

describe('appConfig.schema.json', () => {
  it('matches AppConfig (run `npm run gen:config-schema` after changing it)', async () => {
    // A variable path keeps tsc from pulling the script into the program.
    const script = path.resolve(__dirname, '../../../../scripts/gen-config-schema.mjs');
    const { buildConfigSchema, formatSchema, schemaFile } = await import(script);
    expect(fs.readFileSync(schemaFile, 'utf8')).toBe(formatSchema(buildConfigSchema()));
  }, 30_000);

  it('accepts the defaults', () => {
    const validate = new Ajv({ strict: false, allErrors: true }).compile(schema);
    expect(validate(storedDefaults()), JSON.stringify(validate.errors)).toBe(true);
  });
});

describe('repairStoredConfig', () => {
  it('leaves a valid config alone and writes nothing', () => {
    const { store, writes } = fakeStore(storedDefaults());
    expect(repairStoredConfig(store, defaultConfig)).toEqual([]);
    expect(writes).toEqual([]);
  });

  it('puts back the default for a top-level value of the wrong type', () => {
    const { store, data } = fakeStore({ ...storedDefaults(), parallelTasks: 'four', connectionMode: 'sometimes' });
    const repairs = repairStoredConfig(store, defaultConfig);
    expect(repairs).toEqual(
      expect.arrayContaining([
        { path: 'parallelTasks', action: 'default' },
        { path: 'connectionMode', action: 'default' },
      ]),
    );
    expect(data.parallelTasks).toBe(2);
    expect(data.connectionMode).toBe('auto');
  });

  it('repairs only the bad nested field and keeps its siblings', () => {
    const stored = storedDefaults();
    const extraction = stored.slideExtraction as Record<string, any>;
    extraction.ssimThreshold = 0.95;
    extraction.autoCrop.blackThreshold = 'dark';
    const { store, data } = fakeStore(stored);
    expect(repairStoredConfig(store, defaultConfig)).toEqual([
      { path: 'slideExtraction/autoCrop/blackThreshold', action: 'default' },
    ]);
    const repaired = data.slideExtraction as Record<string, any>;
    expect(repaired.autoCrop.blackThreshold).toBe(20);
    expect(repaired.ssimThreshold).toBe(0.95);
  });

  it('drops a broken array element and keeps the others', () => {
    const good = { badge: '70101', nickname: 'a', displayName: 'a', token: 't1', addedAt: 1, lastUsedAt: 2 };
    const bad = { ...good, badge: 70102 };
    const other = { ...good, badge: '70103' };
    const { store, data } = fakeStore({ ...storedDefaults(), accounts: [good, bad, other], savedSearchesLive: ['x', 3, 'y'] });
    const repairs = repairStoredConfig(store, defaultConfig);
    expect(repairs).toEqual(
      expect.arrayContaining([
        { path: 'accounts/1', action: 'removed' },
        { path: 'savedSearchesLive/1', action: 'removed' },
      ]),
    );
    expect(data.accounts).toEqual([good, other]);
    expect(data.savedSearchesLive).toEqual(['x', 'y']);
  });

  it('accepts missing fields and unknown keys from other versions', () => {
    const stored = storedDefaults();
    delete (stored.aiFiltering as Record<string, unknown>).requestBody;
    (stored.qtExtractor as Record<string, unknown>).retiredField = true;
    stored.someRetiredKey = { anything: 1 };
    const { store, writes } = fakeStore(stored);
    expect(repairStoredConfig(store, defaultConfig)).toEqual([]);
    expect(writes).toEqual([]);
  });

  it('removes a bad value that has no default', () => {
    const { store, data } = fakeStore({ ...storedDefaults(), intranetInterfaceIp: 5 });
    expect(repairStoredConfig(store, defaultConfig)).toEqual([{ path: 'intranetInterfaceIp', action: 'removed' }]);
    expect('intranetInterfaceIp' in data).toBe(false);
  });

  it('never touches standalone keys or keys read through their own normalizer', () => {
    const { store, writes } = fakeStore({
      ...storedDefaults(),
      authToken: 12345,
      ssoDeviceCookies: 'not a list',
      yanhektLiveWorkaround: 1,
    });
    expect(repairStoredConfig(store, defaultConfig)).toEqual([]);
    expect(writes).toEqual([]);
  });

  it('accepts the $schema pointer', () => {
    const { store, writes } = fakeStore({ ...storedDefaults(), $schema: CONFIG_SCHEMA_REF });
    expect(repairStoredConfig(store, defaultConfig)).toEqual([]);
    expect(writes).toEqual([]);
  });

  it('replaces a whole object stored as the wrong type', () => {
    const { store, data } = fakeStore({ ...storedDefaults(), qtExtractor: 'none' });
    expect(repairStoredConfig(store, defaultConfig)).toEqual([{ path: 'qtExtractor', action: 'default' }]);
    expect(data.qtExtractor).toEqual(defaultConfig.qtExtractor);
  });
});

describe('installConfigSchema', () => {
  it('writes the schema beside the config once and points the config at it', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'autoslides-schema-'));
    try {
      const { store, data, writes } = fakeStore({});
      installConfigSchema(store, dir);
      const file = path.join(dir, CONFIG_SCHEMA_FILE_NAME);
      expect(JSON.parse(fs.readFileSync(file, 'utf8'))).toEqual(schema);
      expect(data.$schema).toBe(CONFIG_SCHEMA_REF);

      // A second launch with nothing changed writes nothing.
      const before = fs.statSync(file).mtimeMs;
      writes.length = 0;
      installConfigSchema(store, dir);
      expect(writes).toEqual([]);
      expect(fs.statSync(file).mtimeMs).toBe(before);

      // An outdated copy (older app version) is replaced.
      fs.writeFileSync(file, '{}');
      installConfigSchema(store, dir);
      expect(JSON.parse(fs.readFileSync(file, 'utf8'))).toEqual(schema);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});
