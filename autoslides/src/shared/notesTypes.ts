/** Desktop sharing bridge types and lecture naming shared with Obsidian. */

import type { SlideTimeline } from './sidecars/timeline';

import {
  formatLectureToken,
  parseLectureToken,
  stripLectureIds,
  type LectureIdentity,
} from './lectureNaming';

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
  /** Course/session titles + byline fields from Yanhekt. */
  lectureMeta?: ShareLectureMeta | null;
  /** Reconstructed timeline.json from a v3 share payload, if present. */
  timeline?: SlideTimeline | null;
}

/** Uniform IPC envelope so the renderer can surface auth/network failures. */
export type NotesResult<T> = { ok: true; data: T } | { ok: false; error: string };

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
 * Managed note title. Recorded: `c70101s850101 · 泛函分析 · 第1周 星期三 第2大节`.
 * Live: `c71001l760952 · <course> · <section>`. Missing identity degrades to
 * the human parts only (web-capture / offline).
 */
export function buildManagedNoteTitle(displayName: string, identity: LectureIdentity = {}): string {
  const token = formatLectureToken(identity);
  const { course, session } = splitNoteDisplayName(displayName);
  const coursePart = token && course === token ? '' : course;
  return [token, coursePart, session].filter(Boolean).join(' · ');
}

/**
 * Folder-stem inverse of `buildManagedNoteTitle` for export: underscores, no
 * token. `c70101s850101 · 泛函分析 · 第1周 星期三 第2大节` →
 * `泛函分析_第1周_星期三_第2大节`.
 */
export function managedNoteDisplayName(title: string): string {
  const trimmed = title.trim();
  const token = parseLectureToken(trimmed);
  let rest = trimmed;
  if (token.courseId || token.liveId) {
    rest = trimmed.replace(MANAGED_TOKEN_AT_START, '').replace(/^\s*·\s*/, '').trim();
  } else if (trimmed.startsWith('AS ·')) {
    rest = stripLectureIds(trimmed.slice('AS ·'.length).trim());
  } else {
    rest = stripLectureIds(trimmed);
  }
  const { course, session } = splitNoteDisplayName(rest);
  if (session.startsWith('Lecture ')) return session ? `${course} - ${session}` : course;
  if (session) return `${course.replace(/\s+/g, '_')}_${session.replace(/\s+/g, '_')}`;
  return course.replace(/\s+/g, '_');
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
