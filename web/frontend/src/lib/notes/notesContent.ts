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
//   - `note`: cloud-note-side metadata that only exists once the note is on the
//     server (display name, image count, import timestamp, share link).
export const NOTE_METADATA_KEY = 'autoslides';
export const NOTE_METADATA_VERSION = 1;

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
  patch: { slides?: SlideMetadata | null; note?: Partial<NoteCloudMetadata> },
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
