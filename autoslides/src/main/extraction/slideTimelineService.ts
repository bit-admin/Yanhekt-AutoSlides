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
import { SidecarFile, type SidecarRead, type SidecarWrite } from './slideExtraction/sidecarFile';
import { createLogger } from '@main/infra/logger';

const log = createLogger('SlideTimeline');

export class SlideTimelineService {
  // Per-folder write serialization, atomic replacement and damaged-file handling.
  private file = new SidecarFile<SlideTimeline>('timeline', log);

  private timelinePath(folderPath: string): string {
    return path.join(path.resolve(expandTilde(folderPath)), SLIDE_TIMELINE_FILENAME);
  }

  /**
   * A folder's timeline, or null if absent, damaged or unreadable (use
   * `readState` to tell those apart). With `afterWrites`, waits for the writes
   * already queued for this folder first.
   */
  async read(folderPath: string, opts?: { afterWrites?: boolean }): Promise<SlideTimeline | null> {
    const state = await this.readState(folderPath, opts);
    return state.state === 'ok' ? state.value : null;
  }

  /** As `read`, saying whether the file is missing, damaged or unreadable. */
  async readState(folderPath: string, opts?: { afterWrites?: boolean }): Promise<SidecarRead<SlideTimeline>> {
    const filePath = this.timelinePath(folderPath);
    if (opts?.afterWrites) await this.file.settled(filePath);
    return this.file.read(filePath);
  }

  /**
   * Serialize a read-modify-write against one folder. `mutate` receives the
   * current timeline (or null) and returns the next state, or null to skip the
   * write entirely. Resolves to what happened; it does not reject.
   */
  private mutate(
    folderPath: string,
    mutate: (current: SlideTimeline | null) => SlideTimeline | null
  ): Promise<SidecarWrite> {
    return this.file.mutate(this.timelinePath(folderPath), mutate);
  }

  /** Replace a folder's timeline.json (export reconstitution). */
  async write(folderPath: string, timeline: SlideTimeline): Promise<SidecarWrite> {
    return this.mutate(folderPath, () => timeline);
  }

  /** Append a confirmed capture. Creates timeline.json if absent. */
  async recordCaptureConfirmed(
    folderPath: string,
    payload: RecordCaptureConfirmedPayload
  ): Promise<SidecarWrite> {
    return this.mutate(folderPath, current => recordCaptureConfirmed(current, payload));
  }

  /** Append an explicit gap boundary. Creates timeline.json if absent. */
  async recordGapBoundary(folderPath: string, payload: RecordGapBoundaryPayload): Promise<SidecarWrite> {
    return this.mutate(folderPath, current => recordGapBoundary(current, payload));
  }

  /** Relink a duplicate capture to the first-kept target. No-op if no timeline. */
  async relinkDuplicate(folderPath: string, payload: RelinkDuplicatePayload): Promise<SidecarWrite> {
    return this.mutate(folderPath, current => {
      if (!current) return null;
      return relinkDuplicate(current, payload);
    });
  }

  /** Unlink a file's spans into explicit gaps. No-op if no timeline. */
  async unlinkToGap(folderPath: string, payload: UnlinkToGapPayload): Promise<SidecarWrite> {
    return this.mutate(folderPath, current => {
      if (!current) return null;
      return unlinkToGap(current, payload);
    });
  }

  /** Restore a file's capture events to canonical. No-op if no timeline. */
  async restoreCanonical(folderPath: string, payload: RestoreCanonicalPayload): Promise<SidecarWrite> {
    return this.mutate(folderPath, current => {
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
  ): Promise<SidecarWrite> {
    if (reason === 'duplicate') {
      if (!duplicateOf) return 'unchanged';
      return this.relinkDuplicate(folderPath, {
        duplicateFile: filename,
        targetFile: duplicateOf,
      });
    }
    const gapReason: GapReason = gapReasonFromTrashReason(reason);
    return this.unlinkToGap(folderPath, { file: filename, reason: gapReason });
  }

  /** Clear all events (re-extract / clear slides). Writes empty timeline if file existed or forceCreate. */
  async clear(folderPath: string, opts?: { createIfMissing?: boolean }): Promise<SidecarWrite> {
    return this.mutate(folderPath, current => {
      if (!current && !opts?.createIfMissing) return null;
      return clearTimeline(current ?? createEmptyTimeline());
    });
  }

  /**
   * After a successful Qt extract: stamp `kind: 'recorded'` on timeline.json
   * (Qt writes extractor:"qt" only). No-op if the file is absent. Preserves
   * events/resolutions so Electron post-processing can relink/unlink next.
   */
  async ensureRecordedHostFields(folderPath: string): Promise<SidecarWrite> {
    return this.mutate(folderPath, current => {
      if (!current) return null;
      const next = ensureRecordedHostFields(current);
      // Skip disk write when pure helper returned the same reference.
      return next === current ? null : next;
    });
  }
}

export const slideTimelineService = new SlideTimelineService();
