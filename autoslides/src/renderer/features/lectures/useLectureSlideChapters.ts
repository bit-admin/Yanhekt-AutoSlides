// Match a LibrarySession to a slides_* folder (courseId+sessionId suffix),
// load timeline.json, and derive Emby-style slide chapter cards for the local player.
// Thumbs are loaded lazily via pdfmaker.getImageAsBase64 (asmedia is video-only).

import { computed, reactive, ref, unref, watch, type MaybeRefOrGetter, type Ref } from 'vue'
import { parseLectureIds } from '@common/lectureNaming'
import { coalesceConsecutiveSlideCues, deriveCues } from '@common/sidecars'
import { overrides } from '@shared/overrideRegistry'
import { getTimeline } from '@shared/services/slideTimelineClient'
import { createLogger } from '@shared/utils/logger'

const log = createLogger('LectureSlideChapters')

const PREFETCH_COUNT = 4
/** Prefer the later chapter when currentTime is within this of a shared boundary. */
const ACTIVE_BOUNDARY_EPS = 0.12

export interface SlideChapterCard {
  id: string
  index: number
  startTime: number
  endTime: number
  file: string
  imagePath: string
}

function toRefValue<T>(source: MaybeRefOrGetter<T> | Ref<T>): T {
  // Vue 3.5+ toValue is ideal; stay compatible with plain refs/getters used here.
  if (typeof source === 'function') {
    return (source as () => T)()
  }
  return unref(source as Ref<T>)
}

function joinFolderFile(folderPath: string, file: string): string {
  const sep = folderPath.includes('\\') && !folderPath.includes('/') ? '\\' : '/'
  const base = folderPath.endsWith('/') || folderPath.endsWith('\\') ? folderPath.slice(0, -1) : folderPath
  return `${base}${sep}${file}`
}

export function useLectureSlideChapters(
  courseIdSource: MaybeRefOrGetter<string | undefined>,
  sessionIdSource: MaybeRefOrGetter<string | undefined>,
  currentTimeSource: MaybeRefOrGetter<number>,
  durationSource: MaybeRefOrGetter<number>
) {
  const chapters = ref<SlideChapterCard[]>([])
  const folderPath = ref<string | null>(null)
  const loading = ref(false)
  const hasChapters = computed(() => chapters.value.length > 0)

  const thumbnailMap = reactive(new Map<string, string>())
  const loadingPaths = reactive(new Set<string>())

  const activeChapterId = computed(() => {
    const time = toRefValue(currentTimeSource)
    if (!Number.isFinite(time) || chapters.value.length === 0) return null

    // Keyframe-early seeks often land a few frames before the chapter start.
    // Bias matching slightly forward so the clicked / upcoming chapter wins
    // when time sits just under a shared boundary.
    const matchTime = time + ACTIVE_BOUNDARY_EPS

    for (const card of chapters.value) {
      const end =
        Number.isFinite(card.endTime) && card.endTime > card.startTime
          ? card.endTime
          : Number.POSITIVE_INFINITY
      if (matchTime >= card.startTime && matchTime < end) return card.id
    }
    // Past last cue end with finite duration: keep last chapter active.
    const last = chapters.value[chapters.value.length - 1]
    if (last && time >= last.startTime) return last.id
    return null
  })

  async function loadThumbnail(imagePath: string): Promise<void> {
    if (!imagePath || thumbnailMap.has(imagePath) || loadingPaths.has(imagePath)) return
    loadingPaths.add(imagePath)
    try {
      const file = imagePath.split(/[/\\]/).pop() || ''
      if (overrides.resultImageSource) {
        const uri = overrides.resultImageSource({ name: file })
        if (uri) {
          thumbnailMap.set(imagePath, uri)
          return
        }
      }
      const base64 = await window.electronAPI.pdfmaker.getImageAsBase64(imagePath)
      if (base64) {
        thumbnailMap.set(imagePath, `data:image/png;base64,${base64}`)
      }
    } catch (error) {
      log.warn('Failed to load slide thumb:', imagePath, error)
    } finally {
      loadingPaths.delete(imagePath)
    }
  }

  function prefetchInitialThumbs(cards: SlideChapterCard[]): void {
    for (const card of cards.slice(0, PREFETCH_COUNT)) {
      void loadThumbnail(card.imagePath)
    }
  }

  async function loadChapters(): Promise<void> {
    const courseId = toRefValue(courseIdSource)
    const sessionId = toRefValue(sessionIdSource)
    const duration = toRefValue(durationSource)

    if (!courseId || !sessionId) {
      chapters.value = []
      folderPath.value = null
      return
    }

    const wantCourse = String(courseId)
    const wantSession = String(sessionId)
    loading.value = true
    try {
      const folders = overrides.resultsProvider
        ? await overrides.resultsProvider.getFolders()
        : await window.electronAPI.pdfmaker.getFolders()
      const match = folders.find(folder => {
        const ids = parseLectureIds(folder.name)
        return (
          !!ids.courseId &&
          !!ids.sessionId &&
          String(ids.courseId) === wantCourse &&
          String(ids.sessionId) === wantSession
        )
      })

      if (!match) {
        chapters.value = []
        folderPath.value = null
        return
      }

      folderPath.value = match.path
      const timeline = await getTimeline(match.path)
      if (!timeline) {
        chapters.value = []
        return
      }

      const durationArg =
        typeof duration === 'number' && Number.isFinite(duration) && duration > 0
          ? duration
          : undefined
      // Coalesce on the full cue list first so explicit gaps still break a run;
      // then keep slide cards only for the strip.
      const cues = coalesceConsecutiveSlideCues(deriveCues(timeline, durationArg)).filter(
        (cue): cue is typeof cue & { type: 'slide'; file: string } =>
          cue.type === 'slide' && typeof cue.file === 'string' && cue.file.length > 0
      )

      const next: SlideChapterCard[] = cues.map((cue, index) => ({
        id: cue.id,
        index,
        startTime: cue.startTime,
        endTime: cue.endTime,
        file: cue.file!,
        imagePath: joinFolderFile(match.path, cue.file!),
      }))

      chapters.value = next
      prefetchInitialThumbs(next)
    } catch (error) {
      log.warn('Failed to load lecture slide chapters:', error)
      chapters.value = []
      folderPath.value = null
    } finally {
      loading.value = false
    }
  }

  // Reload when identity changes.
  watch(
    () => [toRefValue(courseIdSource), toRefValue(sessionIdSource)] as const,
    () => {
      void loadChapters()
    },
    { immediate: true }
  )

  // Re-derive when duration becomes known (first open often has duration 0).
  watch(
    () => toRefValue(durationSource),
    (d, prev) => {
      if (!folderPath.value) return
      const nextOk = typeof d === 'number' && Number.isFinite(d) && d > 0
      const prevOk = typeof prev === 'number' && Number.isFinite(prev) && prev > 0
      if (nextOk && !prevOk) void loadChapters()
    }
  )

  return {
    chapters,
    hasChapters,
    activeChapterId,
    loading,
    folderPath,
    thumbnailMap,
    loadThumbnail,
    loadChapters,
  }
}
