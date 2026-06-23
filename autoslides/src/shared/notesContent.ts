/**
 * Pure helpers for reading/writing AutoSlides-managed note content (stringified
 * Editor.js documents). Shared by the export and share flows so the image-block
 * parsing lives in exactly one place. Imported via `@common/notesContent`.
 */

import type { EditorJsContent, EditorJsBlock } from './notesTypes';
import { EDITORJS_DOC_VERSION } from './notesTypes';

/** Sentinel prefix of the paragraph block that records a note's share link. */
export const SHARE_MARKER = 'AutoSlides Share:';

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

/** Recorded share URL from the sentinel marker block, or null if none. */
export function findRecordedShareUrl(content: string): string | null {
  const doc = parseContent(content);
  if (!doc) return null;
  for (const block of doc.blocks ?? []) {
    if (block.type !== 'paragraph') continue;
    const text = (block.data as { text?: unknown }).text;
    if (typeof text === 'string' && text.startsWith(SHARE_MARKER)) {
      // The text may carry editor markup; strip tags and take the trailing URL.
      const stripped = text.slice(SHARE_MARKER.length).replace(/<[^>]*>/g, '').trim();
      return stripped || null;
    }
  }
  return null;
}

/**
 * Append (or replace) the sentinel marker paragraph recording a note's share
 * URL at the end of the document. Returns the new stringified content.
 */
export function appendShareMarker(content: string, url: string): string {
  const doc = parseContent(content) ?? {
    time: Date.now(),
    blocks: [],
    version: EDITORJS_DOC_VERSION,
  };
  const blocks = doc.blocks ?? [];
  const marker: EditorJsBlock = { type: 'paragraph', data: { text: `${SHARE_MARKER} ${url}` } };
  const idx = blocks.findIndex(
    (b) => b.type === 'paragraph'
      && typeof (b.data as { text?: unknown }).text === 'string'
      && ((b.data as { text: string }).text).startsWith(SHARE_MARKER),
  );
  if (idx >= 0) blocks[idx] = marker;
  else blocks.push(marker);
  return JSON.stringify({ time: Date.now(), blocks, version: doc.version ?? EDITORJS_DOC_VERSION });
}
