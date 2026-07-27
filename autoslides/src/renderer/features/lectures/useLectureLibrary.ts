// Library browse state for Lectures: courses → episodes → player target.
// Session-only (not AppConfig). Metadata hydrate is best-effort.

import { computed, ref, shallowRef, watch, type Ref } from 'vue'
import {
  buildLibraryCourses,
  defaultStreamMode,
  findLibrarySession,
  type LibraryCourse,
  type LibraryPlayerTarget,
  type LibrarySession,
  type LocalStreamMode,
} from './libraryModel'
import {
  hydrateCourseMetas,
  type LectureCourseMeta,
} from './lectureCourseMetaCache'
import type { LectureVideoItem } from './useLecturesPage'
import { createLogger } from '@shared/utils/logger'

const log = createLogger('LectureLibrary')

export type LibraryBrowseLevel = 'courses' | 'course'

export function useLectureLibrary(videos: Ref<LectureVideoItem[]>) {
  const browseLevel = ref<LibraryBrowseLevel>('courses')
  const activeCourseId = ref<string | null>(null)
  const playerTarget = ref<LibraryPlayerTarget | null>(null)
  const metaByCourse = shallowRef(new Map<string, LectureCourseMeta>())
  const isHydrating = ref(false)
  const posters = ref<Record<string, string>>({})
  const posterInFlight = new Set<string>()

  const courses = computed<LibraryCourse[]>(() =>
    buildLibraryCourses(videos.value, metaByCourse.value),
  )

  const activeCourse = computed(() =>
    activeCourseId.value
      ? courses.value.find((c) => c.courseId === activeCourseId.value) || null
      : null,
  )

  const activePlayerSession = computed(() => {
    const t = playerTarget.value
    if (!t) return null
    return findLibrarySession(courses.value, t.courseId, t.sessionId)
  })

  const hydrate = async () => {
    const recognised = videos.value.filter((v) => v.recognised && v.courseId)
    const ids = [...new Set(recognised.map((v) => v.courseId!))]
    if (ids.length === 0) {
      metaByCourse.value = new Map()
      return
    }

    isHydrating.value = true
    try {
      const titleBy = new Map<string, string>()
      for (const c of buildLibraryCourses(videos.value, new Map())) {
        titleBy.set(c.courseId, c.title)
      }
      metaByCourse.value = await hydrateCourseMetas(ids, titleBy)
    } catch (error) {
      log.warn('Library meta hydrate failed', error)
    } finally {
      isHydrating.value = false
    }
  }

  watch(
    videos,
    () => {
      void hydrate()
    },
    { deep: false },
  )

  const openCourses = () => {
    browseLevel.value = 'courses'
    activeCourseId.value = null
    playerTarget.value = null
  }

  const openCourse = (courseId: string) => {
    activeCourseId.value = courseId
    browseLevel.value = 'course'
    playerTarget.value = null
  }

  const openPlayer = (courseId: string, session: LibrarySession, mode?: LocalStreamMode) => {
    playerTarget.value = {
      courseId,
      sessionId: session.sessionId,
      streamMode: mode || defaultStreamMode(session),
    }
  }

  const closePlayer = () => {
    playerTarget.value = null
  }

  const loadPoster = async (filePath: string | undefined | null) => {
    if (!filePath) return
    if (posters.value[filePath] || posterInFlight.has(filePath)) return
    posterInFlight.add(filePath)
    try {
      const dataUrl = await window.electronAPI.lectures.getPoster(filePath)
      if (dataUrl) {
        posters.value = { ...posters.value, [filePath]: dataUrl }
      }
    } catch (error) {
      log.warn('Poster load failed', filePath, error)
    } finally {
      posterInFlight.delete(filePath)
    }
  }

  return {
    browseLevel,
    activeCourseId,
    playerTarget,
    courses,
    activeCourse,
    activePlayerSession,
    isHydrating,
    posters,
    openCourses,
    openCourse,
    openPlayer,
    closePlayer,
    loadPoster,
    hydrate,
  }
}
