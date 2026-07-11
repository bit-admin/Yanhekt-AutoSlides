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
import { promises as fs } from 'fs';
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
import { createLogger } from '@main/infra/logger';
const log = createLogger('SlideMetadata');

function emptyReview(): SlideReviewMeta {
  return { reviewed: false, reviewedAt: null, edited: false, editedAt: null, cropped: false };
}

export class SlideMetadataService {
  // Per-folder write serialization. Keyed by the resolved metadata file path.
  private writeChains = new Map<string, Promise<unknown>>();

  // Human edits staged during a folder-review session, keyed by resolved
  // folder path, awaiting commitEdited(). In-memory only.
  private pendingEdits = new Map<string, { cropped?: boolean }>();

  private metadataPath(folderPath: string): string {
    return path.join(path.resolve(expandTilde(folderPath)), SLIDE_METADATA_FILENAME);
  }

  private resolveFolderKey(folderPath: string): string {
    return path.resolve(expandTilde(folderPath));
  }

  /** Read and parse a folder's metadata, or null if absent/unreadable. */
  async read(folderPath: string): Promise<SlideMetadata | null> {
    const filePath = this.metadataPath(folderPath);
    try {
      const content = await fs.readFile(filePath, 'utf8');
      return JSON.parse(content) as SlideMetadata;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        log.warn(`Failed to read metadata at ${filePath}:`, error);
      }
      return null;
    }
  }

  /**
   * Serialize a read-modify-write against one folder. `mutate` receives the
   * current metadata (or null) and returns the next state, or null to skip the
   * write entirely (used by the no-op-if-absent updaters).
   */
  private async mutate(
    folderPath: string,
    mutate: (current: SlideMetadata | null) => SlideMetadata | null
  ): Promise<void> {
    const filePath = this.metadataPath(folderPath);
    const prior = this.writeChains.get(filePath) ?? Promise.resolve();

    const next = prior.then(async () => {
      const current = await this.read(folderPath);
      const updated = mutate(current);
      if (!updated) return;
      updated.updatedAt = new Date().toISOString();
      try {
        await fs.mkdir(path.dirname(filePath), { recursive: true });
        await fs.writeFile(filePath, JSON.stringify(updated, null, 2), 'utf8');
      } catch (error) {
        log.error(`Failed to write metadata at ${filePath}:`, error);
      }
    });

    // Keep the chain alive but don't let a rejection wedge future writes.
    this.writeChains.set(filePath, next.catch(() => undefined));
    await next;
  }

  /**
   * Create or refresh the metadata file with extraction context. Preserves
   * `createdAt`, existing review state, and any recorded post-processing.
   */
  async writeExtraction(
    folderPath: string,
    data: { source: SlideMetadataSource; extraction: SlideExtractionMeta; kind?: SlideMetadataKind }
  ): Promise<void> {
    const now = new Date().toISOString();
    await this.mutate(folderPath, (current) => ({
      version: SLIDE_METADATA_VERSION,
      kind: data.kind ?? 'recorded',
      source: data.source,
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
  async write(folderPath: string, metadata: SlideMetadata): Promise<void> {
    await this.mutate(folderPath, () => ({
      ...metadata,
      createdAt: metadata.createdAt ?? new Date().toISOString(),
    }));
  }

  /** Merge the post-processing block. No-op if the folder has no metadata. */
  async updatePostProcessing(folderPath: string, pp: SlidePostProcessingMeta): Promise<void> {
    await this.mutate(folderPath, (current) => {
      if (!current) return null;
      return { ...current, postProcessing: pp };
    });
  }

  /** Mark the folder reviewed (implicit, on dwell). No-op if no metadata. */
  async markReviewed(folderPath: string): Promise<void> {
    await this.mutate(folderPath, (current) => {
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
    await this.mutate(folderPath, (current) => {
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
    return applied;
  }

  /** Set the current `cropped` state without touching the edited latch. */
  async setCropped(folderPath: string, cropped: boolean): Promise<void> {
    await this.mutate(folderPath, (current) => {
      if (!current) return null;
      if (current.review.cropped === cropped) return null;
      return { ...current, review: { ...current.review, cropped } };
    });
  }
}

export const slideMetadataService = new SlideMetadataService();
