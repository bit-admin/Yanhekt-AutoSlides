// Build Infuse-style Course → Session → {screen?, camera?} tree from flat
// LectureVideoItem listings. Library shows recognised files only.

import {
  episodeIndexForSession,
  formatEpisodeToken,
  formatSemesterToken,
  type LectureCompressPresetTag,
  type LectureVideoType,
} from '@common/lectureVideoNaming'
import type { LectureVideoItem } from './useLecturesPage'
import type { LectureCourseMeta } from './lectureCourseMetaCache'

export interface LibraryFileRef {
  path: string
  name: string
  size: number
  mtimeMs: number
  videoType: LectureVideoType
  compressPreset?: LectureCompressPresetTag
  displayName: string
  hasEmbyTags: boolean
}

export interface LibrarySession {
  sessionId: string
  title: string
  episode: number | null
  weekNumber?: number | null
  day?: number | null
  startedAt?: string | null
  screen?: LibraryFileRef
  camera?: LibraryFileRef
  videoId?: string
  duration?: number
  /** Yanhekt camera (main) HLS URL — used when the camera file is not on disk. */
  mainUrl?: string
  /** Yanhekt screen (vga) HLS URL — used when the screen file is not on disk. */
  vgaUrl?: string
  /** Prefer screen path for poster generation. */
  posterSourcePath?: string
}

export interface LibraryCourse {
  courseId: string
  title: string
  instructor?: string
  schoolYear?: string
  semester?: string | number
  college?: string
  classrooms?: string[]
  sessions: LibrarySession[]
  /** First usable poster source among sessions. */
  posterSourcePath?: string
  episodeCount: number
  fileCount: number
  /** Sessions that have both screen and camera. */
  dualCount: number
}

export type LocalStreamMode = 'dual' | 'screen' | 'camera'

export interface LibraryPlayerTarget {
  courseId: string
  sessionId: string
  streamMode: LocalStreamMode
}

function toFileRef(item: LectureVideoItem, videoType: LectureVideoType): LibraryFileRef {
  return {
    path: item.path,
    name: item.name,
    size: item.size,
    mtimeMs: item.mtimeMs,
    videoType,
    compressPreset: item.compressPreset,
    displayName: item.displayName,
    hasEmbyTags: item.hasEmbyTags,
  }
}

/**
 * Prefer the better of two same-type files: newer mtime wins; Emby-tagged
 * names beat legacy on a mtime tie.
 */
function pickBetter(a: LibraryFileRef, b: LibraryFileRef): LibraryFileRef {
  if (b.mtimeMs !== a.mtimeMs) return b.mtimeMs > a.mtimeMs ? b : a
  if (b.hasEmbyTags !== a.hasEmbyTags) return b.hasEmbyTags ? b : a
  return b
}

function courseLabelFromItem(item: LectureVideoItem): string {
  const d = item.displayName
  const se = d.match(/^(.+?)\s+-\s+S\d{2}/)
  if (se) return se[1].trim()
  const legacy = d.match(/^(.+?)_第\d+周/)
  if (legacy) return legacy[1].replace(/_/g, ' ').trim()
  const dash = d.split(' - ')[0]
  return (dash || d || item.name).trim()
}

function sessionLabelFromItem(item: LectureVideoItem): string {
  // Emby: "Course - S01E01 - Session Title"
  const parts = item.displayName.split(' - ')
  if (parts.length >= 3) return parts.slice(2).join(' - ').trim()
  if (parts.length === 2 && !/^S\d{2}/i.test(parts[1])) return parts[1].trim()
  // Legacy stripped: often "Course_第1周_…"
  const legacy = item.displayName.replace(/^[^_]+_/, '')
  return legacy || item.displayName
}

export function defaultStreamMode(session: LibrarySession): LocalStreamMode {
  if (session.screen && session.camera) return 'dual'
  if (session.screen) return 'screen'
  return 'camera'
}

export function sessionHasDual(session: LibrarySession): boolean {
  return Boolean(session.screen && session.camera)
}

/** Alias: both screen and camera files are on disk. */
export function sessionHasLocalDual(session: LibrarySession): boolean {
  return sessionHasDual(session)
}

/**
 * Which stream would be fetched online in hybrid dual.
 * Null when both files are local, or the complementary Yanhekt URL is missing.
 */
export function hybridOnlineKind(session: LibrarySession): 'camera' | 'screen' | null {
  if (session.screen && session.camera) return null
  if (session.screen && session.mainUrl) return 'camera'
  if (session.camera && session.vgaUrl) return 'screen'
  return null
}

export function canHybridDual(session: LibrarySession): boolean {
  return hybridOnlineKind(session) != null
}

export function canShowDual(session: LibrarySession): boolean {
  return sessionHasDual(session) || canHybridDual(session)
}

export function formatSessionSubtitle(session: LibrarySession, semester?: string | number): string {
  const se = [formatSemesterToken(semester), formatEpisodeToken(session.episode)]
    .filter(Boolean)
    .join('')
  if (se && session.title) return `${se} · ${session.title}`
  if (se) return se
  return session.title
}

/**
 * Build library courses from a flat video list + optional per-course API meta.
 */
export function buildLibraryCourses(
  items: LectureVideoItem[],
  metaByCourse: Map<string, LectureCourseMeta> = new Map(),
): LibraryCourse[] {
  const recognised = items.filter((v) => v.recognised && v.courseId && v.sessionId)

  // courseId -> sessionId -> files
  type SessionBucket = {
    sessionId: string
    screen?: LibraryFileRef
    camera?: LibraryFileRef
    fallbackTitle: string
  }
  const courseMap = new Map<string, { fallbackTitle: string; sessions: Map<string, SessionBucket> }>()

  for (const item of recognised) {
    const courseId = item.courseId!
    const sessionId = item.sessionId!
    let course = courseMap.get(courseId)
    if (!course) {
      course = { fallbackTitle: courseLabelFromItem(item), sessions: new Map() }
      courseMap.set(courseId, course)
    }

    let session = course.sessions.get(sessionId)
    if (!session) {
      session = {
        sessionId,
        fallbackTitle: sessionLabelFromItem(item),
      }
      course.sessions.set(sessionId, session)
    }

    const type = item.videoType
    if (type === 'screen' || type === 'camera') {
      const ref = toFileRef(item, type)
      const existing = session[type]
      session[type] = existing ? pickBetter(existing, ref) : ref
    } else if (!session.screen && !session.camera) {
      // Recognised but missing type — treat as screen so it remains playable.
      session.screen = toFileRef(item, 'screen')
    }
  }

  const courses: LibraryCourse[] = []

  for (const [courseId, bucket] of courseMap) {
    const meta = metaByCourse.get(courseId)
    const sessions: LibrarySession[] = []

    for (const sess of bucket.sessions.values()) {
      if (!sess.screen && !sess.camera) continue

      const metaSession = meta?.sessions.find((s) => String(s.session_id) === String(sess.sessionId))
      const episode = meta
        ? episodeIndexForSession(meta.sessions, sess.sessionId)
        : null

      const session: LibrarySession = {
        sessionId: sess.sessionId,
        title: metaSession?.title || sess.fallbackTitle,
        episode,
        weekNumber: metaSession?.week_number,
        day: metaSession?.day,
        startedAt: metaSession?.started_at,
        screen: sess.screen,
        camera: sess.camera,
        videoId: metaSession?.video_id,
        duration: metaSession?.duration,
        mainUrl: metaSession?.mainUrl,
        vgaUrl: metaSession?.vgaUrl,
        posterSourcePath: sess.screen?.path || sess.camera?.path,
      }
      sessions.push(session)
    }

    // Sort by episode index when known, else by week/day/startedAt/title.
    sessions.sort((a, b) => {
      if (a.episode != null && b.episode != null && a.episode !== b.episode) {
        return a.episode - b.episode
      }
      if (a.episode != null && b.episode == null) return -1
      if (a.episode == null && b.episode != null) return 1
      const w = (a.weekNumber ?? 0) - (b.weekNumber ?? 0)
      if (w !== 0) return w
      const d = (a.day ?? 0) - (b.day ?? 0)
      if (d !== 0) return d
      const sa = a.startedAt || ''
      const sb = b.startedAt || ''
      if (sa !== sb) return sa < sb ? -1 : 1
      return a.title.localeCompare(b.title, 'zh')
    })

    let fileCount = 0
    let dualCount = 0
    for (const s of sessions) {
      if (s.screen) fileCount += 1
      if (s.camera) fileCount += 1
      if (s.screen && s.camera) dualCount += 1
    }

    courses.push({
      courseId,
      title: meta?.title || bucket.fallbackTitle || courseId,
      instructor: meta?.instructor,
      schoolYear: meta?.schoolYear,
      semester: meta?.semester,
      college: meta?.college,
      classrooms: meta?.classrooms,
      sessions,
      posterSourcePath: sessions.find((s) => s.posterSourcePath)?.posterSourcePath,
      episodeCount: sessions.length,
      fileCount,
      dualCount,
    })
  }

  courses.sort((a, b) => a.title.localeCompare(b.title, 'zh'))
  return courses
}

export function findLibrarySession(
  courses: LibraryCourse[],
  courseId: string,
  sessionId: string,
): { course: LibraryCourse; session: LibrarySession } | null {
  const course = courses.find((c) => c.courseId === courseId)
  if (!course) return null
  const session = course.sessions.find((s) => s.sessionId === sessionId)
  if (!session) return null
  return { course, session }
}

/** Human semester label: "S01" / "1" → "S01". Empty when unknown. */
export function formatLibrarySemester(semester?: string | number | null): string {
  return formatSemesterToken(semester)
}

/** Compact file size for episode cards. */
export function formatLibraryBytes(n: number): string {
  if (!Number.isFinite(n) || n < 0) return '—'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let v = n
  let i = 0
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024
    i += 1
  }
  return `${v < 10 && i > 0 ? v.toFixed(1) : Math.round(v)}${units[i]}`
}

/**
 * Format session date from Yanhekt `started_at` (often `YYYY-MM-DD HH:mm:ss`).
 * Falls back to week/day when no timestamp.
 */
export function formatSessionDate(
  session: LibrarySession,
  dayNames?: string[],
): string {
  if (session.startedAt) {
    // Accept "2025-09-17 09:54:20" or ISO.
    const raw = session.startedAt.trim().replace(' ', 'T')
    const d = new Date(raw)
    if (!Number.isNaN(d.getTime())) {
      const y = d.getFullYear()
      const m = String(d.getMonth() + 1).padStart(2, '0')
      const day = String(d.getDate()).padStart(2, '0')
      return `${y}-${m}-${day}`
    }
    // Already a short date prefix?
    const m = session.startedAt.match(/^(\d{4}-\d{2}-\d{2})/)
    if (m) return m[1]
  }
  const parts: string[] = []
  if (session.weekNumber != null && session.weekNumber > 0) {
    parts.push(`W${session.weekNumber}`)
  }
  if (session.day != null && session.day > 0) {
    const names = dayNames || []
    parts.push(names[session.day] || `D${session.day}`)
  }
  return parts.join(' · ')
}

/** Total bytes of screen+camera files on a session. */
export function sessionTotalBytes(session: LibrarySession): number {
  return (session.screen?.size || 0) + (session.camera?.size || 0)
}
