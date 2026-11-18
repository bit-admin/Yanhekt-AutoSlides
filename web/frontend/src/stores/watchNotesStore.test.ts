import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type Result = { ok: true; data: unknown } | { ok: false; error: string };
const ok = (data: unknown = undefined): Result => ({ ok: true, data });

const server = vi.hoisted(() => ({
  calls: [] as string[],
  list: null as null | (() => Promise<unknown>),
  failUpload: false,
  failSave: false,
  saved: [] as string[],
}));

vi.mock('./configStore', () => ({
  configStore: { cloudWatchSyncEnabled: true, autoPostProcessingLive: false },
}));
vi.mock('./cloudStorageStore', () => ({
  cloudStorageStore: { canUse: { value: true }, userGroupId: { value: 5 }, ensureReady: async () => {} },
}));
vi.mock('./notesRefreshStore', () => ({ requestNotesRefresh: () => {} }));
vi.mock('../lib/slideStore', () => ({
  slideId: (folder: string, name: string) => `${folder}/${name}`,
  getSlideBlob: async () => ({ arrayBuffer: async () => new ArrayBuffer(1) }),
}));
vi.mock('../lib/postProcessing/runner', () => ({ onPassCompleted: () => {}, whenIdle: async () => {} }));
vi.mock('../lib/logger', () => ({ createLogger: () => ({ debug() {}, info() {}, warn() {}, error() {} }) }));
vi.mock('../lib/notes/notesClient', () => ({
  notesClient: {
    list: () => {
      server.calls.push('list');
      return server.list ? server.list() : Promise.resolve({ ok: true, data: { data: [], last_page: 1 } });
    },
    create: async () => (server.calls.push('create'), { ok: true, data: 900 }),
    updateTitle: async () => (server.calls.push('title'), { ok: true }),
    updateContent: async (_id: number, content: string) => {
      server.calls.push('content');
      if (server.failSave) return { ok: false, error: 'network' };
      server.saved.push(content);
      return { ok: true };
    },
    delete: async () => (server.calls.push('delete'), { ok: true }),
    uploadImage: async () => {
      server.calls.push('upload');
      return server.failUpload ? { ok: false, error: 'network' } : { ok: true, data: { url: 'https://img.example/1.png' } };
    },
  },
}));

import { watchNotesStore } from './watchNotesStore';

let n = 0;
const nextFolder = () => `slides_课程_第${(n += 1)}周__c70101s85010${n}`;

beforeEach(() => {
  vi.useFakeTimers();
  server.calls.length = 0;
  server.saved.length = 0;
  server.list = null;
  server.failUpload = false;
  server.failSave = false;
});
afterEach(() => vi.useRealTimers());

describe('web watch notes', () => {
  it('still appends a slide when the note takes longer than five seconds to create', async () => {
    const folder = nextFolder();
    let answer!: (value: Result) => void;
    server.list = () => new Promise((resolve) => (answer = resolve));
    const started = watchNotesStore.onExtractionStarted(folder, 'run-1');
    await vi.advanceTimersByTimeAsync(0);
    watchNotesStore.onSlideExtracted(folder, 'run-1', 'Slide_001.png');

    await vi.advanceTimersByTimeAsync(20_000);
    expect(server.calls).not.toContain('upload');
    answer(ok({ data: [], last_page: 1 }));
    await started;
    await vi.advanceTimersByTimeAsync(2_000);

    expect(server.calls).toContain('upload');
    const entry = watchNotesStore.entryFor(folder)!;
    expect(entry.status).toBe('ready');
    expect(JSON.parse(server.saved.at(-1)!).blocks.at(-1).type).toBe('image');
    expect(entry.unsaved).toBe(false);
    expect(entry.missedSlides).toBe(0);
  });

  it('counts a slide whose upload was refused', async () => {
    const folder = nextFolder();
    await watchNotesStore.onExtractionStarted(folder, 'run-1');
    server.failUpload = true;
    watchNotesStore.onSlideExtracted(folder, 'run-1', 'Slide_001.png');
    await vi.advanceTimersByTimeAsync(2_000);
    expect(watchNotesStore.entryFor(folder)!.missedSlides).toBe(1);
  });

  it('marks the note unsaved when a save is refused, and clears it on the next good save', async () => {
    const folder = nextFolder();
    await watchNotesStore.onExtractionStarted(folder, 'run-1');
    server.failSave = true;
    watchNotesStore.onSlideExtracted(folder, 'run-1', 'Slide_001.png');
    await vi.advanceTimersByTimeAsync(2_000);
    const entry = watchNotesStore.entryFor(folder)!;
    expect(entry.unsaved).toBe(true);

    server.failSave = false;
    watchNotesStore.onSlideExtracted(folder, 'run-1', 'Slide_002.png');
    await vi.advanceTimersByTimeAsync(2_000);
    expect(entry.unsaved).toBe(false);
    // The whole document went out: the slide of the refused save is in it.
    expect(JSON.parse(server.saved.at(-1)!).blocks.filter((b: { type: string }) => b.type === 'image')).toHaveLength(2);
  });

  it('does not upload when the note could not be opened', async () => {
    const folder = nextFolder();
    server.list = async () => ({ ok: false, error: 'network' });
    await watchNotesStore.onExtractionStarted(folder, 'run-1');
    watchNotesStore.onSlideExtracted(folder, 'run-1', 'Slide_001.png');
    await vi.advanceTimersByTimeAsync(2_000);
    expect(watchNotesStore.entryFor(folder)!.status).toBe('error');
    expect(server.calls).not.toContain('upload');
  });
});
