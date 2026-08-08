// Per-folder slide timeline (`timeline.json` colocated inside each `slides_*`
// folder). Event log + resolution map: capture events are append-mostly;
// resolutions mutate as post-processing / human review relink or unlink files.
// Derived subtitle-like cues come from deriveCues() — not stored on disk.
//
// Writers:
//  - Host builtin extraction: media times from video.currentTime; extractor 'builtin'.
//  - AutoSlidesQt CLI (--write-timeline): media PTS seconds; extractor 'qt'
//    (no kind). Host stamps kind: 'recorded' after a Qt job for recorded lectures.
// Times: changeAt = first change / true T1; confirmedAt = stability confirm.

export const SLIDE_TIMELINE_VERSION = 1;
export const SLIDE_TIMELINE_FILENAME = 'timeline.json';

export type ResolutionState = 'canonical' | 'duplicate' | 'gap';

/** Who produced the capture events. Mirrors metadata.json extraction.extractor. */
export type SlideTimelineExtractor = 'builtin' | 'qt';

export type GapReason =
  | 'unstable' // flicker / failed verify / pre-content
  | 'ai_filtered'
  | 'exclusion'
  | 'manual_trash';

export interface SlideCaptureEvent {
  /** Immutable unique event id (e.g. evt_<ms>_<rand>). */
  id: string;
  /** Media time (video.currentTime seconds) when content first changed (true T1). */
  changeAt: number;
  /** Media time when stability confirmed / file saved, or when a gap was aborted. */
  confirmedAt: number;
  /** Filename written at capture (e.g. Slide_….png), or null for pure gap events. */
  initialFile: string | null;
}

export interface SlideResolution {
  state: ResolutionState;
  /** Present when state === 'canonical'. */
  file?: string;
  /** Present when state === 'duplicate': target canonical filename. */
  duplicateOf?: string;
  /** Present when state === 'gap'. */
  gapReason?: GapReason;
}

export interface SlideTimeline {
  version: number;
  /**
   * Host session context for recorded lectures. Qt CLI omits this; the host
   * stamps `recorded` after a successful Qt extract. Builtin always writes it.
   */
  kind?: 'recorded';
  extractor: SlideTimelineExtractor;
  createdAt: string;
  updatedAt: string;
  /** Append-mostly capture events, ordered by changeAt when written. */
  events: SlideCaptureEvent[];
  /** Mutable map eventId → current display resolution. */
  resolutions: Record<string, SlideResolution>;
}

export interface SlideCue {
  id: string;
  startTime: number;
  endTime: number;
  type: 'slide' | 'gap';
  /** Resolved canonical filename when type === 'slide'. */
  file?: string;
  gapReason?: GapReason;
}

export interface RecordCaptureConfirmedPayload {
  changeAt: number;
  confirmedAt: number;
  /** Filename including .png extension. */
  file: string;
}

export interface RecordGapBoundaryPayload {
  changeAt: number;
  confirmedAt: number;
  reason: GapReason;
}

export interface RelinkDuplicatePayload {
  duplicateFile: string;
  targetFile: string;
}

export interface UnlinkToGapPayload {
  file: string;
  reason: GapReason;
}

export interface RestoreCanonicalPayload {
  file: string;
}
