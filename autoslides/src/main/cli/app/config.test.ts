import { describe, expect, it } from 'vitest';
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

function context(signedIn = true): AppCommandContext {
  return {
    configService: { getConfig: () => storedConfig, getAuthToken: () => (signedIn ? TOKEN : '') },
    renderer: { request: async () => ({ signedIn }) },
    term: { info: () => {}, status: () => {}, endStatusLine: () => {}, out: () => {} },
  } as unknown as AppCommandContext;
}

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

  it('needs the app signed in, like every autoslides command', async () => {
    await expect(appConfigCommand.serve(input([]), context(false))).rejects.toMatchObject({ code: 'sign_in_required' });
  });
});
