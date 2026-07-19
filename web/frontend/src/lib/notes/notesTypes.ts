/**
 * Yanhekt cloud-note API types (cbiz.yanhekt.cn/v1/note*).
 * Ported from autoslides/src/shared/notesTypes.ts (web subset: no export/import/
 * Index types — those features are desktop-only).
 */

/** A single Editor.js content block. */
export interface EditorJsBlock {
  id?: string;
  type: string;
  data: Record<string, unknown>;
}

/** Parsed Editor.js document — the un-stringified `content` field. */
export interface EditorJsContent {
  time: number;
  blocks: EditorJsBlock[];
  version: string;
}

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

/**
 * Name of the Yanhekt note group AutoSlides manages for slide imports. Exactly
 * 6 chars (the server limit). Identification is name-based (groups carry no
 * metadata field), so this marker is the only thing that survives reinstalls /
 * other machines. The web version never provisions this group (no import
 * feature) but still recognizes desktop-created ones.
 */
export const MANAGED_GROUP_NAME = 'ASnote';

/**
 * Name of the second AutoSlides-managed group, holding personal "watch mode"
 * captures (slides grabbed while watching a live stream or a recorded session).
 * Exactly 6 chars (the server limit), same identification rules as ASnote.
 */
export const USER_GROUP_NAME = 'ASuser';

/** Editor.js library version stamped into documents we generate (matches the installed build). */
export const EDITORJS_DOC_VERSION = '2.26.5';

/** Whether a group is the ASnote import group (by reserved name). */
export function isManagedGroupName(name: string): boolean {
  return name === MANAGED_GROUP_NAME;
}

/** Whether a group is the ASuser watch-mode group (by reserved name). */
export function isUserGroupName(name: string): boolean {
  return name === USER_GROUP_NAME;
}

/** Whether a group is any AutoSlides-managed/protected group (ASnote or ASuser). */
export function isAutoSlidesGroupName(name: string): boolean {
  return isManagedGroupName(name) || isUserGroupName(name);
}

/**
 * Prefix marking a note as AutoSlides-managed. We can't persist course/session
 * IDs for extracted folders, so managed slide-notes are keyed off the folder's
 * display name; this prefix makes them identifiable and title-searchable. The
 * full built title (prefix + display name) doubles as the dedup key.
 */
export const MANAGED_NOTE_PREFIX = 'AS ·';

/** Build a managed note title from a folder's human-readable display name. */
export function buildManagedNoteTitle(displayName: string): string {
  return `${MANAGED_NOTE_PREFIX} ${displayName}`;
}

/** Whether a note title was produced by AutoSlides (carries the managed prefix). */
export function isManagedNoteTitle(title: string): boolean {
  return title.startsWith(MANAGED_NOTE_PREFIX);
}

/**
 * Recover the folder display name from a managed note title — the inverse of
 * buildManagedNoteTitle. Non-managed titles are returned unchanged.
 */
export function managedNoteDisplayName(title: string): string {
  return isManagedNoteTitle(title) ? title.slice(MANAGED_NOTE_PREFIX.length).trim() : title;
}
