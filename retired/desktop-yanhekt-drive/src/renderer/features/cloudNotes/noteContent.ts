/**
 * What a stored note body is, before an editor is given it.
 *
 * `empty`: a new note, nothing written yet. `document`: an Editor.js document.
 * `unreadable`: there is content, but not in a form this editor reads (not
 * JSON, or JSON without a `blocks` list). The three are kept apart because an
 * editor that opens the third as if it were the first saves an empty document
 * over the original on the first keystroke.
 */
export type NoteContent =
  | { kind: 'empty' }
  | { kind: 'document'; data: { blocks: unknown[] } & Record<string, unknown> }
  | { kind: 'unreadable' }

export function readNoteContent(raw: string | null | undefined): NoteContent {
  if (raw == null || raw.trim() === '') return { kind: 'empty' }
  try {
    const parsed: unknown = JSON.parse(raw)
    if (parsed && typeof parsed === 'object' && Array.isArray((parsed as { blocks?: unknown }).blocks)) {
      return { kind: 'document', data: parsed as { blocks: unknown[] } & Record<string, unknown> }
    }
  } catch {
    // Not JSON: unreadable, below.
  }
  return { kind: 'unreadable' }
}
