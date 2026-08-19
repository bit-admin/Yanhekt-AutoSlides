/**
 * Pure helpers for reading/writing AutoSlides-managed note content (stringified
 * Editor.js documents). Ported from autoslides/src/shared/notesContent.ts so the
 * image-block parsing + managed-metadata handling stay byte-compatible with the
 * desktop app (both clients read/write the same cloud notes).
 */

import type { EditorJsContent, EditorJsBlock } from './notesTypes';
import { EDITORJS_DOC_VERSION } from './notesTypes';
import type { SlideMetadata } from '../slideMetadataTypes';

// A single managed metadata block (an Editor.js `code` block) lives at the end of
// every AutoSlides-imported note. Its JSON is namespaced under this sentinel key
// so we can identify our block among any user code blocks. It carries two groups:
//   - `slides`: the originating folder's metadata (identity + provenance +
//     review), or null for notes with no local folder origin.
//   - `timeline`: the originating folder's timeline.json (event log + resolutions),
//     or null when the folder has no timeline (live/offline/web-capture).
//   - `note`: cloud-note-side metadata that only exists once the note is on the
//     server (display name, image count, import timestamp, share link).
export const NOTE_METADATA_KEY = 'autoslides';
export const NOTE_METADATA_VERSION = 1;

/**
 * Short, English-only copyright notice embedded in every imported note (a
 * condensed form of the PDF Maker cover copyright). Kept English regardless of
 * UI language since the note travels with the user's Yanhekt account. Shared by
 * every import call site (Cloud Notes folder import, Cloud Index share-link
 * import) so the wording can't drift between them.
 */
export const NOTE_COPYRIGHT =
  'This file may contain copyrighted material, extracted from a recorded lecture solely for ' +
  'personal study and non-commercial educational use. All rights remain with their respective ' +
  'holders; redistribution or commercial use is prohibited. AutoSlides is an automated tool and ' +
  'claims no ownership of the content.';

export interface NoteCloudMetadata {
  displayName?: string;
  imageCount?: number;
  importedAt?: string;
  shareUrl?: string;
  /** AutoSlides Index lecture URL, set once this note is published to the index. */
  indexUrl?: string;
}

export interface NoteMetadata {
  v: number;
  slides: SlideMetadata | null;
  /** Full timeline.json when the note was imported from Electron; omitted on web-only notes. */
  timeline?: unknown | null;
  note: NoteCloudMetadata;
}

function parseContent(content: string): EditorJsContent | null {
  if (!content) return null;
  try {
    return JSON.parse(content) as EditorJsContent;
  } catch {
    return null;
  }
}

/** Image-block URLs of a note, in document (slide) order. */
export function noteImageUrls(content: string): string[] {
  const doc = parseContent(content);
  if (!doc) return [];
  const urls: string[] = [];
  for (const block of doc.blocks ?? []) {
    if (block.type !== 'image') continue;
    const file = (block.data as { file?: { url?: unknown } }).file;
    if (file && typeof file.url === 'string') urls.push(file.url);
  }
  return urls;
}

// ── Managed metadata block ───────────────────────────────────────────────────

function codeOf(block: EditorJsBlock): string | null {
  if (block.type !== 'code') return null;
  const code = (block.data as { code?: unknown }).code;
  return typeof code === 'string' ? code : null;
}

/** True when a code block's JSON carries our sentinel key. */
function isMetadataBlock(block: EditorJsBlock): boolean {
  const code = codeOf(block);
  if (code === null) return false;
  try {
    return !!(JSON.parse(code) as Record<string, unknown>)[NOTE_METADATA_KEY];
  } catch {
    return false;
  }
}

function normalizeMeta(raw: Partial<NoteMetadata> | undefined): NoteMetadata {
  return {
    v: typeof raw?.v === 'number' ? raw.v : NOTE_METADATA_VERSION,
    slides: (raw?.slides ?? null) as SlideMetadata | null,
    timeline: raw?.timeline ?? null,
    note: (raw?.note ?? {}) as NoteCloudMetadata,
  };
}

/** The note's managed metadata (from the sentinel code block), or null if none. */
export function readNoteMetadata(content: string): NoteMetadata | null {
  const doc = parseContent(content);
  if (!doc) return null;
  for (const block of doc.blocks ?? []) {
    if (!isMetadataBlock(block)) continue;
    try {
      const obj = JSON.parse(codeOf(block) as string) as Record<string, unknown>;
      return normalizeMeta(obj[NOTE_METADATA_KEY] as Partial<NoteMetadata>);
    } catch {
      return null;
    }
  }
  return null;
}

/** Pretty JSON payload for the metadata code block (namespaced under the sentinel). */
export function serializeNoteMetadata(meta: NoteMetadata): string {
  return JSON.stringify({ [NOTE_METADATA_KEY]: meta }, null, 2);
}

/** Build the Editor.js `code` block that carries a note's managed metadata. */
export function buildNoteMetadataBlock(meta: NoteMetadata): EditorJsBlock {
  return { type: 'code', data: { code: serializeNoteMetadata(meta) } };
}

/**
 * Create or update the managed metadata block at the end of the document.
 * `slides` replaces wholesale when provided; `note` is shallow-merged onto the
 * existing cloud metadata. Returns the new stringified content.
 */
export function upsertNoteMetadata(
  content: string,
  patch: { slides?: SlideMetadata | null; timeline?: unknown | null; note?: Partial<NoteCloudMetadata> },
): string {
  const doc = parseContent(content) ?? {
    time: Date.now(),
    blocks: [],
    version: EDITORJS_DOC_VERSION,
  };
  const blocks = doc.blocks ?? [];
  const existing = readNoteMetadata(content);
  const next: NoteMetadata = {
    v: NOTE_METADATA_VERSION,
    slides: patch.slides !== undefined ? patch.slides : (existing?.slides ?? null),
    timeline: patch.timeline !== undefined ? patch.timeline : (existing?.timeline ?? null),
    note: { ...(existing?.note ?? {}), ...(patch.note ?? {}) },
  };
  const block = buildNoteMetadataBlock(next);
  const idx = blocks.findIndex(isMetadataBlock);
  if (idx >= 0) blocks[idx] = block;
  else blocks.push(block);
  return JSON.stringify({ time: Date.now(), blocks, version: doc.version ?? EDITORJS_DOC_VERSION });
}

/** Recorded share URL from the managed metadata block, or null if none. */
export function findRecordedShareUrl(content: string): string | null {
  return readNoteMetadata(content)?.note.shareUrl ?? null;
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
