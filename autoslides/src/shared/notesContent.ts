/** Slide filenames used when restoring a folder and timeline from a share link. */
import type { SlideTimeline } from './sidecars/timeline';

/** True when `name` is a single basename we can write next to timeline.json. */
export function isSafeSlideBasename(name: string): boolean {
  const base = name.trim();
  if (!base || base !== name) return false;
  if (base.includes('/') || base.includes('\\') || base === '.' || base === '..') return false;
  return /^Slide_.+\.(png|jpe?g)$/i.test(base);
}

/** Canonical timeline files in event order (kept slides only). */
export function canonicalTimelineFiles(timeline?: SlideTimeline | null): string[] {
  if (!timeline?.events?.length) return [];
  const names: string[] = [];
  for (const ev of timeline.events) {
    const res = timeline.resolutions?.[ev.id];
    if (res?.state === 'canonical' && res.file) names.push(res.file);
  }
  return names;
}

/**
 * Filenames to write when reconstituting a `slides_*` folder. Uses canonical
 * names from the embedded timeline.json so they match the written timeline;
 * Slide_NNN.png if there is no usable timeline (live / share / no file).
 */
export function exportSlideFilenames(
  count: number,
  timeline?: SlideTimeline | null,
): string[] {
  const width = Math.max(3, String(count).length);
  const numbered = (i: number): string => `Slide_${String(i + 1).padStart(width, '0')}.png`;
  if (count <= 0) return [];

  const fromTl = sanitizeFileList(canonicalTimelineFiles(timeline), count);
  if (fromTl) return fromTl;
  return Array.from({ length: count }, (_, i) => numbered(i));
}

function sanitizeFileList(names: string[] | null | undefined, count: number): string[] | null {
  if (!names || names.length !== count) return null;
  const out: string[] = [];
  const used = new Set<string>();
  for (const raw of names) {
    const base = raw.replace(/\\/g, '/').split('/').pop()?.trim() ?? '';
    if (!isSafeSlideBasename(base)) return null;
    let name = base;
    let n = 2;
    while (used.has(name.toLowerCase())) {
      const dot = name.lastIndexOf('.');
      name = `${name.slice(0, dot)}_${n}${name.slice(dot)}`;
      n += 1;
    }
    used.add(name.toLowerCase());
    out.push(name);
  }
  return out;
}
