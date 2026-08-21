// Library browse state for Lectures: courses → episodes → player target.
// Session-only (not AppConfig). Metadata hydrate is best-effort.

import { computed, ref, shallowRef, watch, type Ref } from 'vue'
import {
  buildLibraryCourses,
  defaultStreamMode,
  findLibrarySession,
  slideSeedFromFolder,
  type LibraryCourse,
  type LibraryPlayerTarget,
  type LibrarySession,
  type LibrarySlideSeed,
  type LocalStreamMode,
} from './libraryModel'
import {
  hydrateCourseMetas,
  type LectureCourseMeta,
} from './lectureCourseMetaCache'
import type { LectureVideoItem } from './useLecturesPage'
import { overrides } from '@shared/overrideRegistry'
import { getTimeline } from '@shared/services/slideTimelineClient'
import { createLogger } from '@shared/utils/logger'

const log = createLogger('LectureLibrary')

export type LibraryBrowseLevel = 'courses' | 'course'

export function useLectureLibrary(videos: Ref<LectureVideoItem[]>) {
  const browseLevel = ref<LibraryBrowseLevel>('courses')
  const activeCourseId = ref<string | null>(null)
  const playerTarget = ref<LibraryPlayerTarget | null>(null)
  const metaByCourse = shallowRef(new Map<string, LectureCourseMeta>())
  const slideSeeds = shallowRef<LibrarySlideSeed[]>([])
  const isHydrating = ref(false)
  const isDiscoveringSlides = ref(true)
  const posters = ref<Record<string, string>>({})
  const posterInFlight = new Set<string>()

  const courses = computed<LibraryCourse[]>(() =>
    buildLibraryCourses(videos.value, metaByCourse.value, slideSeeds.value),
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

  const loadSlideSeeds = async () => {
    isDiscoveringSlides.value = true
    try {
      const folders = overrides.resultsProvider
        ? await overrides.resultsProvider.getFolders()
        : await window.electronAPI.pdfmaker.getFolders()
      const candidates = folders
        .map((folder) => slideSeedFromFolder(folder))
        .filter((seed): seed is LibrarySlideSeed => seed != null)
      const checked = await Promise.all(
        candidates.map(async (seed) => {
          const timeline = await getTimeline(seed.folderPath)
          return timeline ? seed : null
        }),
      )
      slideSeeds.value = checked.filter((seed): seed is LibrarySlideSeed => seed != null)
    } catch (error) {
      log.warn('Library slide discovery failed', error)
      slideSeeds.value = []
    } finally {
      isDiscoveringSlides.value = false
    }
  }

  const hydrate = async () => {
    await loadSlideSeeds()
    const videoIds = videos.value
      .filter((v) => v.recognised && v.courseId)
      .map((v) => v.courseId!)
    const seedIds = slideSeeds.value.map((s) => s.courseId)
    const ids = [...new Set([...videoIds, ...seedIds])]
    if (ids.length === 0) {
      metaByCourse.value = new Map()
      return
    }

    isHydrating.value = true
    try {
      const titleBy = new Map<string, string>()
      for (const c of buildLibraryCourses(videos.value, new Map(), slideSeeds.value)) {
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
      const dataUrl = await (overrides.lecturesProvider
        ? overrides.lecturesProvider.getPoster(filePath)
        : window.electronAPI.lectures.getPoster(filePath))
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
    isDiscoveringSlides,
    posters,
    openCourses,
    openCourse,
    openPlayer,
    closePlayer,
    loadPoster,
    hydrate,
  }
}
