/**
 * Slide Metadata Service
 *
 * Single writer for the per-folder `metadata.json` colocated inside each
 * recorded `slides_*` folder. Folder-level only (no per-slide records).
 *
 * Semantics:
 *  - `writeExtraction` upserts the file (creates it / refreshes source+extraction),
 *    preserving `createdAt` and any existing review/postProcessing state.
 *  - `updatePostProcessing` / `markReviewed` / `markEdited` / `setCropped` are
 *    no-ops when the file is absent (a folder without metadata stays without it —
 *    no backfill). They only enrich an already-recorded folder.
 *
 * Writes for a given folder are serialized through a per-path promise chain so
 * concurrent read-modify-write calls cannot clobber each other.
 */
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import {
  SLIDE_METADATA_VERSION,
  SLIDE_METADATA_FILENAME,
  type SlideMetadata,
  type SlideMetadataSource,
  type SlideExtractionMeta,
  type SlidePostProcessingMeta,
  type SlideReviewMeta,
} from '@common/slideMetadataTypes';
import { createLogger } from '@main/infra/logger';
const log = createLogger('SlideMetadata');

function expandHome(targetPath: string): string {
  return targetPath.startsWith('~') ? path.join(os.homedir(), targetPath.slice(1)) : targetPath;
}

function emptyReview(): SlideReviewMeta {
  return { reviewed: false, reviewedAt: null, edited: false, editedAt: null, cropped: false };
}

export class SlideMetadataService {
  // Per-folder write serialization. Keyed by the resolved metadata file path.
  private writeChains = new Map<string, Promise<unknown>>();

  private metadataPath(folderPath: string): string {
    return path.join(path.resolve(expandHome(folderPath)), SLIDE_METADATA_FILENAME);
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
    data: { source: SlideMetadataSource; extraction: SlideExtractionMeta }
  ): Promise<void> {
    const now = new Date().toISOString();
    await this.mutate(folderPath, (current) => ({
      version: SLIDE_METADATA_VERSION,
      kind: 'recorded',
      source: data.source,
      extraction: data.extraction,
      postProcessing: current?.postProcessing,
      review: current?.review ?? emptyReview(),
      createdAt: current?.createdAt ?? now,
      updatedAt: now,
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
   * Latch the `edited` flag for a human mutation during review, and optionally
   * set the current `cropped` state. No-op if the folder has no metadata.
   */
  async markEdited(folderPath: string, opts?: { cropped?: boolean }): Promise<void> {
    await this.mutate(folderPath, (current) => {
      if (!current) return null;
      const review = { ...current.review };
      if (!review.edited) {
        review.edited = true;
        review.editedAt = new Date().toISOString();
      }
      if (opts && typeof opts.cropped === 'boolean') {
        review.cropped = opts.cropped;
      }
      return { ...current, review };
    });
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
