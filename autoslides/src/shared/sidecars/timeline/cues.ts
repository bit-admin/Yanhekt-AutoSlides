import type { GapReason, SlideCue, SlideResolution, SlideTimeline } from './types';

/**
 * Resolve a filename through the resolution map to a final canonical file, or
 * null if the chain ends in a gap / cycle / missing target.
 *
 * Resolutions are keyed by event id, not filename, so we scan values for a
 * matching canonical/duplicate entry. Prefer the first chronological match via
 * the optional event order when provided.
 */
function resolveCanonicalFile(
  timeline: SlideTimeline,
  targetFilename: string | undefined,
  seen: Set<string> = new Set()
): string | null {
  if (!targetFilename) return null;
  if (seen.has(targetFilename)) return null;
  seen.add(targetFilename);

  // Prefer an event that originally captured this file, in event order.
  for (const event of timeline.events) {
    if (event.initialFile !== targetFilename) continue;
    const res = timeline.resolutions[event.id];
    if (!res) return null;
    if (res.state === 'canonical' && res.file) return res.file;
    if (res.state === 'duplicate') {
      return resolveCanonicalFile(timeline, res.duplicateOf, seen);
    }
    // gap
    return null;
  }

  // Fallback: any resolution currently advertising this file as canonical.
  for (const res of Object.values(timeline.resolutions)) {
    if (res.state === 'canonical' && res.file === targetFilename) return res.file;
    if (res.state === 'duplicate' && res.duplicateOf === targetFilename) {
      // Someone points at target — treat target as still present if any
      // canonical event holds it (already scanned). Otherwise keep searching.
      continue;
    }
  }

  // Target may still exist on disk without a matching event (shouldn't for v1).
  // Conservative: if any event is canonical with that file, already returned;
  // otherwise treat as missing → gap at call site.
  return null;
}

function resolutionToCueFields(
  timeline: SlideTimeline,
  resolution: SlideResolution | undefined
): { type: 'slide' | 'gap'; file?: string; gapReason?: GapReason } {
  if (!resolution || resolution.state === 'gap') {
    return {
      type: 'gap',
      gapReason: resolution?.gapReason ?? 'unstable',
    };
  }

  if (resolution.state === 'canonical') {
    if (resolution.file) {
      return { type: 'slide', file: resolution.file };
    }
    return { type: 'gap', gapReason: 'unstable' };
  }

  // duplicate
  const target = resolveCanonicalFile(timeline, resolution.duplicateOf);
  if (target) {
    return { type: 'slide', file: target };
  }
  return { type: 'gap', gapReason: 'ai_filtered' };
}

/**
 * Derive subtitle-like cues from the event log + resolution map.
 * Explicit gaps stay gaps (never extend the previous slide).
 * Missing timeline / empty events → [].
 */
export function deriveCues(
  timeline: SlideTimeline | null | undefined,
  videoDuration?: number
): SlideCue[] {
  if (!timeline?.events?.length) return [];

  const sorted = [...timeline.events].sort((a, b) => a.changeAt - b.changeAt);
  const cues: SlideCue[] = [];
  const endFallback =
    typeof videoDuration === 'number' && Number.isFinite(videoDuration)
      ? videoDuration
      : Number.POSITIVE_INFINITY;

  if (sorted[0].changeAt > 0) {
    cues.push({
      id: 'cue_t0_gap',
      startTime: 0,
      endTime: sorted[0].changeAt,
      type: 'gap',
      gapReason: 'unstable',
    });
  }

  for (let i = 0; i < sorted.length; i++) {
    const event = sorted[i];
    const startTime = event.changeAt;
    const endTime = i < sorted.length - 1 ? sorted[i + 1].changeAt : endFallback;
    const fields = resolutionToCueFields(timeline, timeline.resolutions[event.id]);
    cues.push({
      id: event.id,
      startTime,
      endTime,
      ...fields,
    });
  }

  return cues;
}

/**
 * Merge adjacent slide cues that resolve to the same file.
 *
 * Dedup/relink often produces consecutive spans that all display the same PNG
 * (e.g. capture → reappearance trashed as duplicate). Subtitle consumers may
 * want every event span; chapter UIs should show one card per visual change so
 * "Watching" does not bounce between identical thumbs at shared boundaries.
 *
 * Gaps break the run. Non-adjacent reappearances (A → B → A) stay separate.
 * Keeps the first cue's id/startTime and extends endTime through the run.
 */
export function coalesceConsecutiveSlideCues(cues: SlideCue[]): SlideCue[] {
  if (!cues.length) return [];

  const out: SlideCue[] = [];
  for (const cue of cues) {
    const prev = out[out.length - 1];
    if (
      prev &&
      prev.type === 'slide' &&
      cue.type === 'slide' &&
      prev.file &&
      cue.file &&
      prev.file === cue.file
    ) {
      const prevEnd = prev.endTime;
      const nextEnd = cue.endTime;
      let endTime: number;
      if (!Number.isFinite(prevEnd) || !Number.isFinite(nextEnd)) {
        endTime = Number.POSITIVE_INFINITY;
      } else {
        endTime = Math.max(prevEnd, nextEnd);
      }
      out[out.length - 1] = {
        ...prev,
        endTime,
      };
      continue;
    }
    out.push(cue);
  }
  return out;
}

export interface SlideAppearanceSpan {
  id: string;
  startTime: number;
  endTime: number;
  source: 'resolved' | 'capture';
}

function basenameOf(filename: string): string {
  const parts = filename.split(/[/\\]/);
  return parts[parts.length - 1] ?? '';
}

/**
 * Time spans where `filename` is (or was) on screen.
 *
 * Prefer coalesced resolved cues (canonical file + absorbed duplicates).
 * If none match — typically a trashed or duplicate-of-other file — optionally
 * fall back to the original capture event span(s) for that basename.
 */
export function appearancesForFile(
  timeline: SlideTimeline | null | undefined,
  filename: string,
  options?: { videoDuration?: number; includeCaptureFallback?: boolean }
): SlideAppearanceSpan[] {
  if (!timeline || !filename) return [];
  const target = basenameOf(filename);
  if (!target) return [];

  const resolved = coalesceConsecutiveSlideCues(deriveCues(timeline, options?.videoDuration))
    .filter(
      (cue): cue is SlideCue & { type: 'slide'; file: string } =>
        cue.type === 'slide' && cue.file === target
    )
    .map((cue) => ({
      id: cue.id,
      startTime: cue.startTime,
      endTime: cue.endTime,
      source: 'resolved' as const,
    }));

  if (resolved.length > 0) return resolved;
  if (options?.includeCaptureFallback === false) return [];

  const sorted = [...timeline.events].sort((a, b) => a.changeAt - b.changeAt);
  const endFallback =
    typeof options?.videoDuration === 'number' && Number.isFinite(options.videoDuration)
      ? options.videoDuration
      : Number.POSITIVE_INFINITY;

  const spans: SlideAppearanceSpan[] = [];
  for (let i = 0; i < sorted.length; i++) {
    const event = sorted[i];
    if (event.initialFile !== target) continue;
    spans.push({
      id: event.id,
      startTime: event.changeAt,
      endTime: i < sorted.length - 1 ? sorted[i + 1].changeAt : endFallback,
      source: 'capture',
    });
  }
  return spans;
}
