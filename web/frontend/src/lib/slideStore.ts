// IndexedDB-backed slide storage — the web replacement for the Electron app's
// output-directory file system (slides_* folders, .autoslidesTrash manifest,
// per-folder metadata.json). Record shapes mirror the desktop manifests
// verbatim (TrashEntry ≙ RemovedEntry, SlideMetadata v1) so the ported
// Results View and post-processing code consume them unchanged.
//
// Model: slide bytes never move. Trashing flips the record's status flag and
// adds a TrashEntry; restore flips it back and deletes the entry; clearing
// trash deletes both. `originalPath`/`trashPath` carry the slide record id
// (`${folder}/${filename}`) — a virtual path, kept so the desktop shapes and
// UI wiring stay intact.
//
// Pixel payload is an ArrayBuffer (field still named `blob` for call-site
// continuity). WebKit detaches Blob values when a record is re-put with
// `{ ...record, status/aiDecision }` — later arrayBuffer()/blob: URL loads
// throw NotFoundError / WebKitBlobResource error 1. ArrayBuffers survive
// re-put; getSlideBlob rebuilds a short-lived Blob on every read. No Blob
// migration path: the web app has not shipped, so only ArrayBuffer is stored.

import { openDatabase, requestToPromise, transactionDone } from './idb';
import { cropImageBuffer, type CropRect } from './imageCrop';
import type { SlideMetadata, SlideMetadataKind, SlideMetadataSource, SlidePostProcessingMeta } from './slideMetadataTypes';
import { SLIDE_METADATA_VERSION } from './slideMetadataTypes';
import { createLogger } from './logger';

const log = createLogger('SlideStore');

// Canonical trash-reason union for the web app (desktop keeps this in
// @common/types). Post-processing writes the first four; 'manual' is the
// Slides-page delete action.
export type TrashReason = 'duplicate' | 'exclusion' | 'ai_filtered' | 'ai_filtered_edit' | 'manual';

export type { CropRect };

export interface SlideRecord {
  id: string; // `${folder}/${filename}`
  folder: string;
  filename: string;
  /** PNG bytes (ArrayBuffer — never a Blob; see file header). */
  blob: ArrayBuffer;
  /**
   * Uncropped original PNG bytes. Set on the first crop; subsequent recrops
   * always cut from this backup (mirrors desktop `.autoslidesCrop/`).
   */
  originalBlob?: ArrayBuffer;
  status: 'active' | 'trashed';
  createdAt: string;
  // Persisted AI-filtering verdict. Presence (any value) means the file is
  // skipped by later phase-3 passes — so a slide restored from AI trash is
  // never re-trashed by a re-run. Cleared implicitly when the record is
  // overwritten by a fresh extraction (new pixels need a new verdict).
  aiDecision?: 'slide' | 'not_slide' | 'may_be_slide_edit';
  isCropped?: boolean;
  isAutoCropped?: boolean;
  cropRect?: CropRect;
  croppedAt?: string;
}

/** List shape for active slides — includes crop fields for the Results UI. */
export interface ActiveImageInfo {
  name: string;
  path: string;
  aiDecision?: SlideRecord['aiDecision'];
  isCropped?: boolean;
  isAutoCropped?: boolean;
  cropRect?: CropRect;
  croppedAt?: string;
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
    // Store PNG bytes as ArrayBuffer, not Blob. See file header for why.
    const bytes = await blob.arrayBuffer();
    if (bytes.byteLength === 0) {
      log.error(`Refusing to save empty slide ${folder}/${filename}`);
      return false;
    }

    const db = await getDb();
    const now = new Date().toISOString();
    const tx = db.transaction([SLIDES, TRASH, FOLDERS], 'readwrite');
    const id = slideId(folder, filename);
    tx.objectStore(SLIDES).put({
      id,
      folder,
      filename,
      blob: bytes,
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
  const bytes = record?.blob;
  if (!bytes || bytes.byteLength === 0) return null;
  return new Blob([bytes], { type: 'image/png' });
}

/** Active slide filenames in a folder (unsorted; callers sort). */
export async function listActiveImages(folder: string): Promise<ActiveImageInfo[]> {
  const db = await getDb();
  const records = (await requestToPromise(
    db
      .transaction(SLIDES)
      .objectStore(SLIDES)
      .index('by-folder-status')
      .getAll(IDBKeyRange.only([folder, 'active'])),
  )) as SlideRecord[];
  return records.map((r) => ({
    name: r.filename,
    path: r.id,
    aiDecision: r.aiDecision,
    isCropped: r.isCropped || undefined,
    isAutoCropped: r.isAutoCropped || undefined,
    cropRect: r.cropRect,
    croppedAt: r.croppedAt,
  }));
}

/**
 * Bytes used as the crop-editor source: original backup when already cropped,
 * otherwise the active blob. Returns a short-lived Blob (never stored).
 */
export async function getSlideCropSourceBlob(id: string): Promise<Blob | null> {
  const db = await getDb();
  const record = (await requestToPromise(
    db.transaction(SLIDES).objectStore(SLIDES).get(id),
  )) as SlideRecord | undefined;
  if (!record) return null;
  const bytes =
    record.isCropped && record.originalBlob && record.originalBlob.byteLength > 0
      ? record.originalBlob
      : record.blob;
  if (!bytes || bytes.byteLength === 0) return null;
  return new Blob([bytes], { type: 'image/png' });
}

/**
 * Apply a crop to an active slide. Backs up the uncropped original on first
 * crop; always cuts from that backup so recrop is relative to the original.
 */
export async function applyCropToSlide(
  id: string,
  rect: CropRect,
  autoCropped = false,
): Promise<boolean> {
  try {
    const db = await getDb();
    const readTx = db.transaction(SLIDES, 'readonly');
    const existing = (await requestToPromise(
      readTx.objectStore(SLIDES).get(id),
    )) as SlideRecord | undefined;
    if (!existing || existing.status !== 'active') {
      log.warn(`applyCropToSlide: missing or inactive slide ${id}`);
      return false;
    }

    const source =
      existing.originalBlob && existing.originalBlob.byteLength > 0
        ? existing.originalBlob
        : existing.blob;
    if (!source || source.byteLength === 0) {
      log.error(`applyCropToSlide: empty source for ${id}`);
      return false;
    }

    const croppedBytes = await cropImageBuffer(source, rect);
    if (croppedBytes.byteLength === 0) {
      log.error(`applyCropToSlide: crop produced empty buffer for ${id}`);
      return false;
    }

    const now = new Date().toISOString();
    const writeTx = db.transaction([SLIDES, FOLDERS], 'readwrite');
    const slides = writeTx.objectStore(SLIDES);
    // Re-read inside the write tx in case of concurrent mutators.
    const current = (await requestToPromise(slides.get(id))) as SlideRecord | undefined;
    if (!current || current.status !== 'active') {
      await transactionDone(writeTx);
      return false;
    }

    const originalBlob =
      current.originalBlob && current.originalBlob.byteLength > 0
        ? current.originalBlob
        : current.blob;

    slides.put({
      ...current,
      originalBlob,
      blob: croppedBytes,
      isCropped: true,
      isAutoCropped: autoCropped,
      cropRect: {
        x: Math.round(rect.x),
        y: Math.round(rect.y),
        width: Math.round(rect.width),
        height: Math.round(rect.height),
      },
      croppedAt: now,
    } satisfies SlideRecord);

    // Folder review.cropped = true (and stage edited latch fields if metadata exists).
    const folders = writeTx.objectStore(FOLDERS);
    const folderRec = (await requestToPromise(folders.get(current.folder))) as
      | FolderRecord
      | undefined;
    if (folderRec?.metadata?.review) {
      folderRec.metadata.review.cropped = true;
      folderRec.updatedAt = now;
      folderRec.metadata.updatedAt = now;
      folders.put(folderRec);
    }

    await transactionDone(writeTx);
    return true;
  } catch (error) {
    log.error(`Failed to apply crop to ${id}:`, error);
    return false;
  }
}

/** Restore a slide's active blob from its originalBlob backup. */
export async function restoreCropFromSlide(id: string): Promise<boolean> {
  try {
    const db = await getDb();
    const tx = db.transaction([SLIDES, FOLDERS], 'readwrite');
    const slides = tx.objectStore(SLIDES);
    const record = (await requestToPromise(slides.get(id))) as SlideRecord | undefined;
    if (!record || !record.isCropped || !record.originalBlob || record.originalBlob.byteLength === 0) {
      await transactionDone(tx);
      return false;
    }

    const folder = record.folder;
    // Rebuild without crop fields so structured clone does not keep stale keys.
    const restored: SlideRecord = {
      id: record.id,
      folder: record.folder,
      filename: record.filename,
      blob: record.originalBlob,
      status: record.status,
      createdAt: record.createdAt,
    };
    if (record.aiDecision) restored.aiDecision = record.aiDecision;
    slides.put(restored);

    await transactionDone(tx);

    // Recompute folder.review.cropped from remaining active slides.
    await recomputeFolderCroppedFlag(folder);
    return true;
  } catch (error) {
    log.error(`Failed to restore crop for ${id}:`, error);
    return false;
  }
}

/** True if any active slide in the folder is currently cropped. */
async function recomputeFolderCroppedFlag(folder: string): Promise<void> {
  try {
    const db = await getDb();
    const records = (await requestToPromise(
      db
        .transaction(SLIDES)
        .objectStore(SLIDES)
        .index('by-folder-status')
        .getAll(IDBKeyRange.only([folder, 'active'])),
    )) as SlideRecord[];
    const anyCropped = records.some((r) => !!r.isCropped);

    await updateFolderRecord(folder, (record) => {
      if (record.metadata?.review) {
        record.metadata.review.cropped = anyCropped;
      }
    });
  } catch (error) {
    log.warn(`Failed to recompute cropped flag for ${folder}:`, error);
  }
}

/**
 * Active-slide source buffer for dimension checks (baseline out-of-bounds).
 * Prefer original backup when present.
 */
export async function getSlideSourceBuffer(id: string): Promise<ArrayBuffer | null> {
  const db = await getDb();
  const record = (await requestToPromise(
    db.transaction(SLIDES).objectStore(SLIDES).get(id),
  )) as SlideRecord | undefined;
  if (!record) return null;
  const bytes =
    record.originalBlob && record.originalBlob.byteLength > 0
      ? record.originalBlob
      : record.blob;
  if (!bytes || bytes.byteLength === 0) return null;
  return bytes;
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
      // ArrayBuffer re-put is safe on WebKit (unlike Blob); structured clone
      // copies the bytes. Only IDB requests are awaited inside this tx.
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

/**
 * Read-modify-write a folder row. By default this is a no-op when the folder
 * is absent — matching desktop slideMetadataService (markReviewed / commitEdited
 * / setPostProcessing never create metadata.json). Without that guard, a
 * post-delete `markFolderReviewed` from review-dwell (fired via refresh→goBack)
 * would resurrect an empty album in the sidebar.
 *
 * Pass `createIfMissing: true` only for writers that own folder creation
 * (watch extraction). Slide pixels still create the row via saveSlideBlob.
 */
async function updateFolderRecord(
  folder: string,
  mutate: (record: FolderRecord) => void,
  options?: { createIfMissing?: boolean },
): Promise<void> {
  const db = await getDb();
  const now = new Date().toISOString();
  const tx = db.transaction(FOLDERS, 'readwrite');
  const store = tx.objectStore(FOLDERS);
  const existing = (await requestToPromise(store.get(folder))) as FolderRecord | undefined;
  if (!existing && !options?.createIfMissing) {
    await transactionDone(tx);
    return;
  }
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
    liveId?: unknown;
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
 *
 * Deep-clones via JSON before the IndexedDB put: callers build `source` from
 * reactive `course.value`/`session.value`, and structured clone throws
 * DataCloneError on a Vue Proxy (same family as Electron's IPC hop in
 * slideMetadataClient.recordRecordedExtraction — professors/classrooms arrays
 * are the usual culprits). All fields are JSON-safe.
 */
export async function recordWatchExtraction(params: WatchExtractionRecord): Promise<void> {
  const source: SlideMetadataSource = {
    courseId: normalizeString(params.source.courseId),
    liveId: normalizeString(params.source.liveId),
    courseTitle: params.source.courseTitle,
    sessionId: normalizeString(params.source.sessionId),
    sessionTitle: params.source.sessionTitle,
    instructor: params.source.instructor,
    // Spread arrays so we never hand a reactive Proxy to IndexedDB even if the
    // JSON round-trip below is later removed or partial.
    professors: params.source.professors ? [...params.source.professors] : undefined,
    semester: normalizeString(params.source.semester),
    schoolYear: normalizeString(params.source.schoolYear),
    college: params.source.college,
    classrooms: params.source.classrooms ? [...params.source.classrooms] : undefined,
    weekNumber: normalizeNumber(params.source.weekNumber),
    day: normalizeNumber(params.source.day),
  };
  const now = new Date().toISOString();
  await updateFolderRecord(
    params.folder,
    (record) => {
      // Build, then strip any residual Proxies (and drop undefined keys) before
      // assigning onto the record that store.put will structured-clone.
      const metadata: SlideMetadata = {
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
      record.metadata = JSON.parse(JSON.stringify(metadata)) as SlideMetadata;
    },
    // Extraction owns the folder row when metadata is written before the first
    // pixel lands (or after a wipe); other mutators stay no-op-if-absent.
    { createIfMissing: true },
  );
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
