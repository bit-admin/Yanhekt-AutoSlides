import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import type { CommandInput } from '../types';
import { appConfigCommand } from './config';
import type { AppCommandContext } from './types';

const TOKEN = '0123456789abcdef0123456789abcdef';

const storedConfig = {
  outputDirectory: '/Users/someone/Lectures',
  connectionMode: 'auto',
  intranetInterfaceIp: '',
  preferAnonymousApiRequests: true,
  maxConcurrentDownloads: 3,
  downloadMaxWorkers: 8,
  downloadNumRetries: 5,
  qtExtractor: { binaryPath: '/opt/extractor', autoRunAfterDownload: true, autoPostProcessAfter: false },
  // Never shown.
  accounts: [{ token: TOKEN, badge: '0000000000', nickname: 'someone' }],
  localRelayTokenWhitelist: [TOKEN],
  obsidianVaultPath: '/Users/someone/Vault',
  yanhe2CaptionMode: 'auto',
  yanhe2SignInWithMain: true,
};

const applied: Array<[string, unknown]> = [];
let current: Record<string, unknown> = structuredClone(storedConfig);

/** Records each write and applies it to `current`, as ConfigService would. */
const writer = new Proxy({} as Record<string, (value: unknown) => void>, {
  get: (_target, method: string) => (value: unknown) => {
    applied.push([method, value]);
    const field = method.replace(/^set/, '');
    const key = field.charAt(0).toLowerCase() + field.slice(1);
    if (key === 'qtExtractorAutoRun') current.qtExtractor = { ...(current.qtExtractor as object), autoRunAfterDownload: value };
    else if (key === 'qtExtractorAutoPostProcess') current.qtExtractor = { ...(current.qtExtractor as object), autoPostProcessAfter: value };
    else if (key === 'intranetInterfaceIp') current.intranetInterfaceIp = value ?? '';
    else current[key] = value;
  },
});

function context(signedIn = true): AppCommandContext {
  return {
    configService: { getConfig: () => current, getAuthToken: () => (signedIn ? TOKEN : '') },
    settings: writer,
    // Never asked: config does not need the app signed in.
    renderer: { request: async () => { throw new Error('asked the renderer'); } },
    term: { info: () => {}, status: () => {}, endStatusLine: () => {}, out: () => {} },
  } as unknown as AppCommandContext;
}

beforeEach(() => {
  applied.length = 0;
  current = structuredClone(storedConfig);
});

const input = (positionals: string[]): CommandInput => ({ program: 'autoslides', positionals, options: {}, json: true });

describe('autoslides config', () => {
  it('shows the listed settings under their command-line names', async () => {
    const { data } = await appConfigCommand.serve(input([]), context());
    expect(data).toEqual({
      settings: {
        output_dir: '/Users/someone/Lectures',
        connection_mode: 'auto',
        intranet_interface: null,
        anonymous_requests: true,
        concurrent_downloads: 3,
        download_workers: 8,
        download_retries: 5,
        extract_after_download: true,
        post_process_after_extraction: false,
      },
    });
  });

  it('never shows a token, a personal path or a Yanhe 2.0 setting', async () => {
    const { data, text } = await appConfigCommand.serve(input([]), context());
    const everything = JSON.stringify(data) + text;
    expect(everything).not.toContain(TOKEN);
    expect(everything).not.toContain('Vault');
    expect(everything).not.toContain('/opt/extractor');
    expect(everything.toLowerCase()).not.toContain('yanhe2');
  });

  it('prints one value bare, for scripts', async () => {
    const result = await appConfigCommand.serve(input(['output_dir']), context());
    expect(result.text).toBe('/Users/someone/Lectures');
    expect(result.data).toEqual({ key: 'output_dir', value: '/Users/someone/Lectures', setting: 'General > Output Directory' });
    expect((await appConfigCommand.serve(input(['intranet_interface']), context())).text).toBe('');
  });

  it('refuses a key it does not list, before asking the app anything', async () => {
    await expect(appConfigCommand.serve(input(['accounts']), context())).rejects.toMatchObject({ code: 'usage' });
  });

  it('works while the app is signed out: nothing here talks to Yanhekt', async () => {
    const { data } = await appConfigCommand.serve(input([]), context(false));
    expect((data as { settings: Record<string, unknown> }).settings.connection_mode).toBe('auto');
  });

  it('sets the connection mode through the app, as Save in Settings would', async () => {
    const result = await appConfigCommand.serve(input(['connection_mode', 'internal']), context(false));
    expect(applied).toEqual([['setConnectionMode', 'internal']]);
    expect(result.data).toEqual({
      key: 'connection_mode',
      value: 'internal',
      previous: 'auto',
      changed: true,
      setting: 'General > Connection Mode',
    });
    expect(result.text).toBe('connection_mode: auto -> internal');
  });

  it('sets every listed key, each through its own writer method', async () => {
    const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'as-config-'));
    try {
      const cases: Array<[string, string, string, unknown, unknown]> = [
        ['output_dir', folder, 'setOutputDirectory', path.normalize(folder), path.normalize(folder)],
        ['intranet_interface', 'default', 'setIntranetInterfaceIp', null, null],
        ['anonymous_requests', 'off', 'setPreferAnonymousApiRequests', false, false],
        ['concurrent_downloads', '10', 'setMaxConcurrentDownloads', 10, 10],
        ['download_workers', '1', 'setDownloadMaxWorkers', 1, 1],
        ['download_retries', '30', 'setDownloadNumRetries', 30, 30],
        ['extract_after_download', 'false', 'setQtExtractorAutoRun', false, false],
        ['post_process_after_extraction', 'yes', 'setQtExtractorAutoPostProcess', true, true],
      ];
      for (const [key, raw, method, written, shown] of cases) {
        applied.length = 0;
        const result = await appConfigCommand.serve(input([key, raw]), context());
        expect(applied, key).toEqual([[method, written]]);
        expect((result.data as { value: unknown }).value, key).toEqual(shown);
      }
    } finally {
      fs.rmSync(folder, { recursive: true, force: true });
    }
  });

  it('says when a value is already set', async () => {
    const result = await appConfigCommand.serve(input(['concurrent_downloads', '3']), context());
    expect(result.text).toBe('concurrent_downloads is already 3.');
    expect((result.data as { changed: boolean }).changed).toBe(false);
  });

  it('refuses a wrong value without changing anything', async () => {
    const wrong: Array<[string, string]> = [
      ['connection_mode', 'intranet'],
      ['anonymous_requests', 'maybe'],
      ['concurrent_downloads', '0'],
      ['concurrent_downloads', '11'],
      ['download_workers', '2.5'],
      ['download_retries', '-1'],
      ['output_dir', 'Lectures'],
      ['output_dir', path.join(os.tmpdir(), 'as-config-missing-folder')],
      ['intranet_interface', 'no-such-interface-0'],
    ];
    for (const [key, raw] of wrong) {
      await expect(appConfigCommand.serve(input([key, raw]), context()), `${key} ${raw}`).rejects.toMatchObject({ code: 'usage' });
    }
    expect(applied).toEqual([]);
  });
});
