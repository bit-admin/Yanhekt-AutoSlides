import type {
  GapReason,
  RecordCaptureConfirmedPayload,
  RecordGapBoundaryPayload,
  RelinkDuplicatePayload,
  RestoreCanonicalPayload,
  SlideCaptureEvent,
  SlideResolution,
  SlideTimeline,
  UnlinkToGapPayload,
} from './types';
import { SLIDE_TIMELINE_VERSION } from './types';

function nowIso(): string {
  return new Date().toISOString();
}

function newEventId(): string {
  return `evt_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function touch(timeline: SlideTimeline, patch: Partial<SlideTimeline>): SlideTimeline {
  return {
    ...timeline,
    ...patch,
    updatedAt: nowIso(),
  };
}

/** Empty recorded/builtin timeline ready for first capture. */
export function createEmptyTimeline(now: string = nowIso()): SlideTimeline {
  return {
    version: SLIDE_TIMELINE_VERSION,
    kind: 'recorded',
    extractor: 'builtin',
    createdAt: now,
    updatedAt: now,
    events: [],
    resolutions: {},
  };
}

/**
 * Append a confirmed capture event and mark it canonical.
 * Creates a timeline if `current` is null.
 */
export function recordCaptureConfirmed(
  current: SlideTimeline | null,
  payload: RecordCaptureConfirmedPayload
): SlideTimeline {
  const base = current ?? createEmptyTimeline();
  const id = newEventId();
  const event: SlideCaptureEvent = {
    id,
    changeAt: payload.changeAt,
    confirmedAt: payload.confirmedAt,
    initialFile: payload.file,
  };
  const resolution: SlideResolution = {
    state: 'canonical',
    file: payload.file,
  };
  return touch(base, {
    events: [...base.events, event],
    resolutions: { ...base.resolutions, [id]: resolution },
  });
}

/**
 * Append an explicit gap boundary (unstable flicker, failed verify, etc.).
 * Creates a timeline if `current` is null.
 */
export function recordGapBoundary(
  current: SlideTimeline | null,
  payload: RecordGapBoundaryPayload
): SlideTimeline {
  const base = current ?? createEmptyTimeline();
  const id = newEventId();
  const event: SlideCaptureEvent = {
    id,
    changeAt: payload.changeAt,
    confirmedAt: payload.confirmedAt,
    initialFile: null,
  };
  const resolution: SlideResolution = {
    state: 'gap',
    gapReason: payload.reason,
  };
  return touch(base, {
    events: [...base.events, event],
    resolutions: { ...base.resolutions, [id]: resolution },
  });
}

function eventsMatchingFile(timeline: SlideTimeline, file: string): SlideCaptureEvent[] {
  return timeline.events.filter(e => e.initialFile === file);
}

/**
 * Mark capture events whose initialFile is the duplicate as pointing at the
 * first-kept target. Time spans are preserved; only resolution mutates.
 */
export function relinkDuplicate(
  current: SlideTimeline,
  payload: RelinkDuplicatePayload
): SlideTimeline {
  const matches = eventsMatchingFile(current, payload.duplicateFile);
  if (matches.length === 0) return current;

  const resolutions = { ...current.resolutions };
  for (const event of matches) {
    resolutions[event.id] = {
      state: 'duplicate',
      duplicateOf: payload.targetFile,
    };
  }
  return touch(current, { resolutions });
}

/**
 * Unlink a file's capture events into explicit gaps (AI / exclusion / manual trash).
 */
export function unlinkToGap(current: SlideTimeline, payload: UnlinkToGapPayload): SlideTimeline {
  const matches = eventsMatchingFile(current, payload.file);
  if (matches.length === 0) return current;

  const resolutions = { ...current.resolutions };
  for (const event of matches) {
    resolutions[event.id] = {
      state: 'gap',
      gapReason: payload.reason,
    };
  }
  return touch(current, { resolutions });
}

/**
 * Restore a previously unlinked file back to canonical for events that originally
 * captured it. No-op for pure gap events (initialFile null).
 */
export function restoreCanonical(
  current: SlideTimeline,
  payload: RestoreCanonicalPayload
): SlideTimeline {
  const matches = eventsMatchingFile(current, payload.file);
  if (matches.length === 0) return current;

  const resolutions = { ...current.resolutions };
  for (const event of matches) {
    if (!event.initialFile) continue;
    resolutions[event.id] = {
      state: 'canonical',
      file: event.initialFile,
    };
  }
  return touch(current, { resolutions });
}

/** Drop all events/resolutions; keep kind/extractor and refresh timestamps. */
export function clearTimeline(current: SlideTimeline | null): SlideTimeline {
  const now = nowIso();
  if (!current) return createEmptyTimeline(now);
  return {
    ...current,
    events: [],
    resolutions: {},
    updatedAt: now,
  };
}

/** Map trash/AI reason strings used elsewhere onto GapReason. */
export function gapReasonFromTrashReason(
  reason: string
): GapReason {
  switch (reason) {
    case 'exclusion':
      return 'exclusion';
    case 'ai_filtered':
    case 'ai_filtered_edit':
      return 'ai_filtered';
    case 'manual':
      return 'manual_trash';
    case 'unstable':
      return 'unstable';
    default:
      // duplicates are relinked, not gapped; fall back if misused
      return 'manual_trash';
  }
}
