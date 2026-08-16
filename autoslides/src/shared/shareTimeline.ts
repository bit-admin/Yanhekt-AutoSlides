/**
 * Compact share-link timeline: reduce a folder `timeline.json` to a v3 delta
 * string, and rebuild a player-compatible SlideTimeline from that string.
 *
 * Lives next to (not inside) `shareLink.ts` so the URL codec stays
 * dependency-free. The share viewer and Electron both import this module.
 */

import { exportSlideFilenames } from './notesContent';
import {
  decodeShareTimeline,
  encodeShareTimeline,
  payloadHasTimeline,
  type SharePayload,
} from './shareLink';
import {
  SLIDE_TIMELINE_VERSION,
  coalesceConsecutiveSlideCues,
  deriveCues,
  type SlideCaptureEvent,
  type SlideResolution,
  type SlideTimeline,
} from './sidecars/timeline';

function basenameOf(filename: string): string {
  const parts = filename.split(/[/\\]/);
  return parts[parts.length - 1] ?? '';
}

/**
 * Coalesce `timeline` into a v3 delta-string keyed by `filenames` (share image
 * order). Returns undefined when there are no mappable slide cues.
 */
export function shareTimelineDelta(
  timeline: SlideTimeline | null | undefined,
  filenames: string[],
): string | undefined {
  if (!timeline?.events?.length || filenames.length === 0) return undefined;

  const indexOf = new Map<string, number>();
  filenames.forEach((name, i) => {
    const base = basenameOf(name);
    if (base && !indexOf.has(base)) indexOf.set(base, i);
  });

  const pairs: Array<[number, number]> = [];
  for (const cue of coalesceConsecutiveSlideCues(deriveCues(timeline))) {
    if (cue.type !== 'slide' || !cue.file) continue;
    const idx = indexOf.get(basenameOf(cue.file));
    if (idx === undefined) continue;
    pairs.push([idx, Math.round(cue.startTime)]);
  }
  if (pairs.length === 0) return undefined;
  return encodeShareTimeline(pairs);
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

/** Delta-string for a note: filenames follow exportSlideFilenames (canonical if count matches). */
export function shareTimelineDeltaFromNote(
  timeline: SlideTimeline | null | undefined,
  imageCount: number,
): string | undefined {
  if (!timeline || imageCount <= 0) return undefined;
  return shareTimelineDelta(timeline, exportSlideFilenames(imageCount, timeline));
}

/** Reconstruct from a decoded payload using Slide_NNN.png (or supplied) names. */
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
