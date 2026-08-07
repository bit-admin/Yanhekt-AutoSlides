// Renderer-side helper for writing per-folder slide timelines. Lives in
// shared/services so processing + postProcessing may import it. All calls are
// best-effort — timeline recording must never break extraction or review flows.
//
// v1: recorded + builtin only. Callers gate before invoking (live/Qt skip).
import { createLogger } from '@shared/utils/logger';
import type {
  GapReason,
  RecordCaptureConfirmedPayload,
  RecordGapBoundaryPayload,
  RelinkDuplicatePayload,
  RestoreCanonicalPayload,
  SlideTimeline,
  UnlinkToGapPayload,
} from '@common/sidecars';

const log = createLogger('SlideTimelineClient');

function plain<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export async function getTimeline(folderPath: string): Promise<SlideTimeline | null> {
  try {
    return await window.electronAPI.slideTimeline.get(folderPath);
  } catch (error) {
    log.warn('Failed to read timeline:', error);
    return null;
  }
}

export async function recordCaptureConfirmed(
  folderPath: string,
  payload: RecordCaptureConfirmedPayload
): Promise<void> {
  try {
    await window.electronAPI.slideTimeline.recordCaptureConfirmed(folderPath, plain(payload));
  } catch (error) {
    log.warn('Failed to record capture confirmed:', error);
  }
}

export async function recordGapBoundary(
  folderPath: string,
  payload: RecordGapBoundaryPayload
): Promise<void> {
  try {
    await window.electronAPI.slideTimeline.recordGapBoundary(folderPath, plain(payload));
  } catch (error) {
    log.warn('Failed to record gap boundary:', error);
  }
}

export async function relinkDuplicate(
  folderPath: string,
  payload: RelinkDuplicatePayload
): Promise<void> {
  try {
    await window.electronAPI.slideTimeline.relinkDuplicate(folderPath, plain(payload));
  } catch (error) {
    log.warn('Failed to relink duplicate:', error);
  }
}

export async function unlinkToGap(folderPath: string, payload: UnlinkToGapPayload): Promise<void> {
  try {
    await window.electronAPI.slideTimeline.unlinkToGap(folderPath, plain(payload));
  } catch (error) {
    log.warn('Failed to unlink to gap:', error);
  }
}

export async function restoreCanonical(
  folderPath: string,
  payload: RestoreCanonicalPayload
): Promise<void> {
  try {
    await window.electronAPI.slideTimeline.restoreCanonical(folderPath, plain(payload));
  } catch (error) {
    log.warn('Failed to restore canonical:', error);
  }
}

export async function clearTimeline(folderPath: string): Promise<void> {
  try {
    await window.electronAPI.slideTimeline.clear(folderPath);
  } catch (error) {
    log.warn('Failed to clear timeline:', error);
  }
}

/** Map post-process / trash reason to GapReason for unlink helpers. */
export function gapReasonForTrash(reason: string): GapReason {
  switch (reason) {
    case 'exclusion':
      return 'exclusion';
    case 'ai_filtered':
    case 'ai_filtered_edit':
      return 'ai_filtered';
    case 'manual':
      return 'manual_trash';
    default:
      return 'manual_trash';
  }
}
