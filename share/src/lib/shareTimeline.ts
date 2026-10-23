/**
 * Rebuild a slide `timeline.json` from a v3 share link's delta-string.
 *
 * Decode-only copy of autoslides/src/shared/shareTimeline.ts
 * (`timelineFromShareDelta`, `timelineFromSharePayload`) with the timeline
 * types it needs from autoslides/src/shared/sidecars/timeline/types.ts and the
 * numbered branch of `exportSlideFilenames` from notesContent.ts. Drift group
 * `shareTimeline` (scripts/check-drift.mjs): port every change to the decode
 * side. The encode side (`shareTimelineDelta`) stays in the desktop app.
 */

import { decodeShareTimeline, payloadHasTimeline, type SharePayload } from './shareLink';

export const SLIDE_TIMELINE_VERSION = 1;

export type ResolutionState = 'canonical' | 'duplicate' | 'gap';

/** Who produced the capture events. Mirrors metadata.json extraction.extractor. */
export type SlideTimelineExtractor = 'builtin' | 'qt' | 'yanhe2';

export type GapReason = 'unstable' | 'ai_filtered' | 'exclusion' | 'manual_trash';

export interface SlideCaptureEvent {
  /** Immutable unique event id. */
  id: string;
  /** Media time (seconds) when content first changed. */
  changeAt: number;
  /** Media time when stability was confirmed / the file was saved. */
  confirmedAt: number;
  /** Filename written at capture, or null for pure gap events. */
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
  kind?: 'recorded';
  extractor: SlideTimelineExtractor;
  createdAt: string;
  updatedAt: string;
  events: SlideCaptureEvent[];
  resolutions: Record<string, SlideResolution>;
}

/**
 * The desktop export's file names when no timeline names them:
 * `Slide_001.png` … (at least three digits, wider for 1000+ slides).
 */
export function exportSlideFilenames(count: number): string[] {
  if (count <= 0) return [];
  const width = Math.max(3, String(count).length);
  return Array.from({ length: count }, (_, i) => `Slide_${String(i + 1).padStart(width, '0')}.png`);
}

/**
 * Rebuild a recorded `timeline.json` from a v3 delta-string.
 * First appearance of each index is canonical; later ones are duplicates.
 */
export function timelineFromShareDelta(
  t: string,
  filenames: string[],
): SlideTimeline | null {
  const cues = decodeShareTimeline(t);
  if (!cues || filenames.length === 0) return null;

  const now = new Date().toISOString();
  const events: SlideCaptureEvent[] = [];
  const resolutions: Record<string, SlideResolution> = {};
  const firstAt = new Map<number, number>();
  const later: Array<[number, number]> = [];

  for (const [idx, start] of cues) {
    if (!filenames[idx]) continue;
    if (!firstAt.has(idx)) firstAt.set(idx, start);
    else later.push([idx, start]);
  }

  // Canonical events in image-index order so exportSlideFilenames() matches `h`.
  let n = 0;
  const push = (idx: number, start: number, res: SlideResolution): void => {
    const file = filenames[idx];
    const id = `evt_share_${n}_${start}`;
    n += 1;
    events.push({ id, changeAt: start, confirmedAt: start, initialFile: file });
    resolutions[id] = res;
  };
  for (let idx = 0; idx < filenames.length; idx += 1) {
    const start = firstAt.get(idx);
    if (start === undefined) continue;
    push(idx, start, { state: 'canonical', file: filenames[idx] });
  }
  for (const [idx, start] of later) {
    push(idx, start, { state: 'duplicate', duplicateOf: filenames[idx] });
  }
  if (events.length === 0) return null;

  return {
    version: SLIDE_TIMELINE_VERSION,
    kind: 'recorded',
    extractor: 'builtin',
    createdAt: now,
    updatedAt: now,
    events,
    resolutions,
  };
}

export function timelineFromSharePayload(
  payload: SharePayload,
  filenames?: string[],
): SlideTimeline | null {
  if (!payloadHasTimeline(payload) || !payload.t) return null;
  const count = payload.n > 0 ? Math.floor(payload.h.length / payload.n) : 0;
  const names = filenames && filenames.length === count ? filenames : exportSlideFilenames(count);
  if (names.length === 0) return null;
  return timelineFromShareDelta(payload.t, names);
}
