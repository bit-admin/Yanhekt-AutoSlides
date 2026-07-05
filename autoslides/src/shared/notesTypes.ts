/**
 * Yanhekt cloud-note API types (cbiz.yanhekt.cn/v1/note*).
 * Shared across the main process (notesService), the preload bridge, and the
 * renderer (useCloudNotes / CloudNotesTab). Imported via `@common/notesTypes`.
 *
 * See REFERENCE/yanhekt-note-api-report.md for the verified API surface.
 */

import type { SlideMetadata } from './slideMetadataTypes';

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

/** Result of resolving a managed note's local `slides_<name>` export folder. */
export interface ExportFolderInfo {
  /** Whether the folder exists on disk (status check) / was created (prepare). */
  exists: boolean;
  /** Absolute path to the export folder. */
  dir: string;
  /** Basename of `dir`, e.g. `slides_<name>` or `slides_<name> (2)`. */
  folderName: string;
}

/** Result of resolving a pasted share link into importable image URLs. */
export interface ShareImportResult {
  /** Note display title (course + session) carried in the share payload. */
  title: string;
  /** Resolved public image URLs, in slide order (unresolvable ones dropped). */
  urls: string[];
  /** How many referenced images couldn't be resolved on the server. */
  missing: number;
  /**
   * Best-effort slide metadata (identity + review flags) reconstructed from the
   * AutoSlides Index lecture data the Cloud Index webview already fetched while
   * browsing — captured client-side, no extra request. Null when the share isn't
   * indexed (e.g. a long `#fragment` paste). Threaded into the imported note's
   * `slides` group and the exported folder's metadata.json.
   */
  metadata?: SlideMetadata | null;
}

// ── AutoSlides Index (v2 read + removal) ───────────────────────────────────
// Shapes returned by the public Index Worker's /v2/api/{stats,search,lecture,
// request-removal} endpoints. Ported from share/apex/App.tsx (the website UI
// this native page replaces). Descriptive fields are optional — the index
// records identity best-effort.

/** A lecture summary from /v2/api/{search,lecture,stats}. */
export interface IndexLecture {
  courseId: string;
  sessionId: string;
  courseTitle?: string;
  sessionTitle?: string;
  instructor?: string;
  professors?: string[];
  semester?: string;
  schoolYear?: string;
  college?: string;
  weekNumber?: number;
  day?: number;
  versionCount?: number;
  updatedAt?: string;
}

/** One uploaded slide set of a lecture (from /v2/api/lecture). */
export interface IndexVersion {
  shareId: string;
  title?: string;
  imageCount?: number;
  reviewed: boolean;
  edited: boolean;
  createdAt?: string;
}

/** A recently-added FILE (version) from /v2/api/stats — opens at /v1/s/<shareId>. */
export interface IndexRecentFile {
  shareId: string;
  courseId: string;
  sessionId: string;
  courseTitle?: string;
  sessionTitle?: string;
  instructor?: string;
  professors?: string[];
  semester?: string;
  schoolYear?: string;
  college?: string;
  imageCount?: number;
  createdAt?: string;
}

/** Homepage aggregates from /v2/api/stats. */
export interface IndexStats {
  courseCount: number;
  lectureCount: number;
  versionCount: number;
  recent: IndexRecentFile[];
  colleges: { college: string; count: number }[];
  updatedAt?: string;
}

/** /v2/api/lecture response body (lecture + its versions). */
export interface IndexLectureDetail {
  lecture: IndexLecture;
  versions: IndexVersion[];
}

/** /v2/api/request-removal response body. */
export interface IndexRemovalResult {
  removed: number;
  lectureRemoved: boolean;
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

/** Uniform IPC envelope so the renderer can surface auth/network failures. */
export type NotesResult<T> = { ok: true; data: T } | { ok: false; error: string };

/** Max length of a note group name enforced by the server. */
export const NOTE_GROUP_NAME_MAX = 6;

/**
 * Name of the Yanhekt note group AutoSlides manages. Exactly 6 chars (the server
 * limit). Identification is name-based (groups carry no metadata field), so this
 * marker is the only thing that survives reinstalls / other machines.
 */
export const MANAGED_GROUP_NAME = 'ASnote';

/**
 * Title of the bootstrap README note. Kept language-independent and used both as
 * the display title and as the dedup key, so re-initializing under a different UI
 * language can't create a duplicate README.
 */
export const README_NOTE_TITLE = 'AutoSlides Cloud Storage README';

/** Editor.js library version stamped into documents we generate (matches the installed build). */
export const EDITORJS_DOC_VERSION = '2.26.5';

/** Whether a group is the AutoSlides-managed group (by reserved name). */
export function isManagedGroupName(name: string): boolean {
  return name === MANAGED_GROUP_NAME;
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
 * buildManagedNoteTitle. Non-managed titles are returned unchanged. Used by the
 * export flow to reconstruct the `slides_<displayName>` output folder.
 */
export function managedNoteDisplayName(title: string): string {
  return isManagedNoteTitle(title) ? title.slice(MANAGED_NOTE_PREFIX.length).trim() : title;
}
