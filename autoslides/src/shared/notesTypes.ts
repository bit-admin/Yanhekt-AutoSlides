/**
 * Yanhekt cloud-note API types (cbiz.yanhekt.cn/v1/note*).
 * Shared across the main process (notesService), the preload bridge, and the
 * renderer (useCloudNotes / CloudNotesTab). Imported via `@common/notesTypes`.
 */

import type { SlideMetadata } from './slideMetadataTypes';
import type { SlideTimeline } from './sidecars/timeline';

import {
  formatLectureToken,
  parseLectureIds,
  parseLectureToken,
  stripLectureIds,
  type LectureIdentity,
} from './lectureNaming';

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

/**
 * Yanhekt titles hydrated by the share Worker (`/v1/api/get` or `/v1/api/meta`).
 * Used to rebuild a managed note title / on-disk folder stem after v2 payloads
 * dropped the human `t` field.
 */
export interface ShareLectureMeta {
  courseTitle?: string;
  sessionTitle?: string;
  instructor?: string;
  professors?: string[];
  college?: string;
  schoolYear?: string;
  semester?: string;
}

/** Result of resolving a pasted share link into importable image URLs. */
export interface ShareImportResult {
  /** Managed note title (`c…s… · course · session`) after Yanhekt hydration. */
  title: string;
  /** Identity recorded in the share payload (may be empty for untitled captures). */
  identity?: LectureIdentity;
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
  /** Course/session titles + byline fields from Yanhekt (or the Index lecture). */
  lectureMeta?: ShareLectureMeta | null;
  /** Reconstructed timeline.json from a v3 share payload, if present. */
  timeline?: SlideTimeline | null;
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
  /** True when this version's share payload embeds a v3 slide timeline. */
  hasTimeline?: boolean;
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
  /** Yanhekt semester tags, cron-copied from /v1/tag/list into stats:home. */
  semesters?: Array<{
    id: number;
    label: string;
    schoolYear?: number;
    semester?: number;
    labelEn?: string;
  }>;
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
 * Name of the second AutoSlides-managed group, holding personal "watch mode"
 * captures (slides grabbed while watching a live stream or a recorded session).
 * Exactly 6 chars (the server limit), same identification rules as ASnote.
 * Notes here are exported (PDF/Markdown/DOCX), never published to the Index.
 */
export const USER_GROUP_NAME = 'ASuser';

/**
 * Title of the bootstrap README note. Kept language-independent and used both as
 * the display title and as the dedup key, so re-initializing under a different UI
 * language can't create a duplicate README.
 */
export const README_NOTE_TITLE = 'AutoSlides Cloud Storage README';

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

/** Client-side reasons a new group/folder name cannot be submitted. */
export type NoteGroupNameError = 'empty' | 'tooLong' | 'reserved' | 'duplicate' | 'invalidChars';

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
  if (lower === MANAGED_GROUP_NAME.toLowerCase() || lower === USER_GROUP_NAME.toLowerCase()) {
    return 'reserved';
  }
  for (const existing of existingNames) {
    if (existing.toLowerCase() === lower) return 'duplicate';
  }
  return null;
}

/** i18n keys for friendly UI names. Server group names stay ASnote / ASuser. */
export const MANAGED_GROUP_LABEL_KEY = 'cloudNotes.managedGroupAsnote';
export const USER_GROUP_LABEL_KEY = 'cloudNotes.managedGroupAsuser';

/**
 * Drive / Notes label for a group. Maps reserved server names to localized
 * titles (AutoSlides Database, Watch Notes); anything else is returned as-is.
 */
export function formatGroupDisplayName(
  name: string,
  translate: (key: string) => string,
): string {
  if (isManagedGroupName(name)) return translate(MANAGED_GROUP_LABEL_KEY);
  if (isUserGroupName(name)) return translate(USER_GROUP_LABEL_KEY);
  return name;
}

/**
 * Settings card title: friendly name plus the raw server identifier, e.g.
 * `AutoSlides Database (ASnote)`. Non-managed names are unchanged.
 */
export function formatGroupSettingsTitle(
  name: string,
  translate: (key: string) => string,
): string {
  if (!isAutoSlidesGroupName(name)) return name;
  return `${formatGroupDisplayName(name, translate)} (${name})`;
}

/** Label for a note-group row or <option>, including the Ungrouped sentinel. */
export function formatNoteGroupLabel(
  group: { id: number; name: string },
  translate: (key: string) => string,
  ungroupedKey = 'cloudNotes.defaultGroup',
): string {
  if (group.id === 0) return translate(ungroupedKey);
  return formatGroupDisplayName(group.name, translate) || translate(ungroupedKey);
}

/**
 * @deprecated Titles no longer use an `AS ·` prefix (id token is first). Kept so
 * callers that still mention the constant compile; do not emit this on new notes.
 */
export const MANAGED_NOTE_PREFIX = 'AS ·';

const MANAGED_TOKEN_AT_START = /^(?:c\d+(?:s\d+|l\d+)?|l\d+)(?:\s*·|$)/;

/**
 * Split a folder-style display name (`泛函分析_第1周_星期三_第2大节` or
 * `Real Analysis - Lecture 11`) into course + session for the note title.
 */
export function splitNoteDisplayName(displayName: string): { course: string; session: string } {
  const stripped = stripLectureIds(displayName.replace(/^AS ·\s*/, '')).trim();
  const name = stripped.startsWith('slides_') ? stripped.slice('slides_'.length) : stripped;

  const zh = name.match(/^(.+)_第(\d+)周_星期([一二三四五六日])_第(\d+)大节$/);
  if (zh) {
    return { course: zh[1].replace(/_/g, ' '), session: `第${zh[2]}周 星期${zh[3]} 第${zh[4]}大节` };
  }
  const en = name.match(/^(.+) - Lecture (\d+)$/);
  if (en) return { course: en[1].trim(), session: `Lecture ${en[2]}` };

  const parts = name.split(' · ').map((part) => part.trim()).filter(Boolean);
  if (parts.length >= 2 && /^(?:c\d+(?:s\d+|l\d+)?|l\d+)$/.test(parts[0])) {
    return { course: parts[1] ?? '', session: parts.slice(2).join(' · ') };
  }
  if (parts.length >= 2) return { course: parts[0], session: parts.slice(1).join(' · ') };
  return { course: name.replace(/_/g, ' '), session: '' };
}

/**
 * Managed note title. Recorded: `c62313s751843 · 泛函分析 · 第1周 星期三 第2大节`.
 * Live: `c71736l761952 · <course> · <section>`. The leading token is the dedup
 * key (list endpoint returns titles, not content). Missing identity degrades to
 * the human parts only (web-capture / offline).
 */
export function buildManagedNoteTitle(displayName: string, identity: LectureIdentity = {}): string {
  const token = formatLectureToken(identity);
  const { course, session } = splitNoteDisplayName(displayName);
  const coursePart = token && course === token ? '' : course;
  return [token, coursePart, session].filter(Boolean).join(' · ');
}

/** Whether a note title was produced by AutoSlides (leading id token). */
export function isManagedNoteTitle(title: string): boolean {
  const trimmed = title.trim();
  return MANAGED_TOKEN_AT_START.test(trimmed) || trimmed.startsWith(MANAGED_NOTE_PREFIX);
}

/**
 * Sidebar/list label for a note. In AutoSlides-managed groups the leading
 * lecture token (`c61838s751030 · `) is a server-side dedup key, not a human
 * title — strip it for display the same way reserved group names are mapped
 * to friendly labels. Stored titles stay intact. Token-only titles (no
 * course/session remainder) keep the token so the row is not blank.
 */
export function formatNoteDisplayTitle(title: string, managed = false): string {
  const trimmed = (title ?? '').trim();
  if (!managed || !trimmed) return trimmed;
  let rest = trimmed;
  if (MANAGED_TOKEN_AT_START.test(rest)) {
    rest = rest.replace(MANAGED_TOKEN_AT_START, '').replace(/^\s*·\s*/, '').trim();
  } else if (rest.startsWith(MANAGED_NOTE_PREFIX)) {
    rest = rest.slice(MANAGED_NOTE_PREFIX.length).trim();
  }
  return rest || trimmed;
}

/**
 * Folder-stem inverse of `buildManagedNoteTitle` for export: underscores, no
 * token. `c62313s751843 · 泛函分析 · 第1周 星期三 第2大节` →
 * `泛函分析_第1周_星期三_第2大节`.
 */
export function managedNoteDisplayName(title: string): string {
  const trimmed = title.trim();
  const token = parseLectureToken(trimmed);
  let rest = trimmed;
  if (token.courseId || token.liveId) {
    rest = trimmed.replace(MANAGED_TOKEN_AT_START, '').replace(/^\s*·\s*/, '').trim();
  } else if (trimmed.startsWith(MANAGED_NOTE_PREFIX)) {
    rest = stripLectureIds(trimmed.slice(MANAGED_NOTE_PREFIX.length).trim());
  } else {
    rest = stripLectureIds(trimmed);
  }
  const { course, session } = splitNoteDisplayName(rest);
  if (session.startsWith('Lecture ')) return session ? `${course} - ${session}` : course;
  if (session) return `${course.replace(/\s+/g, '_')}_${session.replace(/\s+/g, '_')}`;
  return course.replace(/\s+/g, '_');
}

/** The lecture identity embedded in a managed note title, if any. */
export function managedNoteIdentity(title: string): LectureIdentity {
  const fromToken = parseLectureToken(title);
  if (fromToken.courseId || fromToken.liveId) return fromToken;
  return parseLectureIds(title);
}

/**
 * Managed title from Yanhekt-hydrated names + payload ids.
 * `操作系统` + `第1周 星期二 第5大节` + c61841/s751112 →
 * `c61841s751112 · 操作系统 · 第1周 星期二 第5大节`.
 */
export function buildShareImportTitle(
  identity: LectureIdentity,
  meta?: ShareLectureMeta | null,
): string {
  const display = [meta?.courseTitle?.trim(), meta?.sessionTitle?.trim()].filter(Boolean).join(' · ');
  return buildManagedNoteTitle(display, identity);
}

/**
 * Folder stem for a resolved share: prefer hydrated course/session titles,
 * else invert the managed title. Token-only titles (meta missing) yield ''.
 */
export function shareImportDisplayName(result: {
  title: string;
  identity?: LectureIdentity;
  lectureMeta?: ShareLectureMeta | null;
}): string {
  const meta = result.lectureMeta;
  if (meta?.courseTitle || meta?.sessionTitle) {
    return managedNoteDisplayName(buildShareImportTitle(result.identity ?? {}, meta));
  }
  return managedNoteDisplayName(result.title);
}
