/**
 * Slide Timeline Service
 *
 * Single writer for per-folder `timeline.json` colocated inside each `slides_*`
 * folder (event log + resolution map). Pure mutations live in
 * `@common/sidecars/timeline`; this service only does serialized RMW IO.
 *
 * Capture writers: host builtin (video.currentTime) and AutoSlidesQt CLI
 * (--write-timeline, extractor qt). Missing file means "no timeline" —
 * consumers (and updaters other than first capture) degrade gracefully.
 *
 * Writes for a given folder are serialized through a per-path promise chain so
 * concurrent read-modify-write calls cannot clobber each other.
 */
import { promises as fs } from 'fs';
import path from 'path';
import { expandTilde } from '@main/infra/pathUtils';
import {
  SLIDE_TIMELINE_FILENAME,
  clearTimeline,
  createEmptyTimeline,
  ensureRecordedHostFields,
  gapReasonFromTrashReason,
  recordCaptureConfirmed,
  recordGapBoundary,
  relinkDuplicate,
  restoreCanonical,
  unlinkToGap,
  type GapReason,
  type RecordCaptureConfirmedPayload,
  type RecordGapBoundaryPayload,
  type RelinkDuplicatePayload,
  type RestoreCanonicalPayload,
  type SlideTimeline,
  type UnlinkToGapPayload,
} from '@common/sidecars';
import { createLogger } from '@main/infra/logger';

const log = createLogger('SlideTimeline');

export class SlideTimelineService {
  private writeChains = new Map<string, Promise<unknown>>();

  private timelinePath(folderPath: string): string {
    return path.join(path.resolve(expandTilde(folderPath)), SLIDE_TIMELINE_FILENAME);
  }

  /** Read and parse a folder's timeline, or null if absent/unreadable. */
  async read(folderPath: string): Promise<SlideTimeline | null> {
    const filePath = this.timelinePath(folderPath);
    try {
      const content = await fs.readFile(filePath, 'utf8');
      return JSON.parse(content) as SlideTimeline;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        log.warn(`Failed to read timeline at ${filePath}:`, error);
      }
      return null;
    }
  }

  /**
   * Serialize a read-modify-write against one folder. `mutate` receives the
   * current timeline (or null) and returns the next state, or null to skip the
   * write entirely.
   */
  private async mutate(
    folderPath: string,
    mutate: (current: SlideTimeline | null) => SlideTimeline | null
  ): Promise<void> {
    const filePath = this.timelinePath(folderPath);
    const prior = this.writeChains.get(filePath) ?? Promise.resolve();

    const next = prior.then(async () => {
      const current = await this.read(folderPath);
      const updated = mutate(current);
      if (!updated) return;
      try {
        await fs.mkdir(path.dirname(filePath), { recursive: true });
        await fs.writeFile(filePath, JSON.stringify(updated, null, 2), 'utf8');
      } catch (error) {
        log.error(`Failed to write timeline at ${filePath}:`, error);
      }
    });

    this.writeChains.set(filePath, next.catch(() => undefined));
    await next;
  }

  /** Append a confirmed capture. Creates timeline.json if absent. */
  async recordCaptureConfirmed(
    folderPath: string,
    payload: RecordCaptureConfirmedPayload
  ): Promise<void> {
    await this.mutate(folderPath, current => recordCaptureConfirmed(current, payload));
  }

  /** Append an explicit gap boundary. Creates timeline.json if absent. */
  async recordGapBoundary(folderPath: string, payload: RecordGapBoundaryPayload): Promise<void> {
    await this.mutate(folderPath, current => recordGapBoundary(current, payload));
  }

  /** Relink a duplicate capture to the first-kept target. No-op if no timeline. */
  async relinkDuplicate(folderPath: string, payload: RelinkDuplicatePayload): Promise<void> {
    await this.mutate(folderPath, current => {
      if (!current) return null;
      return relinkDuplicate(current, payload);
    });
  }

  /** Unlink a file's spans into explicit gaps. No-op if no timeline. */
  async unlinkToGap(folderPath: string, payload: UnlinkToGapPayload): Promise<void> {
    await this.mutate(folderPath, current => {
      if (!current) return null;
      return unlinkToGap(current, payload);
    });
  }

  /** Restore a file's capture events to canonical. No-op if no timeline. */
  async restoreCanonical(folderPath: string, payload: RestoreCanonicalPayload): Promise<void> {
    await this.mutate(folderPath, current => {
      if (!current) return null;
      return restoreCanonical(current, payload);
    });
  }

  /**
   * Convenience for trash moves: duplicates relink when `duplicateOf` is set;
   * other reasons become gaps. No-op if no timeline (or duplicate without target).
   */
  async applyTrashOutcome(
    folderPath: string,
    filename: string,
    reason: string,
    duplicateOf?: string
  ): Promise<void> {
    if (reason === 'duplicate') {
      if (!duplicateOf) return;
      await this.relinkDuplicate(folderPath, {
        duplicateFile: filename,
        targetFile: duplicateOf,
      });
      return;
    }
    const gapReason: GapReason = gapReasonFromTrashReason(reason);
    await this.unlinkToGap(folderPath, { file: filename, reason: gapReason });
  }

  /** Clear all events (re-extract / clear slides). Writes empty timeline if file existed or forceCreate. */
  async clear(folderPath: string, opts?: { createIfMissing?: boolean }): Promise<void> {
    await this.mutate(folderPath, current => {
      if (!current && !opts?.createIfMissing) return null;
      return clearTimeline(current ?? createEmptyTimeline());
    });
  }

  /**
   * After a successful Qt extract: stamp `kind: 'recorded'` on timeline.json
   * (Qt writes extractor:"qt" only). No-op if the file is absent. Preserves
   * events/resolutions so Electron post-processing can relink/unlink next.
   */
  async ensureRecordedHostFields(folderPath: string): Promise<void> {
    await this.mutate(folderPath, current => {
      if (!current) return null;
      const next = ensureRecordedHostFields(current);
      // Skip disk write when pure helper returned the same reference.
      return next === current ? null : next;
    });
  }
}

export const slideTimelineService = new SlideTimelineService();
