/**
 * Yanhekt cloud-note API types (cbiz.yanhekt.cn/v1/note*).
 */

/**
 * Note as returned by the list endpoint. `content` is an empty string in list
 * responses — fetch the detail endpoint before editing.
 */
export interface NoteSummary {
  id: number;
  uuid: string;
  type: number;
  relevant_id: number;
  root_id: number;
  title: string;
  note_group_id: number;
  deleted: number;
  version: number;
  created_at: string;
  updated_at: string;
  root_name?: string;
  relevant_name?: string;
}

/** Full note as returned by GET /v1/note — includes the stringified `content`. */
export interface NoteDetail extends NoteSummary {
  /** Editor.js document, STRINGIFIED. Parse with JSON.parse before use. */
  content: string;
  client_time: number;
  content_updated_time: string;
  note_group_name?: string;
}

/** Paginated list response (data of GET /v1/note/list). */
export interface NoteListResult {
  current_page: number;
  data: NoteSummary[];
  total: number;
  per_page: string;
  last_page: number;
}

/** A note group (folder). Group id 0 is the implicit default group. */
export interface NoteGroup {
  id: number;
  name: string;
  notes?: NoteSummary[];
}

/** Result of a MinIO image upload — the public, permanent CDN URL. */
export interface UploadedImage {
  url: string;
}

export interface NoteListParams {
  page?: number;
  pageSize?: number;
  keyword?: string;
  // NOTE: the server's /v1/note/list endpoint ignores any groupId filter — it
  // always returns all notes. Group membership is filtered client-side using
  // each note's `note_group_id` (the authoritative grouping is also available
  // via /v1/note/group/list?with_note=true).
}

/** Uniform result envelope so callers can surface auth/network failures. */
export type NotesResult<T> = { ok: true; data: T } | { ok: false; error: string };

/** Max length of a note group name enforced by the server. */
export const NOTE_GROUP_NAME_MAX = 6;

/** Client-side reasons a new group/folder name cannot be submitted. */
export type NoteGroupNameError = 'empty' | 'tooLong' | 'duplicate' | 'invalidChars';

function hasForbiddenGroupChars(name: string): boolean {
  if (name.includes('/') || name.includes('\\')) return true;
  for (let i = 0; i < name.length; i++) {
    const code = name.charCodeAt(i);
    if (code <= 0x1f || code === 0x7f) return true;
  }
  return false;
}

/**
 * Validate a Yanhekt group name before POST /v1/note/group. Length matches the
 * server's 6-char cap (JS string length, same as the old maxlength=6 input).
 */
export function validateNoteGroupName(
  raw: string,
  existingNames: Iterable<string>,
): NoteGroupNameError | null {
  const name = raw.trim();
  if (!name) return 'empty';
  if (name.length > NOTE_GROUP_NAME_MAX) return 'tooLong';
  if (hasForbiddenGroupChars(name)) return 'invalidChars';
  const lower = name.toLowerCase();
  for (const existing of existingNames) {
    if (existing.toLowerCase() === lower) return 'duplicate';
  }
  return null;
}

/** Label for a note-group row or <option>, including the Ungrouped sentinel. */
export function formatNoteGroupLabel(
  group: { id: number; name: string },
  translate: (key: string) => string,
  ungroupedKey = 'cloudNotes.defaultGroup',
): string {
  if (group.id === 0) return translate(ungroupedKey);
  return group.name || translate(ungroupedKey);
}
