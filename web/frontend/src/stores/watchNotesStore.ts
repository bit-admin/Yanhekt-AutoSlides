import { reactive, ref } from 'vue';
import type { OutputData } from '@editorjs/editorjs';
import { configStore } from './configStore';
import { cloudStorageStore } from './cloudStorageStore';
import { notesClient } from '../lib/notes/notesClient';
import { buildManagedNoteTitle, EDITORJS_DOC_VERSION } from '../lib/notes/notesTypes';
import { formatToolFolderName } from '../lib/toolFolders';
import { slideId, getSlideBlob } from '../lib/slideStore';
import { onPassCompleted, whenIdle } from '../lib/postProcessing/runner';
import { requestNotesRefresh } from './notesRefreshStore';
import { createLogger } from '../lib/logger';

const log = createLogger('WatchNotes');

/** Page size / cap mirroring useCloudNotes' full-set paging. */
const FETCH_PAGE_SIZE = 500;
const MAX_FETCH_PAGES = 20;
const SAVE_DEBOUNCE_MS = 1000;

type EntryStatus = 'creating' | 'ready' | 'error';

export interface WatchNoteEntry {
  /** Extraction folder this note mirrors (one extraction at a time on the web). */
  folder: string;
  /** Extraction pipeline instance whose slides feed this note. */
  instanceId: string;
  noteId: number | null;
  displayName: string;
  status: EntryStatus;
  /** Working copy of the note's Editor.js document (source of truth when no live editor). */
  content: OutputData;
}

/**
 * Live editor bound to a folder's note, registered by WatchNotesPanel. When
 * present, slide appends for that folder go through it (so an in-progress user
 * edit isn't clobbered by an external content overwrite); otherwise appends
 * mutate the stored content + debounced API save.
 */
interface ActiveEditorBinding {
  folder: string;
  /** Insert an image block at the end of the live editor. */
  insertImage: (url: string) => void;
}

// Ported from the desktop watchNotesStore
// (autoslides/src/renderer/features/cloudNotes/watchNotesStore.ts), adapted to
// the web: entries are keyed by extraction folder instead of playback tab (the
// web has exactly one extraction at a time — playback routes unmount on
// navigation), the extraction pipeline calls the exported functions directly
// (adapter callbacks, no window CustomEvents), and pass results arrive via the
// post-processing runner's onPassCompleted subscription.
const state = reactive<{ entries: Record<string, WatchNoteEntry> }>({ entries: {} });
let activeEditor: ActiveEditorBinding | null = null;
const saveTimers = new Map<string, ReturnType<typeof setTimeout>>();

// Slides captured while watch-mode auto post-processing is on are held here
// (per folder, insertion order = capture order) until a completed pass reports
// them kept; trashed ones never reach the note. Only filenames are buffered —
// the bytes are read from IndexedDB at upload time (kept slides are guaranteed
// present there; the gallery's object URLs are revocable and can't be held).
const pendingSlides = new Map<string, Set<string>>();
// Per-folder promise chain serializing note appends so overlapping pass events
// can't interleave image blocks out of order.
const flushChains = new Map<string, Promise<void>>();

/** Bumped when extraction starts so the playback sidebar switches to Notes. */
export const notesTabRequest = ref(0);

function getPending(folder: string): Set<string> {
  let pending = pendingSlides.get(folder);
  if (!pending) {
    pending = new Set();
    pendingSlides.set(folder, pending);
  }
  return pending;
}

function chainFlush(folder: string, task: () => Promise<void>): void {
  const prev = flushChains.get(folder) ?? Promise.resolve();
  flushChains.set(
    folder,
    prev.then(task).catch((err) => log.warn('watch note flush failed', err)),
  );
}

function emptyDoc(): OutputData {
  return { time: Date.now(), blocks: [], version: EDITORJS_DOC_VERSION } as OutputData;
}

function imageBlock(url: string) {
  return {
    type: 'image',
    data: { file: { url }, caption: '', withBorder: false, stretched: false, withBackground: false },
  };
}

/** Whether the watch-notes auto flow may run right now (storage provisioned). */
export function watchSyncActive(): boolean {
  return (
    !!configStore.cloudWatchSyncEnabled &&
    cloudStorageStore.canUse.value &&
    cloudStorageStore.userGroupId.value != null
  );
}

/** Find an existing ASuser watch note by title, else create one. */
async function findOrCreateNote(
  displayName: string,
): Promise<{ id: number; content: OutputData; created: boolean } | null> {
  const groupId = cloudStorageStore.userGroupId.value;
  if (groupId == null) return null;
  const title = buildManagedNoteTitle(displayName);

  // Scan the full note list for an existing managed note with this title in ASuser.
  let page = 1;
  let lastPage = 1;
  let existingId: number | null = null;
  do {
    const res = await notesClient.list({ page, pageSize: FETCH_PAGE_SIZE });
    if (!res.ok) {
      log.warn('note list failed while resolving watch note', res.error);
      return null;
    }
    const hit = res.data.data.find(
      (n) => n.title === title && Number(n.note_group_id) === Number(groupId),
    );
    if (hit) {
      existingId = hit.id;
      break;
    }
    lastPage = Math.max(1, res.data.last_page);
    page += 1;
  } while (page <= lastPage && page <= MAX_FETCH_PAGES);

  if (existingId != null) {
    const detail = await notesClient.get(existingId);
    if (!detail.ok) return null;
    let content = emptyDoc();
    try {
      const parsed = JSON.parse(detail.data.content);
      if (parsed && Array.isArray(parsed.blocks)) content = parsed as OutputData;
    } catch {
      /* malformed — start blank */
    }
    return { id: existingId, content, created: false };
  }

  // Create a fresh note in the ASuser group, titled + seeded with a heading.
  const created = await notesClient.create();
  if (!created.ok) {
    log.warn('failed to create watch note', created.error);
    return null;
  }
  const id = created.data;
  const titleRes = await notesClient.updateTitle(id, title, groupId);
  if (!titleRes.ok) log.warn('failed to title watch note', titleRes.error);
  const content: OutputData = {
    time: Date.now(),
    blocks: [{ type: 'header', data: { text: displayName, level: 2 } }],
    version: EDITORJS_DOC_VERSION,
  } as OutputData;
  await notesClient.updateContent(id, JSON.stringify(content));
  return { id, content, created: true };
}

/** Debounced persist of an entry's working content (no-live-editor path). */
function scheduleSave(entry: WatchNoteEntry): void {
  const existing = saveTimers.get(entry.folder);
  if (existing) clearTimeout(existing);
  saveTimers.set(
    entry.folder,
    setTimeout(() => {
      saveTimers.delete(entry.folder);
      if (entry.noteId == null) return;
      void notesClient
        .updateContent(entry.noteId, JSON.stringify(entry.content))
        .catch((err) => log.warn('watch note save failed', err));
    }, SAVE_DEBOUNCE_MS),
  );
}

/** Drop another folder's leftover entry/timers/buffers (new extraction begins). */
function pruneOtherFolders(folder: string): void {
  for (const key of Object.keys(state.entries)) {
    if (key === folder) continue;
    const timer = saveTimers.get(key);
    if (timer) clearTimeout(timer);
    saveTimers.delete(key);
    pendingSlides.delete(key);
    flushChains.delete(key);
    delete state.entries[key];
  }
}

/**
 * Called by useSlideExtraction the moment slide extraction actually starts.
 * Provisions the ASuser group if needed, creates (or reuses) the folder's
 * note, and asks the playback sidebar to reveal the Notes view. No-op unless
 * watch-sync is enabled.
 */
export async function onExtractionStarted(folder: string, instanceId: string): Promise<void> {
  if (!configStore.cloudWatchSyncEnabled) return;

  pruneOtherFolders(folder);

  const existing = state.entries[folder];
  if (existing) {
    // New extraction run into the same folder: stale un-cleared slides from the
    // previous run will never get a pass event — drop them.
    if (existing.instanceId !== instanceId) pendingSlides.delete(folder);
    existing.instanceId = instanceId;
    notesTabRequest.value += 1;
    return;
  }

  const displayName = formatToolFolderName(folder) || folder;
  state.entries[folder] = {
    folder,
    instanceId,
    noteId: null,
    displayName,
    status: 'creating',
    content: emptyDoc(),
  };
  // Mutate through the reactive proxy, not a raw local — writes to the raw
  // target bypass the proxy's set trap and the panel never sees 'ready'.
  const stored = state.entries[folder];

  // Reveal the Notes view immediately; the note fills in when creation resolves.
  notesTabRequest.value += 1;

  // Lazy provisioning: the watch-sync toggle is the intent, the group is
  // created on first use (and self-heals if deleted server-side).
  await cloudStorageStore.ensureUserGroup();
  if (!watchSyncActive()) {
    stored.status = 'error';
    return;
  }

  const result = await findOrCreateNote(displayName);
  if (!result) {
    stored.status = 'error';
    return;
  }
  stored.noteId = result.id;
  stored.content = result.content;
  stored.status = 'ready';
  // Surface the new note on the Notes page (which uses a separate useCloudNotes
  // instance) on its next activation.
  if (result.created) requestNotesRefresh();
}

/** Wait out note creation so we don't append into content that findOrCreate will replace. */
async function waitUntilReady(entry: WatchNoteEntry): Promise<boolean> {
  // Poll briefly; creation is a few network round-trips. Read status each loop
  // so TS doesn't narrow the union away across the await.
  for (let i = 0; i < 100; i += 1) {
    const status = entry.status;
    if (status === 'ready') return true;
    if (status === 'error') return false;
    await new Promise((r) => setTimeout(r, 50));
  }
  return entry.status === 'ready';
}

/** Upload a slide's stored bytes and append it to the entry's note. */
async function appendSlide(entry: WatchNoteEntry, pngFilename: string): Promise<void> {
  if (!(await waitUntilReady(entry))) return;

  let url: string;
  try {
    const blob = await getSlideBlob(slideId(entry.folder, pngFilename));
    if (!blob) {
      log.warn('watch slide missing from store', pngFilename);
      return;
    }
    const up = await notesClient.uploadImage(await blob.arrayBuffer(), pngFilename, 'image/png');
    if (!up.ok) {
      log.warn('watch slide upload failed', up.error);
      return;
    }
    url = up.data.url;
  } catch (err) {
    log.warn('watch slide upload threw', err);
    return;
  }

  // Live editor bound to this folder: insert through it so user edits aren't lost.
  if (activeEditor && activeEditor.folder === entry.folder) {
    activeEditor.insertImage(url);
    return;
  }
  // No live editor: mutate the working copy + debounced API save.
  entry.content.blocks.push(imageBlock(url));
  if (entry.noteId != null) scheduleSave(entry);
}

/** Called per captured slide (already persisted to IndexedDB by the pipeline). */
export function onSlideExtracted(folder: string, instanceId: string, pngFilename: string): void {
  const entry = state.entries[folder];
  if (!entry || entry.instanceId !== instanceId || entry.status === 'error') return;
  // With watch-mode auto post-processing on, hold the upload until a completed
  // pass clears this slide (same `!== false` default-true predicate as the
  // extraction trigger gate). Toggle off ⇒ immediate upload.
  if (configStore.autoPostProcessingLive !== false) {
    getPending(folder).add(pngFilename);
    return;
  }
  chainFlush(folder, () => appendSlide(entry, pngFilename));
}

/** Release buffered slides a completed post-processing pass kept; drop trashed ones. */
onPassCompleted((folder, { kept, removed }) => {
  const entry = state.entries[folder];
  if (!entry) return;
  const pending = pendingSlides.get(folder);
  if (!pending || pending.size === 0) return;

  for (const filename of removed) pending.delete(filename);
  // `kept` arrives in extraction order; take only slides still awaiting clearance.
  const cleared = kept.filter((filename) => pending.delete(filename));
  if (cleared.length === 0) return;
  chainFlush(folder, async () => {
    for (const pngFilename of cleared) {
      await appendSlide(entry, pngFilename);
    }
  });
});

/** A cleared gallery means those captures are gone — nothing left to release. */
export function onSlidesCleared(folder: string): void {
  pendingSlides.delete(folder);
}

/**
 * Called when extraction stops. Waits for any in-flight pass (whose completion
 * still releases its kept slides), then drops the remainder — slides without a
 * completed pass behind them are never uploaded. Detached on purpose: the
 * playback page may unmount (navigation) before the pass finishes.
 */
export function onExtractionStopped(folder: string): void {
  void whenIdle(folder).then(() => {
    const pending = pendingSlides.get(folder);
    if (pending && pending.size > 0) {
      log.debug(`dropping ${pending.size} un-cleared slide(s) for stopped folder ${folder}`);
    }
    pendingSlides.delete(folder);
  });
}

// ── Panel-facing API ────────────────────────────────────────────────────────

/** The note entry for a playback page's extraction folder (drives the panel view). */
export function entryFor(folder: string | null): WatchNoteEntry | null {
  return folder ? (state.entries[folder] ?? null) : null;
}

/** WatchNotesPanel registers its live editor for its folder. */
export function registerActiveEditor(binding: ActiveEditorBinding): void {
  activeEditor = binding;
}

export function unregisterActiveEditor(folder: string): void {
  if (activeEditor?.folder === folder) activeEditor = null;
}

/** Sync an entry's working content back from the live editor (called on flush/leave). */
export function commitEditorContent(folder: string, content: OutputData): void {
  const entry = state.entries[folder];
  if (!entry) return;
  entry.content = content;
  if (entry.noteId != null) {
    const existing = saveTimers.get(folder);
    if (existing) clearTimeout(existing);
    saveTimers.delete(folder);
    void notesClient
      .updateContent(entry.noteId, JSON.stringify(content))
      .catch((err) => log.warn('watch note flush failed', err));
  }
}

export const watchNotesStore = {
  onExtractionStarted,
  onSlideExtracted,
  onSlidesCleared,
  onExtractionStopped,
  entryFor,
  notesTabRequest,
  registerActiveEditor,
  unregisterActiveEditor,
  commitEditorContent,
  watchSyncActive,
};
