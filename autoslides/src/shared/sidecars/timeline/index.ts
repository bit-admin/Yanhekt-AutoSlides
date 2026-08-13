export {
  SLIDE_TIMELINE_VERSION,
  SLIDE_TIMELINE_FILENAME,
  type ResolutionState,
  type GapReason,
  type SlideTimelineExtractor,
  type SlideCaptureEvent,
  type SlideResolution,
  type SlideTimeline,
  type SlideCue,
  type RecordCaptureConfirmedPayload,
  type RecordGapBoundaryPayload,
  type RelinkDuplicatePayload,
  type UnlinkToGapPayload,
  type RestoreCanonicalPayload,
} from './types';

export {
  createEmptyTimeline,
  ensureRecordedHostFields,
  recordCaptureConfirmed,
  recordGapBoundary,
  relinkDuplicate,
  unlinkToGap,
  restoreCanonical,
  clearTimeline,
  gapReasonFromTrashReason,
} from './reducers';

export { deriveCues, coalesceConsecutiveSlideCues, appearancesForFile } from './cues';
export type { SlideAppearanceSpan } from './cues';
