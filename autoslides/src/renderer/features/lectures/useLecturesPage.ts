import { computed, ref, watch } from 'vue'
import {
  formatLectureVideoDisplayName,
  parseLectureVideoName,
  type LectureCompressPresetTag,
  type LectureVideoType,
} from '@common/lectureVideoNaming'
import { configStore } from '@shared/services/configStore'
import { createLogger } from '@shared/utils/logger'
import { LectureCompressQueue } from './lectureCompressQueue'

const log = createLogger('LecturesPage')

export interface LectureVideoItem {
  name: string
  path: string
  size: number
  mtimeMs: number
  displayName: string
  courseId?: string
  sessionId?: string
  liveId?: string
  videoType?: LectureVideoType
  /** Present when the file was compressed via Lectures (`[ascomp=…]`). */
  compressPreset?: LectureCompressPresetTag
  recognised: boolean
  hasEmbyTags: boolean
}

export interface LectureCourseGroup {
  courseKey: string
  courseId?: string
  courseName: string
  items: LectureVideoItem[]
}

function formatBytes(n: number): string {
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

function courseLabelFromItem(item: LectureVideoItem): string {
  // Prefer Emby stem course segment before " - S" / " - ", else display name.
  const d = item.displayName
  const se = d.match(/^(.+?)\s+-\s+S\d{2}/)
  if (se) return se[1].trim()
  // Legacy: course_session… with Chinese week pattern
  const legacy = d.match(/^(.+?)_第\d+周/)
  if (legacy) return legacy[1].replace(/_/g, ' ').trim()
  const dash = d.split(' - ')[0]
  return (dash || d || item.name).trim()
}

export function useLecturesPage() {
  const videos = ref<LectureVideoItem[]>([])
  const isLoading = ref(false)
  const errorMessage = ref('')
  const isSelectMode = ref(false)
  const selectedPaths = ref<string[]>([])
  const groupByCourse = ref(true)
  const showCompressModal = ref(false)
  const showRenameModal = ref(false)

  const loadVideos = async (): Promise<void> => {
    isLoading.value = true
    errorMessage.value = ''
    try {
      const rows = await window.electronAPI.lectures.listVideos()
      videos.value = rows.map((row) => {
        const parsed = parseLectureVideoName(row.name)
        return {
          name: row.name,
          path: row.path,
          size: row.size,
          mtimeMs: row.mtimeMs,
          displayName: formatLectureVideoDisplayName(row.name),
          courseId: parsed.courseId,
          sessionId: parsed.sessionId,
          liveId: parsed.liveId,
          videoType: parsed.videoType,
          compressPreset: parsed.compressPreset,
          recognised: parsed.recognised,
          hasEmbyTags: parsed.hasEmbyTags,
        }
      })
    } catch (error) {
      log.error('Failed to list videos', error)
      errorMessage.value = error instanceof Error ? error.message : String(error)
      videos.value = []
    } finally {
      isLoading.value = false
    }
  }

  // Rescan when the configured output directory changes.
  watch(
    () => configStore.outputDirectory,
    () => {
      void loadVideos()
    },
  )

  const groups = computed<LectureCourseGroup[]>(() => {
    const recognised = videos.value.filter((v) => v.recognised)
    const unrecognised = videos.value.filter((v) => !v.recognised)

    if (!groupByCourse.value) {
      const flat: LectureCourseGroup[] = []
      if (recognised.length) {
        flat.push({
          courseKey: 'all-recognised',
          courseName: '',
          items: [...recognised].sort((a, b) => a.displayName.localeCompare(b.displayName, 'zh')),
        })
      }
      if (unrecognised.length) {
        flat.push({
          courseKey: 'unrecognised',
          courseName: '',
          items: unrecognised,
        })
      }
      return flat
    }

    const map = new Map<string, LectureCourseGroup>()
    for (const item of recognised) {
      const courseId = item.courseId!
      const key = `id:${courseId}`
      let group = map.get(key)
      if (!group) {
        group = {
          courseKey: key,
          courseId,
          courseName: courseLabelFromItem(item),
          items: [],
        }
        map.set(key, group)
      }
      group.items.push(item)
    }

    const ordered = [...map.values()].sort((a, b) =>
      a.courseName.localeCompare(b.courseName, 'zh'),
    )
    for (const g of ordered) {
      g.items.sort((a, b) => a.displayName.localeCompare(b.displayName, 'zh'))
    }

    if (unrecognised.length) {
      ordered.push({
        courseKey: 'unrecognised',
        courseName: '',
        items: [...unrecognised].sort((a, b) => a.name.localeCompare(b.name, 'zh')),
      })
    }
    return ordered
  })

  const selectedItems = computed(() =>
    videos.value.filter((v) => selectedPaths.value.includes(v.path)),
  )

  const selectedScreenRecognised = computed(() =>
    selectedItems.value.filter((v) => v.recognised && v.videoType === 'screen'),
  )

  const selectedRecognised = computed(() =>
    selectedItems.value.filter((v) => v.recognised),
  )

  const toggleSelectMode = () => {
    isSelectMode.value = !isSelectMode.value
    if (!isSelectMode.value) selectedPaths.value = []
  }

  const toggleSelection = (path: string) => {
    const idx = selectedPaths.value.indexOf(path)
    if (idx >= 0) selectedPaths.value.splice(idx, 1)
    else selectedPaths.value.push(path)
  }

  const selectGroup = (paths: string[]) => {
    const allSelected = paths.every((p) => selectedPaths.value.includes(p))
    if (allSelected) {
      selectedPaths.value = selectedPaths.value.filter((p) => !paths.includes(p))
    } else {
      const set = new Set(selectedPaths.value)
      for (const p of paths) set.add(p)
      selectedPaths.value = [...set]
    }
  }

  const selectAll = () => {
    selectedPaths.value = videos.value.map((v) => v.path)
  }

  const clearSelection = () => {
    selectedPaths.value = []
  }

  const openOutputDirectory = async () => {
    await window.electronAPI.lectures.openOutputDirectory()
  }

  const reveal = async (filePath: string) => {
    await window.electronAPI.lectures.reveal(filePath)
  }

  return {
    videos,
    isLoading,
    errorMessage,
    isSelectMode,
    selectedPaths,
    groupByCourse,
    showCompressModal,
    showRenameModal,
    groups,
    selectedItems,
    selectedScreenRecognised,
    selectedRecognised,
    queue: LectureCompressQueue,
    loadVideos,
    toggleSelectMode,
    toggleSelection,
    selectGroup,
    selectAll,
    clearSelection,
    openOutputDirectory,
    reveal,
    formatBytes,
  }
}
