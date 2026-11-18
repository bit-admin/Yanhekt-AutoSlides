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

export class SlideMetadataService {
  // Per-folder write serialization, atomic replacement and damaged-file handling.
  private file = new SidecarFile<SlideMetadata>('metadata', log);

  // Human edits staged during a folder-review session, keyed by resolved
  // folder path, awaiting commitEdited(). In-memory only.
  private pendingEdits = new Map<string, { cropped?: boolean }>();

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
    return this.mutate(folderPath, (current) => ({
      version: SLIDE_METADATA_VERSION,
      kind: data.kind ?? 'recorded',
      source: keepCourseNumber(data.source, current?.source),
      extraction: data.extraction,
      postProcessing: current?.postProcessing,
      review: current?.review ?? emptyReview(),
      createdAt: current?.createdAt ?? now,
      updatedAt: now,
    }));
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
