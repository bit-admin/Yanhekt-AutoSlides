import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CliControlMethods, CliDownloadUpdate } from '@common/cliControl';
import type { CommandInput } from '../types';
import { appDownloadCommand } from './download';
import type { AppCommandContext } from './types';

vi.mock('@main/infra/logger', () => ({
  createLogger: () => ({ debug() {}, info() {}, warn() {}, error() {} }),
  setLoggerConsoleMode: () => {},
}));

let outputDir: string;

beforeEach(() => {
  outputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'as-cli-download-'));
});
afterEach(() => {
  fs.rmSync(outputDir, { recursive: true, force: true });
});

/** The app as `download` uses it: one resolvable session, and a panel that answers `queueDownload`. */
function fakeApp(queueAnswer: CliControlMethods['queueDownload']['result']) {
  const calls: string[] = [];
  const output = { out: [] as string[], info: [] as string[] };
  const watched: string[] = [];
  const ctx = {
    configService: {
      getConfig: () => ({ outputDirectory: outputDir, accounts: [] }),
      getAuthToken: () => 'token',
    },
    apiClient: {
      getSessionDownloadInfo: async (sessionId: string) => ({
        session: { id: '1', session_id: sessionId, video_id: '1', title: '第1讲', vga_url: 'https://example.invalid/screen.m3u8' },
        course: { id: '70101', title: '课程' },
      }),
    },
    renderer: {
      request: async (method: keyof CliControlMethods) => {
        calls.push(method);
        if (method === 'signInState') return { signedIn: true };
        if (method === 'queueDownload') return queueAnswer;
        throw new Error(method);
      },
      seedDownload: () => {},
      watchDownload: (itemId: string, onUpdate: (update: CliDownloadUpdate) => void) => {
        watched.push(itemId);
        onUpdate({ itemId, state: 'completed', progress: 100 });
        return () => {};
      },
      onReset: () => () => {},
    },
    term: {
      info: (text: string) => output.info.push(text),
      status: () => {},
      endStatusLine: () => {},
      out: (text: string) => output.out.push(text),
    },
    signal: new AbortController().signal,
  } as unknown as AppCommandContext;
  return { ctx, calls, output, watched };
}

const input = (json: boolean): CommandInput => ({ program: 'autoslides', positionals: ['850101'], options: {}, json });

type Data = { items: Array<{ status: string; path: string | null; error?: { code: string; message: string } }> };

describe('autoslides download', () => {
  it('queues a stream and follows it to the end', async () => {
    const app = fakeApp({ itemId: 'i1', state: 'queued', progress: 0, added: true });
    const result = await appDownloadCommand.serve(input(false), app.ctx);
    const file = path.join(outputDir, 'screen_课程_第1讲__c70101s850101.mp4');
    expect(app.watched).toEqual(['i1']);
    expect((result.data as Data).items).toMatchObject([{ status: 'downloaded', path: file }]);
    expect(app.output.out).toEqual([file]);
    expect(result.error).toBeUndefined();
  });

  it('keeps stdout for the one JSON answer with --json', async () => {
    const app = fakeApp({ itemId: 'i1', state: 'queued', progress: 0, added: true });
    await appDownloadCommand.serve(input(true), app.ctx);
    expect(app.output.out).toEqual([]);
  });

  it('does not follow or report a row of the panel the command line does not see', async () => {
    const app = fakeApp({ blocked: true });
    const result = await appDownloadCommand.serve(input(true), app.ctx);
    expect(app.watched).toEqual([]);
    const [item] = (result.data as Data).items;
    expect(item).toMatchObject({ status: 'failed', path: null, error: { code: 'failed' } });
    expect(result.error?.code).toBe('failed');
    expect(app.output.out).toEqual([]);
  });
});

describe('autoslides download when the client goes away', () => {
  it('queues nothing more once the client has left during a lookup', async () => {
    const abort = new AbortController();
    const app = fakeApp({ itemId: 'i1', state: 'queued', progress: 0, added: true });
    const lookup = app.ctx.apiClient.getSessionDownloadInfo.bind(app.ctx.apiClient);
    (app.ctx.apiClient as unknown as { getSessionDownloadInfo: typeof lookup }).getSessionDownloadInfo = async (...args) => {
      abort.abort();
      return lookup(...args);
    };
    (app.ctx as { signal: AbortSignal }).signal = abort.signal;
    const both: CommandInput = { ...input(true), options: { stream: 'both' } };
    await appDownloadCommand.serve(both, app.ctx);
    expect(app.calls).not.toContain('queueDownload');
  });

  it('does not wait for downloads when the client left before following them', async () => {
    const abort = new AbortController();
    const app = fakeApp({ itemId: 'i1', state: 'queued', progress: 0, added: true });
    (app.ctx.renderer as unknown as { watchDownload: () => () => void }).watchDownload = () => {
      abort.abort();
      return () => {};
    };
    (app.ctx as { signal: AbortSignal }).signal = abort.signal;
    const done = appDownloadCommand.serve(input(true), app.ctx);
    const winner = await Promise.race([done.then(() => 'returned'), new Promise((r) => setTimeout(() => r('stuck'), 200))]);
    expect(winner).toBe('returned');
  });
});
