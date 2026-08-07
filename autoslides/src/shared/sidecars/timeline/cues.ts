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
