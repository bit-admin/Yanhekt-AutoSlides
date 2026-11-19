import { computed, ref, watch } from 'vue'
import {
  formatLectureVideoDisplayName,
  isLectureSubtitleExt,
  parseLectureVideoName,
  type LectureVideoType,
} from '@common/lectureVideoNaming'
import { configStore } from '@shared/services/configStore'
import { overrides } from '@shared/overrideRegistry'
import { createLatest } from '@shared/utils/latest'
import { createLogger } from '@shared/utils/logger'
import { SlideVideoQueue } from '@shared/services/slideVideoQueue'
import { buildLectureListGroups } from './lectureListModel'
import { slideVideoTargets } from './slideVideoModel'

const log = createLogger('LecturesPage')

export interface LectureVideoItem {
  name: string
  path: string
  size: number
  mtimeMs: number
  /** Lowercased extension incl. the dot. Distinguishes a mic `.aac` from a video
   *  when the filename carries no type tag — see buildLibraryCourses. */
  ext: string
  displayName: string
  courseId?: string
  sessionId?: string
  liveId?: string
  videoType?: LectureVideoType
  recognised: boolean
  hasEmbyTags: boolean
  /** A subtitle sidecar. Its `videoType` is that of the video it is named after. */
  isSubtitle?: boolean
  /**
   * A `slides_*` folder, listed with its session's files (List view only; the
   * Library finds folders itself). `path` is the folder, `size` is 0.
   */
  slidesFolder?: { imageCount: number; hasTimeline: boolean }
}

type SlideFolderRow = { name: string; path: string; imageCount: number; mtimeMs: number; hasTimeline: boolean }

async function listSlideFolders(): Promise<SlideFolderRow[]> {
  try {
    const provider = overrides.lecturesProvider
    if (provider) return (await provider.listSlideFolders?.()) ?? []
    return await window.electronAPI.lectures.listSlideFolders()
  } catch (error) {
    // The files still list; only the folders are missing.
    log.warn('Failed to list slides folders', error)
    return []
  }
}

function slideFolderItem(row: SlideFolderRow): LectureVideoItem | null {
  const parsed = parseLectureVideoName(row.name)
  // Only folders that belong to a session: the rest are Slides workspace business.
  if (!parsed.courseId || !parsed.sessionId) return null
  return {
    name: row.name,
    path: row.path,
    size: 0,
    mtimeMs: row.mtimeMs,
    ext: '',
    displayName: formatLectureVideoDisplayName(row.name),
    courseId: parsed.courseId,
    sessionId: parsed.sessionId,
    liveId: parsed.liveId,
    recognised: true,
    hasEmbyTags: false,
    slidesFolder: { imageCount: row.imageCount, hasTimeline: row.hasTimeline },
  }
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

export function useLecturesPage() {
  /** Media files only: this is what the Library and posters read. */
  const videos = ref<LectureVideoItem[]>([])
  /** Subtitle sidecars, shown in List view and renamed with their lecture. */
  const subtitles = ref<LectureVideoItem[]>([])
  /** Session `slides_*` folders, shown in List view and read by Make Video. */
  const slideFolders = ref<LectureVideoItem[]>([])
  /** Everything List view shows: files and slides folders. */
  const files = computed(() => [...videos.value, ...subtitles.value, ...slideFolders.value])
  const isLoading = ref(false)
  /** Last listVideos failure (raw, for PageErrorNotice), or null. */
  const loadError = ref<unknown>(null)
  const isSelectMode = ref(false)
  const selectedPaths = ref<string[]>([])
  const groupByCourse = ref(true)
  const showMakeVideoModal = ref(false)
  const showRenameModal = ref(false)

  // Only the newest scan writes the list, the error and the spinner: scans
  // overlap when the output folder changes or an action rescans mid-scan.
  const scans = createLatest()

  const loadVideos = async (): Promise<void> => {
    const current = scans.begin()
    isLoading.value = true
    try {
      const [rows, folderRows] = await Promise.all([
        overrides.lecturesProvider
          ? overrides.lecturesProvider.listVideos()
          : window.electronAPI.lectures.listVideos(),
        listSlideFolders(),
      ])
      if (!current()) return
      const items = rows.map((row): LectureVideoItem => {
        const parsed = parseLectureVideoName(row.name)
        return {
          name: row.name,
          path: row.path,
          size: row.size,
          mtimeMs: row.mtimeMs,
          ext: parsed.ext,
          displayName: formatLectureVideoDisplayName(row.name),
          courseId: parsed.courseId,
          sessionId: parsed.sessionId,
          liveId: parsed.liveId,
          videoType: parsed.videoType,
          recognised: parsed.recognised,
          hasEmbyTags: parsed.hasEmbyTags,
          isSubtitle: isLectureSubtitleExt(parsed.ext),
        }
      })
      videos.value = items.filter((item) => !item.isSubtitle)
      subtitles.value = items.filter((item) => item.isSubtitle)
      slideFolders.value = folderRows
        .map(slideFolderItem)
        .filter((item): item is LectureVideoItem => item !== null)
      // Cleared only on success, so a retry keeps the banner (spinning) up.
      loadError.value = null
    } catch (error) {
      if (!current()) return
      log.error('Failed to list videos', error)
      loadError.value = error
      videos.value = []
      subtitles.value = []
      slideFolders.value = []
    } finally {
      if (current()) isLoading.value = false
    }
  }

  // Rescan when the configured output directory changes.
  watch(
    () => configStore.outputDirectory,
    () => {
      // Paths picked in the previous folder mean nothing in this one.
      selectedPaths.value = []
      void loadVideos()
    },
  )

  const groups = computed(() => buildLectureListGroups(files.value, groupByCourse.value))

  const selectedItems = computed(() =>
    files.value.filter((v) => selectedPaths.value.includes(v.path)),
  )

  /** Sessions touched by the selection, and which of them can make a slide video. */
  const selectedSlideVideos = computed(() => slideVideoTargets(files.value, selectedPaths.value))

  /** Rename works on files; a slides folder keeps its name (Slides and the player find it by it). */
  const selectedRecognised = computed(() =>
    selectedItems.value.filter((v) => v.recognised && !v.slidesFolder),
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

  const clearSelection = () => {
    selectedPaths.value = []
  }

  const openOutputDirectory = async () => {
    await window.electronAPI.lectures.openOutputDirectory()
  }

  const reveal = async (filePath: string) => {
    await window.electronAPI.lectures.reveal(filePath)
  }

  const openExternally = async (filePath: string) => {
    await window.electronAPI.lectures.openExternally(filePath)
  }

  return {
    videos,
    subtitles,
    files,
    isLoading,
    loadError,
    isSelectMode,
    selectedPaths,
    groupByCourse,
    slideFolders,
    showMakeVideoModal,
    showRenameModal,
    groups,
    selectedItems,
    selectedSlideVideos,
    selectedRecognised,
    queue: SlideVideoQueue,
    loadVideos,
    toggleSelectMode,
    toggleSelection,
    selectGroup,
    clearSelection,
    openOutputDirectory,
    reveal,
    openExternally,
    formatBytes,
  }
}
