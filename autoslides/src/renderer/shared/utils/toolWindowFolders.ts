// Folder and image display helpers for the results/PDF folder lists.
//
// The name *parsing* primitives live in @common/lectureNaming so the main
// process (coverFontService) shares one implementation; this module keeps the
// renderer-side sorting and grouping built on top of them.
import {
  formatLectureDisplayName,
  parseLectureIds,
  parseSessionInfo,
} from '@common/lectureNaming'
import type { SlideMetadata } from '@common/slideMetadataTypes'

export interface CourseGroupFolder {
  name: string
  metadata?: SlideMetadata | null
}

/** Strip the `slides_` prefix and the id block — the only way a name is shown. */
export function formatToolFolderName(name: string): string {
  return formatLectureDisplayName(name)
}

/**
 * Course-level display name parsed out of a folder name: folders with a session
 * pattern collapse to their course name so sessions of one course share a
 * group; folders without one fall back to their formatted name.
 *
 * Display only — `getCourseKey` decides grouping, because two distinct courses
 * can share a title and only the id tells them apart.
 */
function parsedCourseName(folderName: string): string {
  return parseSessionInfo(folderName)?.courseName ?? formatToolFolderName(folderName)
}

/**
 * Stable grouping key for a folder, most reliable source first:
 *   1. the course id embedded in the name (every folder created since the
 *      naming refactor),
 *   2. `metadata.json`'s course id (cloud-note/share exports, whose names come
 *      from a note title rather than a lecture),
 *   3. the course name parsed out of the name — the legacy path, and the only
 *      one available for folders created by <= v4.4.1.
 *
 * Keying on the id is what stops two same-titled courses from merging into one
 * group in the folder list.
 */
export function getCourseKey(folder: CourseGroupFolder): string {
  const embedded = parseLectureIds(folder.name).courseId
  if (embedded) return `id:${embedded}`

  const fromMetadata = folder.metadata?.source?.courseId
  if (fromMetadata) return `id:${fromMetadata}`

  return `name:${parsedCourseName(folder.name)}`
}

/** Human label for a course group, preferring the recorded title over the parsed one. */
export function getCourseLabel(folder: CourseGroupFolder): string {
  return folder.metadata?.source?.courseTitle || parsedCourseName(folder.name)
}

/** The course id behind a folder, for display as secondary text. */
export function getCourseId(folder: CourseGroupFolder): string | undefined {
  return parseLectureIds(folder.name).courseId ?? folder.metadata?.source?.courseId
}

/** The session id behind a folder, for display as secondary text. */
export function getSessionId(folder: CourseGroupFolder): string | undefined {
  return parseLectureIds(folder.name).sessionId ?? folder.metadata?.source?.sessionId
}

/**
 * The live (broadcast) id behind a folder. Deliberately NOT part of
 * `getCourseKey`: a live id identifies one broadcast, so keying on it would put
 * every broadcast of a course in its own group. Live folders group by title.
 */
export function getLiveId(folder: CourseGroupFolder): string | undefined {
  return parseLectureIds(folder.name).liveId ?? folder.metadata?.source?.liveId
}

/** Compare two folder names within one course, with Chinese natural sorting. */
function compareFolderNames(a: string, b: string): number {
  const infoA = parseSessionInfo(a)
  const infoB = parseSessionInfo(b)

  if (infoA && infoB) {
    const courseCompare = infoA.courseName.localeCompare(infoB.courseName, 'zh')
    if (courseCompare !== 0) return courseCompare
    if (infoA.week !== infoB.week) return infoA.week - infoB.week
    if (infoA.weekday !== infoB.weekday) return infoA.weekday - infoB.weekday
    return infoA.session - infoB.session
  }

  if (infoA && !infoB) return -1
  if (!infoA && infoB) return 1

  return a.localeCompare(b, 'zh')
}

/**
 * Sort folders so that each course's folders are contiguous, which is what the
 * grouped folder list needs to emit one header per course.
 *
 * Ordering by parsed course *name* alone would interleave two same-titled
 * courses and produce alternating headers, so equal labels are broken by the
 * course key.
 */
export function compareToolFolderEntries(a: CourseGroupFolder, b: CourseGroupFolder): number {
  const keyA = getCourseKey(a)
  const keyB = getCourseKey(b)

  if (keyA !== keyB) {
    const labelCompare = getCourseLabel(a).localeCompare(getCourseLabel(b), 'zh')
    if (labelCompare !== 0) return labelCompare
    return keyA.localeCompare(keyB)
  }

  return compareFolderNames(a.name, b.name)
}

export function compareToolImages(a: string, b: string): number {
  return a.localeCompare(b, undefined, {
    numeric: true,
    sensitivity: 'base',
  })
}
