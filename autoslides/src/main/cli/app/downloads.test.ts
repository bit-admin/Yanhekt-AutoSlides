import path from 'node:path';
import { describe, expect, it } from 'vitest';
import type { CliControlMethods, CliDownloadUpdate, CliQueueItem } from '@common/cliControl';
import { CliError } from '../errors';
import type { CommandInput } from '../types';
import { appDownloadsCommand } from './downloads';
import type { AppCommandContext } from './types';

const OUT = path.join(path.sep, 'out');

const row = (over: Partial<CliQueueItem> & Pick<CliQueueItem, 'itemId' | 'state'>): CliQueueItem => ({
  progress: 0,
  kind: 'screen',
  name: 'screen_课程-第1讲',
  sessionId: '850101',
  courseId: '70101',
  courseTitle: '课程',
  sessionTitle: '第1讲',
  addedAt: 0,
  completedAt: null,
  extraction: null,
  ...over,
});

/** A Download panel the command talks to, with the bridge calls it makes. */
function fakeApp(items: CliQueueItem[], signedIn = true) {
  const listeners = new Map<string, (update: CliDownloadUpdate) => void>();
  const latest = new Map<string, CliDownloadUpdate>();
  const calls: Array<{ method: string; params: unknown }> = [];
  const output = { out: [] as string[], info: [] as string[] };
  const abort = new AbortController();

  const answer = <M extends keyof CliControlMethods>(method: M, params: CliControlMethods[M]['params']): unknown => {
    calls.push({ method, params });
    switch (method) {
      case 'signInState':
        return { signedIn };
      case 'listDownloads':
        return { items };
      case 'followDownloads':
        return (params as { itemIds: string[] }).itemIds.map((id) => {
          const item = items.find((i) => i.itemId === id)!;
          return { itemId: id, state: item.state, progress: item.progress };
        });
      case 'changeDownloads': {
        const { action, itemIds } = params as CliControlMethods['changeDownloads']['params'];
        return itemIds.map((id) => {
          const item = items.find((i) => i.itemId === id)!;
          if (action === 'cancel' && item.state === 'queued') return { itemId: id, changed: true, state: 'removed' };
          if (action === 'cancel' && item.state === 'downloading') return { itemId: id, changed: true, state: 'error' };
          if (action === 'retry' && item.state === 'error') return { itemId: id, changed: true, state: 'queued' };
          return { itemId: id, changed: false, state: item.state };
        });
      }
      case 'clearDownloads':
        return { removed: items.filter((i) => i.state === 'completed' || i.state === 'error').length };
      default:
        throw new Error(method);
    }
  };

  const ctx = {
    configService: {
      getConfig: () => ({ outputDirectory: OUT, accounts: [] }),
      getAuthToken: () => (signedIn ? 'token' : ''),
    },
    apiClient: {},
    renderer: {
      request: async (method: keyof CliControlMethods, params: never) => answer(method, params),
      seedDownload: (update: CliDownloadUpdate) => latest.set(update.itemId, update),
      watchDownload: (itemId: string, onUpdate: (update: CliDownloadUpdate) => void) => {
        listeners.set(itemId, onUpdate);
        const current = latest.get(itemId);
        if (current) onUpdate(current);
        return () => listeners.delete(itemId);
      },
      onReset: () => () => {},
    },
    term: {
      info: (text: string) => output.info.push(text),
      status: () => {},
      endStatusLine: () => {},
      out: (text: string) => output.out.push(text),
    },
    signal: abort.signal,
  } as unknown as AppCommandContext;

  const emit = (update: CliDownloadUpdate): void => listeners.get(update.itemId)?.(update);
  return { ctx, calls, output, emit, abort, listeners };
}

const input = (positionals: string[], options: Record<string, string | true> = {}): CommandInput => ({
  program: 'autoslides',
  positionals,
  options,
  json: true,
});

const serve = (positionals: string[], app: ReturnType<typeof fakeApp>, options: Record<string, string | true> = {}) =>
  appDownloadsCommand.serve(input(positionals, options), app.ctx);

describe('autoslides downloads', () => {
  const queue = (): CliQueueItem[] => [
    row({ itemId: 'a', state: 'completed', progress: 100, completedAt: Date.UTC(2026, 9, 1) }),
    row({ itemId: 'b', state: 'downloading', progress: 40, kind: 'camera', name: 'camera_课程-第1讲' }),
    row({ itemId: 'c', state: 'error', error: 'Cancelled by user', sessionId: '850102', sessionTitle: '第2讲' }),
    row({ itemId: 'd', state: 'error', error: 'HTTP 403', sessionId: '850103', kind: 'audio', name: 'audio_课程-第3讲' }),
  ];

  it('lists the panel with file paths and the app\'s words for each state', async () => {
    const app = fakeApp(queue());
    const { data } = await serve([], app);
    const items = (data as { items: Array<Record<string, unknown>> }).items;
    expect(items.map((i) => [i.item_id, i.status])).toEqual([
      ['a', 'completed'],
      ['b', 'downloading'],
      ['c', 'cancelled'],
      ['d', 'failed'],
    ]);
    expect(items[0].path).toBe(path.join(OUT, 'screen_课程-第1讲__c70101s850101.mp4'));
    expect(items[0].completed_at).toBe('2026-10-01T00:00:00.000Z');
    expect(items[1].path).toBe(path.join(OUT, 'camera_课程-第1讲__c70101s850101.mp4'));
    expect(items[3].path).toBe(path.join(OUT, 'audio_课程-第3讲__c70101s850103.aac'));
    expect(items[2].error).toBeUndefined();
    expect(items[3].error).toBe('HTTP 403');
  });

  it('lists one session when given its id or link', async () => {
    const app = fakeApp(queue());
    const { data } = await serve(['https://www.yanhekt.cn/session/850101'], app);
    expect((data as { items: Array<{ item_id: string }> }).items.map((i) => i.item_id)).toEqual(['a', 'b']);
    await expect(serve(['999'], app)).rejects.toMatchObject({ code: 'not_found' });
    await expect(serve(['stauts'], app)).rejects.toMatchObject({ code: 'usage' });
  });

  it('works while signed out, except retry, which downloads again', async () => {
    const app = fakeApp(queue(), false);
    expect(((await serve([], app)).data as { items: unknown[] }).items).toHaveLength(4);
    await expect(serve(['cancel', 'b'], app)).resolves.toBeDefined();
    await expect(serve(['retry', 'c'], app)).rejects.toBeInstanceOf(CliError);
    await expect(serve(['retry', 'c'], app)).rejects.toMatchObject({ code: 'sign_in_required' });
  });

  it('waits for what is unfinished and prints the finished file', async () => {
    const app = fakeApp(queue());
    const pending = serve(['wait'], app);
    for (let i = 0; i < 20 && !app.listeners.has('b'); i++) await Promise.resolve();
    app.emit({ itemId: 'b', state: 'downloading', progress: 80 });
    app.emit({ itemId: 'b', state: 'completed', progress: 100 });
    const result = await pending;
    expect(app.calls.find((c) => c.method === 'followDownloads')?.params).toEqual({ itemIds: ['b'] });
    expect(result.error).toBeUndefined();
    expect((result.data as { items: Array<{ status: string }> }).items.map((i) => i.status)).toEqual(['completed']);
    expect(app.output.out).toEqual([path.join(OUT, 'camera_课程-第1讲__c70101s850101.mp4')]);
  });

  it('fails the wait when a row it waited for fails', async () => {
    const app = fakeApp(queue());
    const pending = serve(['wait', 'b'], app);
    for (let i = 0; i < 20 && !app.listeners.has('b'); i++) await Promise.resolve();
    app.emit({ itemId: 'b', state: 'error', progress: 0, error: 'HTTP 500' });
    const result = await pending;
    expect(result.error?.code).toBe('failed');
    expect(result.error?.message).toContain('HTTP 500');
  });

  it('answers at once when nothing is downloading', async () => {
    const app = fakeApp([row({ itemId: 'a', state: 'completed', progress: 100 })]);
    const result = await serve(['wait'], app);
    expect(result.text).toBe('Nothing is downloading.');
    expect(app.calls.some((c) => c.method === 'followDownloads')).toBe(false);
  });

  it('cancels named rows and says which had already finished', async () => {
    const app = fakeApp(queue());
    const result = await serve(['cancel', '850101'], app);
    expect(app.calls.find((c) => c.method === 'changeDownloads')?.params).toEqual({ action: 'cancel', itemIds: ['a', 'b'] });
    const items = (result.data as { items: Array<{ item_id: string; status: string; changed: boolean }> }).items;
    expect(items.map((i) => [i.item_id, i.status, i.changed])).toEqual([
      ['a', 'completed', false],
      ['b', 'cancelled', true],
    ]);
    expect(result.text).toBe('Cancelled: 1 (1 had already finished).');
  });

  it('retries every failed or cancelled row with --all', async () => {
    const app = fakeApp(queue());
    const result = await serve(['retry'], app, { all: true });
    expect(app.calls.find((c) => c.method === 'changeDownloads')?.params).toEqual({ action: 'retry', itemIds: ['c', 'd'] });
    expect(result.text).toBe('Queued again: 2.');
  });

  it('refuses a cancel or retry that names nothing, and --all where it does not apply', async () => {
    const app = fakeApp(queue());
    await expect(serve(['cancel'], app)).rejects.toMatchObject({ code: 'usage' });
    await expect(serve(['retry', 'c'], app, { all: true })).rejects.toMatchObject({ code: 'usage' });
    await expect(serve(['wait'], app, { all: true })).rejects.toMatchObject({ code: 'usage' });
    await expect(serve(['clear', 'a'], app)).rejects.toMatchObject({ code: 'usage' });
    expect(app.calls).toEqual([]);
  });

  it('clears finished and failed rows', async () => {
    const result = await serve(['clear'], fakeApp(queue()));
    expect(result.data).toEqual({ removed: 3 });
  });
});
