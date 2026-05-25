// Shared folder and image naming helpers for the tools window.

// Chinese weekday mapping for sorting (Monday = 1, Sunday = 7)
const WEEKDAY_ORDER: Record<string, number> = {
  '一': 1,
  '二': 2,
  '三': 3,
  '四': 4,
  '五': 5,
  '六': 6,
  '日': 7,
}

interface ParsedSessionInfo {
  courseName: string
  week: number
  weekday: number
  session: number
}

/**
 * Parse session info from folder name.
 * Pattern: slides_<courseName>_第N周_星期X_第N大节
 * Note: courseName may contain underscores.
 */
export function parseSessionInfo(folderName: string): ParsedSessionInfo | null {
  const name = folderName.startsWith('slides_') ? folderName.slice(7) : folderName
  const sessionPattern = /^(.+)_第(\d+)周_星期([一二三四五六日])_第(\d+)大节$/
  const match = name.match(sessionPattern)

  if (!match) return null

  return {
    courseName: match[1],
    week: parseInt(match[2], 10),
    weekday: WEEKDAY_ORDER[match[3]] || 0,
    session: parseInt(match[4], 10),
  }
}

/**
 * Compare two folder names with Chinese natural sorting.
 */
export function compareToolFolders(a: string, b: string): number {
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

export function formatToolFolderName(name: string): string {
  return name.startsWith('slides_') ? name.slice(7) : name
}

/**
 * Extract a course-level grouping key from a folder name.
 *
 * Folders with a session pattern collapse to their parsed courseName so
 * sessions of the same course share one group; folders without a session
 * pattern fall back to their formatted name, becoming a single-folder group.
 */
export function getCourseName(folderName: string): string {
  const info = parseSessionInfo(folderName)
  if (info) return info.courseName
  return formatToolFolderName(folderName)
}

export type FolderCourseRow<T extends { name: string }> =
  | { type: 'header'; courseName: string; folderNames: string[] }
  | { type: 'folder'; folder: T; index: number }

/**
 * Build a render-ready row sequence for grouped folder display.
 * Each header row carries the names of the folders in its group so callers
 * can wire "select all in course" actions without re-deriving the grouping.
 */
export function buildFolderCourseRows<T extends { name: string }>(
  folders: T[],
): FolderCourseRow<T>[] {
  const rows: FolderCourseRow<T>[] = []
  let prevCourse: string | null = null
  let currentHeader: { type: 'header'; courseName: string; folderNames: string[] } | null = null

  folders.forEach((folder, index) => {
    const courseName = getCourseName(folder.name)
    if (courseName !== prevCourse) {
      currentHeader = { type: 'header', courseName, folderNames: [] }
      rows.push(currentHeader)
      prevCourse = courseName
    }
    currentHeader!.folderNames.push(folder.name)
    rows.push({ type: 'folder', folder, index })
  })

  return rows
}

export function compareToolImages(a: string, b: string): number {
  return a.localeCompare(b, undefined, {
    numeric: true,
    sensitivity: 'base',
  })
}

