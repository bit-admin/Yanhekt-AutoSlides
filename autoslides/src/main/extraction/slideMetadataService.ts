/**
 * Slide Metadata Service
 *
 * Single writer for the per-folder `metadata.json` colocated inside each
 * recorded `slides_*` folder. Folder-level only (no per-slide records).
 *
 * Semantics:
 *  - `writeExtraction` upserts the file (creates it / refreshes source+extraction),
 *    preserving `createdAt` and any existing review/postProcessing state.
 *  - `updatePostProcessing` / `markReviewed` / `commitEdited` / `setCropped` are
 *    no-ops when the file is absent (a folder without metadata stays without it —
 *    no backfill). They only enrich an already-recorded folder.
 *  - `stageEdited` records a human mutation (crop/delete/restore) in memory only;
 *    `commitEdited` latches it to disk once the renderer confirms the user
 *    returned to the folder list, so metadata.json isn't rewritten on every
 *    single edit while they're still reviewing.
 *
 * Writes for a given folder are serialized through a per-path promise chain so
 * concurrent read-modify-write calls cannot clobber each other.
 */
import path from 'path';
import { expandTilde } from '@main/infra/pathUtils';
import {
  SLIDE_METADATA_VERSION,
  SLIDE_METADATA_FILENAME,
  type SlideMetadata,
  type SlideMetadataKind,
  type SlideMetadataSource,
  type SlideExtractionMeta,
  type SlidePostProcessingMeta,
  type SlideReviewMeta,
  type SlideDriveFile,
  type SlideShareRecord,
} from '@common/slideMetadataTypes';
import { SidecarFile, type SidecarRead, type SidecarWrite } from './slideExtraction/sidecarFile';
import { createLogger } from '@main/infra/logger';
const log = createLogger('SlideMetadata');

function emptyReview(): SlideReviewMeta {
  return { reviewed: false, reviewedAt: null, edited: false, editedAt: null, cropped: false };
}

/** `next`, with the stored registrar number kept when `next` has none and is the same course. */
function keepCourseNumber(next: SlideMetadataSource, stored: SlideMetadataSource | undefined): SlideMetadataSource {
  if (next.courseNumber || !stored?.courseNumber || !next.courseId || stored.courseId !== next.courseId) return next;
  return { ...next, courseNumber: stored.courseNumber };
}

/** `base` with `added` laid over it by id, oldest first. */
function mergeShares(base: SlideShareRecord[] | undefined, added: SlideShareRecord[]): SlideShareRecord[] {
  const byId = new Map<string, SlideShareRecord>();
  for (const share of [...(base ?? []), ...added]) byId.set(share.id, share);
  return [...byId.values()].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export class SlideMetadataService {
  // Per-folder write serialization, atomic replacement and damaged-file handling.
  private file = new SidecarFile<SlideMetadata>('metadata', log);

  // Human edits staged during a folder-review session, keyed by resolved
  // folder path, awaiting commitEdited(). In-memory only.
  private pendingEdits = new Map<string, { cropped?: boolean }>();

  // Share records of folders retired for a re-extraction, keyed by the
  // lecture id block (`__c…s…`), waiting for the new folder's first
  // `writeExtraction`. In memory only: lost if the app quits in between.
  private carriedShares = new Map<string, SlideShareRecord[]>();

  private metadataPath(folderPath: string): string {
    return path.join(path.resolve(expandTilde(folderPath)), SLIDE_METADATA_FILENAME);
  }

  private resolveFolderKey(folderPath: string): string {
    return path.resolve(expandTilde(folderPath));
  }

  /**
   * A folder's metadata, or null if absent, damaged or unreadable (use
   * `readState` to tell those apart). With `afterWrites`, waits for the writes
   * already queued for this folder first: a reader that runs right after an
   * extraction recorded its thresholds would otherwise see the file from
   * before that write and fall back to the settings.
   */
  async read(folderPath: string, opts?: { afterWrites?: boolean }): Promise<SlideMetadata | null> {
    const state = await this.readState(folderPath, opts);
    return state.state === 'ok' ? state.value : null;
  }

  /** As `read`, saying whether the file is missing, damaged or unreadable. */
  async readState(folderPath: string, opts?: { afterWrites?: boolean }): Promise<SidecarRead<SlideMetadata>> {
    const filePath = this.metadataPath(folderPath);
    if (opts?.afterWrites) await this.file.settled(filePath);
    return this.file.read(filePath);
  }

  /**
   * Serialize a read-modify-write against one folder. `mutate` receives the
   * current metadata (or null) and returns the next state, or null to skip the
   * write entirely (used by the no-op-if-absent updaters). Resolves to what
   * happened; it does not reject.
   */
  private mutate(
    folderPath: string,
    mutate: (current: SlideMetadata | null) => SlideMetadata | null
  ): Promise<SidecarWrite> {
    return this.file.mutate(this.metadataPath(folderPath), (current) => {
      const updated = mutate(current);
      if (updated) updated.updatedAt = new Date().toISOString();
      return updated;
    });
  }

  /**
   * Create or refresh the metadata file with extraction context. Preserves
   * `createdAt`, existing review state, and any recorded post-processing.
   * The writer passes the registrar number (`source.courseNumber`) when its
   * course carried one; a later write for the same course that lacks it keeps
   * the one already stored.
   */
  async writeExtraction(
    folderPath: string,
    data: { source: SlideMetadataSource; extraction: SlideExtractionMeta; kind?: SlideMetadataKind }
  ): Promise<SidecarWrite> {
    const now = new Date().toISOString();
    const carried = this.takeCarriedShares(folderPath);
    return this.mutate(folderPath, (current) => {
      const shares = mergeShares(current?.shares, carried);
      return {
        version: SLIDE_METADATA_VERSION,
        kind: data.kind ?? 'recorded',
        source: keepCourseNumber(data.source, current?.source),
        extraction: data.extraction,
        postProcessing: current?.postProcessing,
        review: current?.review ?? emptyReview(),
        // Upload records stay: each is checked against its file before use.
        ...(current?.drive ? { drive: current.drive } : {}),
        ...(shares.length > 0 ? { shares } : {}),
        createdAt: current?.createdAt ?? now,
        updatedAt: now,
      };
    });
  }

  /**
   * Keep these share records for the folder a re-extraction of the same
   * lecture creates next (matched by the id block `suffix`, e.g. `__c1s2`).
   */
  carryShares(suffix: string, shares: SlideShareRecord[]): void {
    if (!suffix || shares.length === 0) return;
    this.carriedShares.set(suffix, mergeShares(this.carriedShares.get(suffix), shares));
  }

  private takeCarriedShares(folderPath: string): SlideShareRecord[] {
    const name = path.basename(this.resolveFolderKey(folderPath));
    for (const [suffix, shares] of this.carriedShares) {
      if (name.endsWith(suffix)) {
        this.carriedShares.delete(suffix);
        return shares;
      }
    }
    return [];
  }

  /** Merge upload records, by file name. No-op if the folder has no metadata. */
  async recordDriveUploads(folderPath: string, files: Record<string, SlideDriveFile>): Promise<SidecarWrite> {
    return this.mutate(folderPath, (current) => {
      if (!current || Object.keys(files).length === 0) return null;
      return { ...current, version: SLIDE_METADATA_VERSION, drive: { files: { ...current.drive?.files, ...files } } };
    });
  }

  /**
   * Mark uploaded slides as moved to the trash (`removed`) or back. Slides
   * without an upload record are left alone; no-op without metadata.
   */
  async markDriveRemoved(folderPath: string, filenames: string[], removed: boolean): Promise<SidecarWrite> {
    return this.mutate(folderPath, (current) => {
      const records = current?.drive?.files;
      if (!current || !records) return null;
      const now = new Date().toISOString();
      const next = { ...records };
      let changed = false;
      for (const name of filenames) {
        const record = next[name];
        if (!record) continue;
        if (removed && !record.removedAt) {
          next[name] = { ...record, removedAt: now };
          changed = true;
        } else if (!removed && record.removedAt) {
          const { removedAt: _removed, ...rest } = record;
          next[name] = rest;
          changed = true;
        }
      }
      return changed ? { ...current, drive: { files: next } } : null;
    });
  }

  /** Add a share record, or replace the one with its id. No-op without metadata. */
  async saveShare(folderPath: string, share: SlideShareRecord): Promise<SidecarWrite> {
    return this.mutate(folderPath, (current) => {
      if (!current) return null;
      return { ...current, version: SLIDE_METADATA_VERSION, shares: mergeShares(current.shares, [share]) };
    });
  }

  /** Take a share record off the folder (the link itself keeps working). */
  async removeShare(folderPath: string, id: string): Promise<SidecarWrite> {
    return this.mutate(folderPath, (current) => {
      if (!current?.shares?.some((share) => share.id === id)) return null;
      const shares = current.shares.filter((share) => share.id !== id);
      const { shares: _old, ...rest } = current;
      return shares.length > 0 ? { ...rest, shares } : rest;
    });
  }

  /**
   * Write a full metadata object wholesale (used to restore `metadata.json` when
   * a managed cloud note is exported back into a local `slides_*` folder).
   * Preserves the snapshot's `createdAt`; `updatedAt` is refreshed by `mutate`.
   */
  async write(folderPath: string, metadata: SlideMetadata): Promise<SidecarWrite> {
    return this.mutate(folderPath, () => ({
      ...metadata,
      createdAt: metadata.createdAt ?? new Date().toISOString(),
    }));
  }

  /** Merge the post-processing block. No-op if the folder has no metadata. */
  async updatePostProcessing(folderPath: string, pp: SlidePostProcessingMeta): Promise<SidecarWrite> {
    return this.mutate(folderPath, (current) => {
      if (!current) return null;
      return { ...current, postProcessing: pp };
    });
  }

  /** Mark the folder reviewed (implicit, on dwell). No-op if no metadata. */
  async markReviewed(folderPath: string): Promise<SidecarWrite> {
    return this.mutate(folderPath, (current) => {
      if (!current) return null;
      if (current.review.reviewed) return null; // already reviewed — avoid churn
      return {
        ...current,
        review: { ...current.review, reviewed: true, reviewedAt: new Date().toISOString() },
      };
    });
  }

  /**
   * Stage a human mutation (crop/delete/restore) for a folder, to be latched
   * to disk later via commitEdited. Synchronous, in-memory only — cheap to
   * call on every edit during a review session.
   */
  stageEdited(folderPath: string, opts?: { cropped?: boolean }): void {
    const key = this.resolveFolderKey(folderPath);
    const staged = this.pendingEdits.get(key) ?? {};
    if (opts && typeof opts.cropped === 'boolean') {
      staged.cropped = opts.cropped;
    }
    this.pendingEdits.set(key, staged);
  }

  /**
   * Latch the `edited` flag (and any staged `cropped` state) to disk for a
   * folder with a pending stage. No-op if nothing was staged or the folder
   * has no metadata. Returns the applied state, or null if nothing changed.
   */
  async commitEdited(folderPath: string): Promise<{ cropped?: boolean } | null> {
    const key = this.resolveFolderKey(folderPath);
    const staged = this.pendingEdits.get(key);
    if (!staged) return null;
    this.pendingEdits.delete(key);

    let applied: { cropped?: boolean } | null = null;
    const outcome = await this.mutate(folderPath, (current) => {
      if (!current) return null;
      const review = { ...current.review };
      if (!review.edited) {
        review.edited = true;
        review.editedAt = new Date().toISOString();
      }
      if (typeof staged.cropped === 'boolean') {
        review.cropped = staged.cropped;
      }
      applied = staged;
      return { ...current, review };
    });
    if (outcome === 'failed' || outcome === 'blocked') {
      // Not on disk: keep the edit staged (under anything staged meanwhile) so
      // the next commit carries it.
      this.pendingEdits.set(key, { ...staged, ...this.pendingEdits.get(key) });
      return null;
    }
    return applied;
  }

  /** Set the current `cropped` state without touching the edited latch. */
  async setCropped(folderPath: string, cropped: boolean): Promise<SidecarWrite> {
    return this.mutate(folderPath, (current) => {
      if (!current) return null;
      if (current.review.cropped === cropped) return null;
      return { ...current, review: { ...current.review, cropped } };
    });
  }
}

export const slideMetadataService = new SlideMetadataService();
