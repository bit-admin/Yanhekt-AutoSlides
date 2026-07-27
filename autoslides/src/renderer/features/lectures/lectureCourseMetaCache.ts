// Shared course metadata hydrate for Lectures rename + Library.
// Dedupes in-flight getCourseInfo / lookupCourseById per courseId.

import { ApiClient } from '@shared/services/apiClient'
import { tokenManager } from '@shared/services/authService'
import { lookupCourseById } from '@features/course/lookupCourseById'
import { createLogger } from '@shared/utils/logger'

const log = createLogger('LectureCourseMetaCache')
const apiClient = new ApiClient()

export interface LectureCourseMetaSession {
  session_id: string
  title: string
  week_number?: number
  day?: number
  started_at?: string
}

export interface LectureCourseMeta {
  courseId: string
  title: string
  instructor?: string
  schoolYear?: string
  semester?: string | number
  college?: string
  classrooms?: string[]
  sessions: LectureCourseMetaSession[]
  /** True when we only have a filename-derived fallback (offline / error). */
  degraded: boolean
}

const cache = new Map<string, LectureCourseMeta>()
const inflight = new Map<string, Promise<LectureCourseMeta>>()

export function getCachedCourseMeta(courseId: string): LectureCourseMeta | undefined {
  return cache.get(String(courseId))
}

export function clearLectureCourseMetaCache(): void {
  cache.clear()
  inflight.clear()
}

function fallbackMeta(courseId: string, fallbackTitle?: string): LectureCourseMeta {
  return {
    courseId: String(courseId),
    title: fallbackTitle?.trim() || String(courseId),
    sessions: [],
    degraded: true,
  }
}

/**
 * Resolve course metadata. Uses memory cache + in-flight dedupe.
 * `fallbackTitle` is used when offline or the API fails.
 */
export async function getCourseMeta(
  courseId: string,
  fallbackTitle?: string,
): Promise<LectureCourseMeta> {
  const id = String(courseId)
  const hit = cache.get(id)
  if (hit && !hit.degraded) return hit

  const pending = inflight.get(id)
  if (pending) return pending

  const task = (async (): Promise<LectureCourseMeta> => {
    const token = tokenManager.getToken()
    if (!token) {
      const offline = fallbackMeta(id, fallbackTitle)
      // Keep a degraded entry so callers can still render stems; allow retry later
      // by not overwriting a good cache entry.
      if (!cache.has(id)) cache.set(id, offline)
      return cache.get(id) || offline
    }

    try {
      const [info, list] = await Promise.all([
        apiClient.getCourseInfo(id, token),
        lookupCourseById(token, id),
      ])
      const meta: LectureCourseMeta = {
        courseId: id,
        title: info.title || list?.title || fallbackTitle || id,
        instructor: info.professor || list?.instructor,
        schoolYear: info.school_year || list?.school_year,
        semester: info.semester ?? list?.semester,
        college: info.college_name || list?.college_name,
        classrooms: (list?.classrooms || []).map((c) => c.name).filter(Boolean),
        sessions: (info.videos || []).map((v) => ({
          session_id: String(v.session_id),
          title: v.title,
          week_number: v.week_number,
          day: v.day,
          started_at: v.started_at,
        })),
        degraded: false,
      }
      cache.set(id, meta)
      return meta
    } catch (error) {
      log.warn('Failed to hydrate course meta', id, error)
      const degraded = fallbackMeta(id, fallbackTitle || cache.get(id)?.title)
      if (!cache.has(id) || cache.get(id)?.degraded) {
        cache.set(id, degraded)
      }
      return cache.get(id) || degraded
    } finally {
      inflight.delete(id)
    }
  })()

  inflight.set(id, task)
  return task
}

/** Hydrate many courses; returns a Map (partial success OK). */
export async function hydrateCourseMetas(
  courseIds: string[],
  titleByCourseId?: Map<string, string>,
): Promise<Map<string, LectureCourseMeta>> {
  const unique = [...new Set(courseIds.map(String).filter(Boolean))]
  const results = await Promise.all(
    unique.map((id) => getCourseMeta(id, titleByCourseId?.get(id))),
  )
  const map = new Map<string, LectureCourseMeta>()
  for (const meta of results) {
    map.set(meta.courseId, meta)
  }
  return map
}
