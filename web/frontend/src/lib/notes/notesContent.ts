/** Helpers for sharing images and reading timelines from older AutoSlides notes. */
import { readNoteContent } from './noteContent';

/** Image-block URLs in document order. */
export function noteImageUrls(content: string): string[] {
  const note = readNoteContent(content);
  if (note.kind !== 'document') return [];
  const urls: string[] = [];
  for (const raw of note.data.blocks) {
    const block = raw as { type?: unknown; data?: { file?: { url?: unknown } } } | null;
    if (block?.type !== 'image') continue;
    const url = block.data?.file?.url;
    if (typeof url === 'string') urls.push(url);
  }
  return urls;
}

/** Read only: older imports stored timeline.json inside an Editor.js code block. */
export function readLegacyNoteTimeline(content: string): unknown {
  const note = readNoteContent(content);
  if (note.kind !== 'document') return null;
  for (const raw of note.data.blocks) {
    const block = raw as { type?: unknown; data?: { code?: unknown } } | null;
    if (block?.type !== 'code' || typeof block.data?.code !== 'string') continue;
    try {
      const metadata = JSON.parse(block.data.code)?.autoslides;
      if (metadata && typeof metadata === 'object') return metadata.timeline ?? null;
    } catch {
      // Ordinary code block, not an imported note's metadata.
    }
  }
  return null;
}

/** True when `name` is a single basename we can write next to timeline.json. */
export function isSafeSlideBasename(name: string): boolean {
  const base = name.trim();
  if (!base || base !== name) return false;
  if (base.includes('/') || base.includes('\\') || base === '.' || base === '..') return false;
  return /^Slide_.+\.(png|jpe?g)$/i.test(base);
}

/** Canonical timeline files in event order (kept slides only). Duck-typed: web has no sidecar module. */
export function canonicalTimelineFiles(timeline?: unknown | null): string[] {
  if (!timeline || typeof timeline !== 'object') return [];
  const events = (timeline as { events?: unknown }).events;
  const resolutions = (timeline as { resolutions?: unknown }).resolutions;
  if (!Array.isArray(events) || !resolutions || typeof resolutions !== 'object') return [];
  const names: string[] = [];
  for (const ev of events) {
    if (!ev || typeof ev !== 'object') continue;
    const id = (ev as { id?: unknown }).id;
    if (typeof id !== 'string') continue;
    const res = (resolutions as Record<string, { state?: unknown; file?: unknown }>)[id];
    if (res?.state === 'canonical' && typeof res.file === 'string') names.push(res.file);
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
  timeline?: unknown | null,
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
