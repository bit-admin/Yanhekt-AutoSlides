// IndexedDB-backed slide storage — the web replacement for the Electron app's
// output-directory file system (slides_* folders, .autoslidesTrash manifest,
// per-folder metadata.json). Record shapes mirror the desktop manifests
// verbatim (TrashEntry ≙ RemovedEntry, SlideMetadata v1) so the ported
// Results View and post-processing code consume them unchanged.
//
// Model: slide blobs never move. Trashing flips the record's status flag and
// adds a TrashEntry; restore flips it back and deletes the entry; clearing
// trash deletes both. `originalPath`/`trashPath` carry the slide record id
// (`${folder}/${filename}`) — a virtual path, kept so the desktop shapes and
// UI wiring stay intact.

import { openDatabase, requestToPromise, transactionDone } from './idb';
import type { SlideMetadata, SlideMetadataKind, SlideMetadataSource, SlidePostProcessingMeta } from './slideMetadataTypes';
import { SLIDE_METADATA_VERSION } from './slideMetadataTypes';
import { createLogger } from './logger';

const log = createLogger('SlideStore');

// Canonical trash-reason union for the web app (desktop keeps this in
// @common/types). Post-processing writes the first four; 'manual' is the
// Slides-page delete action.
export type TrashReason = 'duplicate' | 'exclusion' | 'ai_filtered' | 'ai_filtered_edit' | 'manual';

export interface SlideRecord {
  id: string; // `${folder}/${filename}`
  folder: string;
  filename: string;
  blob: Blob; // image/png
  status: 'active' | 'trashed';
  createdAt: string;
  // Persisted AI-filtering verdict. Presence (any value) means the file is
  // skipped by later phase-3 passes — so a slide restored from AI trash is
  // never re-trashed by a re-run. Cleared implicitly when the record is
  // overwritten by a fresh extraction (new pixels need a new verdict).
  aiDecision?: 'slide' | 'not_slide' | 'may_be_slide_edit';
}

// Mirrors the desktop trash-manifest entry (RemovedEntry) verbatim.
export interface TrashEntry {
  id: string;
  filename: string;
  originalPath: string;
  originalParentFolder: string;
  trashPath: string;
  reason: TrashReason;
  reasonDetails?: string;
  trashedAt: string;
}

export interface FolderRecord {
  name: string;
  metadata: SlideMetadata | null;
  createdAt: string;
  updatedAt: string;
}

const DB_NAME = 'autoslides-web';
const DB_VERSION = 1;
const SLIDES = 'slides';
const TRASH = 'trash';
const FOLDERS = 'folders';

let dbPromise: Promise<IDBDatabase> | null = null;

function getDb(): Promise<IDBDatabase> {
  if (!dbPromise) {
    dbPromise = openDatabase(DB_NAME, DB_VERSION, (db) => {
      const slides = db.createObjectStore(SLIDES, { keyPath: 'id' });
      slides.createIndex('by-folder', 'folder');
      slides.createIndex('by-folder-status', ['folder', 'status']);
      const trash = db.createObjectStore(TRASH, { keyPath: 'id' });
      trash.createIndex('by-folder', 'originalParentFolder');
      trash.createIndex('by-trashPath', 'trashPath');
      db.createObjectStore(FOLDERS, { keyPath: 'name' });
    });
    dbPromise.catch(() => {
      dbPromise = null;
    });
  }
  return dbPromise;
}

export function slideId(folder: string, filename: string): string {
  return `${folder}/${filename}`;
}

// --- Slide sink (replaces slideExtraction.saveSlide IPC) ---

let persistRequested = false;

export async function saveSlideBlob(folder: string, filename: string, blob: Blob): Promise<boolean> {
  if (!persistRequested) {
    persistRequested = true;
    // Best-effort: ask the browser not to evict our origin data under pressure.
    navigator.storage?.persist?.().catch(() => {});
  }
  try {
    const db = await getDb();
    const now = new Date().toISOString();
    const tx = db.transaction([SLIDES, TRASH, FOLDERS], 'readwrite');
    const id = slideId(folder, filename);
    tx.objectStore(SLIDES).put({
      id,
      folder,
      filename,
      blob,
      status: 'active',
      createdAt: now,
    } satisfies SlideRecord);
    // A same-id write over a trashed slide would leave its trash entry
    // dangling; drop any such entries (parity with desktop's "entry whose
    // trashPath no longer exists" filtering, enforced at write time instead).
    const staleEntries = await requestToPromise(
      tx.objectStore(TRASH).index('by-trashPath').getAllKeys(id),
    );
    for (const key of staleEntries) {
      tx.objectStore(TRASH).delete(key);
    }
    const existingFolder = (await requestToPromise(
      tx.objectStore(FOLDERS).get(folder),
    )) as FolderRecord | undefined;
    if (!existingFolder) {
      tx.objectStore(FOLDERS).put({
        name: folder,
        metadata: null,
        createdAt: now,
        updatedAt: now,
      } satisfies FolderRecord);
    }
    await transactionDone(tx);
    return true;
  } catch (error) {
    log.error(`Failed to save slide ${folder}/${filename}:`, error);
    return false;
  }
}

// --- Reads ---

export async function getSlideBlob(id: string): Promise<Blob | null> {
  const db = await getDb();
  const record = (await requestToPromise(
    db.transaction(SLIDES).objectStore(SLIDES).get(id),
  )) as SlideRecord | undefined;
  return record?.blob ?? null;
}

/** Active slide filenames in a folder (unsorted; callers sort). */
export async function listActiveImages(
  folder: string,
): Promise<Array<{ name: string; path: string; aiDecision?: SlideRecord['aiDecision'] }>> {
  const db = await getDb();
  const records = (await requestToPromise(
    db
      .transaction(SLIDES)
      .objectStore(SLIDES)
      .index('by-folder-status')
      .getAll(IDBKeyRange.only([folder, 'active'])),
  )) as SlideRecord[];
  return records.map((r) => ({ name: r.filename, path: r.id, aiDecision: r.aiDecision }));
}

/** Record an AI-filtering verdict on a slide (no-op if the record is gone). */
export async function setSlideAIDecision(
  folder: string,
  filename: string,
  decision: NonNullable<SlideRecord['aiDecision']>,
): Promise<void> {
  try {
    const db = await getDb();
    const tx = db.transaction(SLIDES, 'readwrite');
    const store = tx.objectStore(SLIDES);
    const record = (await requestToPromise(store.get(slideId(folder, filename)))) as
      | SlideRecord
      | undefined;
    if (record) {
      store.put({ ...record, aiDecision: decision });
    }
    await transactionDone(tx);
  } catch (error) {
    log.error(`Failed to record AI decision for ${folder}/${filename}:`, error);
  }
}

/** All folders with their active-slide counts (ResultsDataIO.getFolders shape; path = folder name). */
export async function listFolders(): Promise<Array<{ name: string; path: string; imageCount: number }>> {
  const db = await getDb();
  const tx = db.transaction([FOLDERS, SLIDES]);
  const folders = (await requestToPromise(tx.objectStore(FOLDERS).getAll())) as FolderRecord[];
  const index = tx.objectStore(SLIDES).index('by-folder-status');
  const counts = await Promise.all(
    folders.map((f) => requestToPromise(index.count(IDBKeyRange.only([f.name, 'active'])))),
  );
  return folders.map((f, i) => ({ name: f.name, path: f.name, imageCount: counts[i] }));
}

export async function getTrashEntries(): Promise<TrashEntry[]> {
  const db = await getDb();
  return (await requestToPromise(
    db.transaction(TRASH).objectStore(TRASH).getAll(),
  )) as TrashEntry[];
}

export async function getFolderMetadata(folder: string): Promise<SlideMetadata | null> {
  const db = await getDb();
  const record = (await requestToPromise(
    db.transaction(FOLDERS).objectStore(FOLDERS).get(folder),
  )) as FolderRecord | undefined;
  return record?.metadata ?? null;
}

// --- Trash mutations ---

/** Flip an active slide to trashed and record a TrashEntry. */
export async function moveToTrash(
  folder: string,
  filename: string,
  reason: TrashReason,
  reasonDetails: string,
): Promise<boolean> {
  try {
    const db = await getDb();
    const tx = db.transaction([SLIDES, TRASH], 'readwrite');
    const id = slideId(folder, filename);
    const slides = tx.objectStore(SLIDES);
    const record = (await requestToPromise(slides.get(id))) as SlideRecord | undefined;
    if (!record || record.status !== 'active') {
      tx.abort();
      return false;
    }
    slides.put({ ...record, status: 'trashed' });
    tx.objectStore(TRASH).put({
      id: crypto.randomUUID(),
      filename,
      originalPath: id,
      originalParentFolder: folder,
      trashPath: id,
      reason,
      reasonDetails,
      trashedAt: new Date().toISOString(),
    } satisfies TrashEntry);
    await transactionDone(tx);
    return true;
  } catch (error) {
    log.error(`Failed to trash ${folder}/${filename}:`, error);
    return false;
  }
}

export async function restoreTrashEntries(ids: string[]): Promise<{ restored: number; failed: number }> {
  const db = await getDb();
  const tx = db.transaction([SLIDES, TRASH], 'readwrite');
  const trash = tx.objectStore(TRASH);
  const slides = tx.objectStore(SLIDES);
  let restored = 0;
  let failed = 0;
  for (const id of ids) {
    const entry = (await requestToPromise(trash.get(id))) as TrashEntry | undefined;
    if (!entry) {
      failed += 1;
      continue;
    }
    const record = (await requestToPromise(slides.get(entry.trashPath))) as SlideRecord | undefined;
    if (record) {
      slides.put({ ...record, status: 'active' });
      restored += 1;
    } else {
      failed += 1;
    }
    trash.delete(id);
  }
  await transactionDone(tx);
  return { restored, failed };
}

/** Permanently delete trashed slides. Omit `ids` to clear all trash. */
export async function clearTrash(ids?: string[]): Promise<void> {
  const db = await getDb();
  const tx = db.transaction([SLIDES, TRASH], 'readwrite');
  const trash = tx.objectStore(TRASH);
  const slides = tx.objectStore(SLIDES);
  const entries = (
    ids
      ? await Promise.all(ids.map((id) => requestToPromise(trash.get(id))))
      : await requestToPromise(trash.getAll())
  ) as Array<TrashEntry | undefined>;
  for (const entry of entries) {
    if (!entry) continue;
    const record = (await requestToPromise(slides.get(entry.trashPath))) as SlideRecord | undefined;
    if (record && record.status === 'trashed') {
      slides.delete(entry.trashPath);
    }
    trash.delete(entry.id);
  }
  await transactionDone(tx);
}

/** Move active slides (by record id) to trash with reason 'manual'. */
export async function deleteImages(slideIds: string[]): Promise<{ deleted: number; failed: number }> {
  let deleted = 0;
  let failed = 0;
  for (const id of slideIds) {
    const separator = id.indexOf('/');
    if (separator <= 0) {
      failed += 1;
      continue;
    }
    const ok = await moveToTrash(id.slice(0, separator), id.slice(separator + 1), 'manual', 'Manually removed');
    if (ok) deleted += 1;
    else failed += 1;
  }
  return { deleted, failed };
}

/** Delete folders wholesale: folder record, all slides, all trash entries. */
export async function removeFolders(names: string[]): Promise<void> {
  const db = await getDb();
  const tx = db.transaction([SLIDES, TRASH, FOLDERS], 'readwrite');
  const slides = tx.objectStore(SLIDES);
  const trash = tx.objectStore(TRASH);
  for (const name of names) {
    const slideKeys = await requestToPromise(slides.index('by-folder').getAllKeys(name));
    for (const key of slideKeys) slides.delete(key);
    const trashKeys = await requestToPromise(trash.index('by-folder').getAllKeys(name));
    for (const key of trashKeys) trash.delete(key);
    tx.objectStore(FOLDERS).delete(name);
  }
  await transactionDone(tx);
}

// --- Folder metadata (replaces the slideMetadata IPC namespace) ---

async function updateFolderRecord(
  folder: string,
  mutate: (record: FolderRecord) => void,
): Promise<void> {
  const db = await getDb();
  const now = new Date().toISOString();
  const tx = db.transaction(FOLDERS, 'readwrite');
  const store = tx.objectStore(FOLDERS);
  const existing = (await requestToPromise(store.get(folder))) as FolderRecord | undefined;
  const record: FolderRecord = existing ?? {
    name: folder,
    metadata: null,
    createdAt: now,
    updatedAt: now,
  };
  mutate(record);
  record.updatedAt = now;
  if (record.metadata) record.metadata.updatedAt = now;
  store.put(record);
  await transactionDone(tx);
}

function normalizeString(value: unknown): string | undefined {
  if (value === null || value === undefined || value === '') return undefined;
  return String(value);
}

function normalizeNumber(value: unknown): number | undefined {
  if (value === null || value === undefined || value === '') return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

export interface WatchExtractionRecord {
  folder: string;
  kind: SlideMetadataKind;
  ssimThreshold?: number;
  source: {
    courseId?: unknown;
    courseTitle?: string;
    sessionId?: unknown;
    sessionTitle?: string;
    instructor?: string;
    professors?: string[];
    semester?: unknown;
    schoolYear?: unknown;
    college?: string;
    classrooms?: string[];
    weekNumber?: unknown;
    day?: unknown;
  };
}

/**
 * Write extraction metadata for a watch-mode run (the only kind on the web).
 * Field normalization matches desktop slideMetadataClient: ids/semester/
 * schoolYear → strings, weekNumber/day → numbers.
 */
export async function recordWatchExtraction(params: WatchExtractionRecord): Promise<void> {
  const source: SlideMetadataSource = {
    courseId: normalizeString(params.source.courseId),
    courseTitle: params.source.courseTitle,
    sessionId: normalizeString(params.source.sessionId),
    sessionTitle: params.source.sessionTitle,
    instructor: params.source.instructor,
    professors: params.source.professors,
    semester: normalizeString(params.source.semester),
    schoolYear: normalizeString(params.source.schoolYear),
    college: params.source.college,
    classrooms: params.source.classrooms,
    weekNumber: normalizeNumber(params.source.weekNumber),
    day: normalizeNumber(params.source.day),
  };
  const now = new Date().toISOString();
  await updateFolderRecord(params.folder, (record) => {
    record.metadata = {
      version: SLIDE_METADATA_VERSION,
      kind: params.kind,
      source,
      extraction: {
        extractor: 'builtin',
        ssimThreshold: params.ssimThreshold,
        extractedAt: now,
        trigger: 'watch',
      },
      // A re-extraction into an existing folder keeps prior review state.
      review: record.metadata?.review ?? {
        reviewed: false,
        reviewedAt: null,
        edited: false,
        editedAt: null,
        cropped: false,
      },
      postProcessing: record.metadata?.postProcessing,
      createdAt: record.metadata?.createdAt ?? now,
      updatedAt: now,
    };
  });
}

export async function setFolderPostProcessing(folder: string, meta: SlidePostProcessingMeta): Promise<void> {
  await updateFolderRecord(folder, (record) => {
    if (record.metadata) record.metadata.postProcessing = meta;
  });
}

export async function markFolderReviewed(folder: string): Promise<void> {
  await updateFolderRecord(folder, (record) => {
    if (record.metadata && !record.metadata.review.reviewed) {
      record.metadata.review.reviewed = true;
      record.metadata.review.reviewedAt = new Date().toISOString();
    }
  });
}

export async function commitFolderEdited(folder: string): Promise<void> {
  await updateFolderRecord(folder, (record) => {
    if (record.metadata && !record.metadata.review.edited) {
      record.metadata.review.edited = true;
      record.metadata.review.editedAt = new Date().toISOString();
    }
  });
}

// --- Storage usage ---

export async function estimateStorageUsage(): Promise<{ usage: number; quota: number } | null> {
  try {
    const estimate = await navigator.storage?.estimate?.();
    if (!estimate) return null;
    return { usage: estimate.usage ?? 0, quota: estimate.quota ?? 0 };
  } catch {
    return null;
  }
}
