// State engine for the Slides page.
// Ported from autoslides/src/renderer/features/results/useResultsView.ts with
// all crop/baseline/dedup/AI machinery removed (web scope: review, restore,
// delete, clear trash, export). Storage goes through slideStore (IndexedDB)
// and thumbnails are Blob object URLs — revoked on reset/goBack/unmount,
// which desktop's garbage-collected data URLs never needed.

import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { formatToolFolderName } from '../lib/toolFolders'
import {
  getSlideBlob,
  deleteImages,
  restoreTrashEntries,
  clearTrash as clearTrashStore,
  removeFolders as removeFoldersStore,
  markFolderReviewed,
  commitFolderEdited,
} from '../lib/slideStore'
import {
  createResultsDataIO,
  loadFolderSummaries as loadFolderSummariesCore,
  buildFolderItems as buildFolderItemsCore,
} from './resultsDataLoader'
import type {
  ResultsReason,
  RemovedEntry,
  ResultsFolder,
  ResultsItem,
  ResultsViewMode,
  ContextMode,
} from './resultsTypes'
import { createLogger } from '../lib/logger'
const log = createLogger('ResultsView')

export type { ResultsReason, ResultsFolder, ResultsItem }

export function useResultsView() {
  const folders = ref<ResultsFolder[]>([])
  const activeFolders = ref<Array<{ name: string; path: string }>>([])
  const trashEntries = ref<RemovedEntry[]>([])
  const currentView = ref<ResultsViewMode>('folders')
  const currentFolder = ref<ResultsFolder | null>(null)
  const folderItems = ref<ResultsItem[]>([])
  const selectedIds = ref<string[]>([])
  const selectedReason = ref<ResultsReason | ''>('')
  const contextMode = ref<ContextMode>('context')
  const thumbnails = ref<Record<string, string>>({})
  const thumbnailSize = ref(320)
  const isLoading = ref(false)
  const previewItem = ref<ResultsItem | null>(null)

  let thumbnailLoadVersion = 0

  const dataIO = createResultsDataIO()

  const currentFolderDisplayName = computed(() => {
    return currentFolder.value ? formatToolFolderName(currentFolder.value.name) : ''
  })

  const filteredItems = computed(() => {
    return folderItems.value.filter((item) => {
      if (item.status === 'active') {
        return contextMode.value === 'context' || contextMode.value === 'extracted-only'
      }

      if (contextMode.value === 'extracted-only') {
        return false
      }

      if (selectedReason.value && item.reason !== selectedReason.value) {
        return false
      }

      return true
    })
  })

  const selectedItems = computed(() => {
    const selected = new Set(selectedIds.value)
    return folderItems.value.filter((item) => selected.has(item.id))
  })

  const selectedActiveItems = computed(() => {
    return selectedItems.value.filter((item) => item.status === 'active')
  })

  const selectedRemovedItems = computed(() => {
    return selectedItems.value.filter((item) => item.status === 'removed')
  })

  const hasRemovedItems = computed(() => {
    return folderItems.value.some((item) => item.status === 'removed')
  })

  // Reviewed-on-dwell: once the user has had a folder open for REVIEW_DWELL_MS,
  // mark it reviewed when they return to the folder list — not while they're
  // still browsing it. Cancelled if they leave sooner. No-op for folders
  // without metadata.
  const REVIEW_DWELL_MS = 2000
  let reviewDwellTimer: ReturnType<typeof setTimeout> | null = null
  let reviewDwellFolder: ResultsFolder | null = null
  let reviewDwellMet = false

  function cancelReviewDwell() {
    if (reviewDwellTimer !== null) {
      clearTimeout(reviewDwellTimer)
      reviewDwellTimer = null
    }
    reviewDwellFolder = null
    reviewDwellMet = false
  }

  function startReviewDwell(folder: ResultsFolder) {
    cancelReviewDwell()
    reviewDwellFolder = folder
    reviewDwellTimer = setTimeout(() => {
      reviewDwellTimer = null
      reviewDwellMet = true
    }, REVIEW_DWELL_MS)
  }

  function commitReviewDwell() {
    const folder = reviewDwellFolder
    const met = reviewDwellMet
    cancelReviewDwell()
    if (!met || !folder) return
    void markFolderReviewed(folder.name)
    // Reflect locally so the badge updates without a full reload.
    if (folder.metadata?.review && !folder.metadata.review.reviewed) {
      folder.metadata.review.reviewed = true
      folder.metadata.review.reviewedAt = new Date().toISOString()
    }
  }

  onUnmounted(cancelReviewDwell)

  // Edited-on-return: delete/restore actions stage an `edited` latch locally;
  // it's written to the folder metadata when the user returns to the folder
  // list — not while they're still browsing the folder.
  let editStaged = false

  function commitEditLatch() {
    const folder = currentFolder.value
    if (!editStaged || !folder) return
    editStaged = false
    void commitFolderEdited(folder.name).then(() => {
      if (folder.metadata?.review && !folder.metadata.review.edited) {
        folder.metadata.review.edited = true
        folder.metadata.review.editedAt = new Date().toISOString()
      }
    })
  }

  onUnmounted(commitEditLatch)

  watch([selectedReason, contextMode], () => {
    selectedIds.value = []
  })

  function resetThumbnails() {
    for (const url of Object.values(thumbnails.value)) {
      URL.revokeObjectURL(url)
    }
    thumbnails.value = {}
    thumbnailLoadVersion += 1
  }

  onUnmounted(resetThumbnails)

  async function loadFolderSummaries() {
    const result = await loadFolderSummariesCore(dataIO)
    activeFolders.value = result.activeFolders
    trashEntries.value = result.trashEntries
    folders.value = result.folders
  }

  async function buildFolderItems(folder: ResultsFolder): Promise<ResultsItem[]> {
    const activeFolder = activeFolders.value.find((entry) => entry.name === folder.name)
    return buildFolderItemsCore(folder, {
      io: dataIO,
      activeFolderPath: activeFolder?.path,
      trashEntries: trashEntries.value,
    })
  }

  async function loadCurrentFolderItems(folder: ResultsFolder) {
    resetThumbnails()
    folderItems.value = await buildFolderItems(folder)
    void loadThumbnails(folderItems.value)
  }

  async function loadThumbnails(items: ResultsItem[]) {
    const version = thumbnailLoadVersion

    for (const item of items) {
      if (version !== thumbnailLoadVersion) return
      if (thumbnails.value[item.id]) continue

      try {
        const blobId = item.status === 'removed' ? item.trashPath : item.imagePath
        if (!blobId) continue
        const blob = await getSlideBlob(blobId)
        if (blob && version === thumbnailLoadVersion) {
          thumbnails.value[item.id] = URL.createObjectURL(blob)
        }
      } catch (error) {
        log.warn(`Failed to load thumbnail for ${item.name}:`, error)
      }
    }
  }

  async function refresh() {
    isLoading.value = true
    selectedIds.value = []
    previewItem.value = null

    try {
      await loadFolderSummaries()

      if (currentView.value === 'images' && currentFolder.value) {
        const refreshedFolder = folders.value.find((folder) => folder.name === currentFolder.value?.name)
        if (!refreshedFolder) {
          goBack()
          return
        }

        currentFolder.value = refreshedFolder
        await loadCurrentFolderItems(refreshedFolder)
      }
    } catch (error) {
      log.error('Failed to refresh results view:', error)
    } finally {
      isLoading.value = false
    }
  }

  async function openFolder(folder: ResultsFolder) {
    currentView.value = 'images'
    currentFolder.value = folder
    startReviewDwell(folder)
    editStaged = false
    selectedIds.value = []
    selectedReason.value = ''
    previewItem.value = null
    isLoading.value = true

    try {
      await loadCurrentFolderItems(folder)
    } catch (error) {
      log.error('Failed to open results folder:', error)
    } finally {
      isLoading.value = false
    }
  }

  function goBack() {
    commitReviewDwell()
    commitEditLatch()
    currentView.value = 'folders'
    currentFolder.value = null
    folderItems.value = []
    selectedIds.value = []
    selectedReason.value = ''
    previewItem.value = null
    resetThumbnails()
  }

  function toggleSelection(id: string) {
    const index = selectedIds.value.indexOf(id)
    if (index === -1) {
      selectedIds.value.push(id)
    } else {
      selectedIds.value.splice(index, 1)
    }
  }

  function selectAll() {
    selectedIds.value = filteredItems.value.map((item) => item.id)
  }

  function clearSelection() {
    selectedIds.value = []
  }

  function openPreview(item: ResultsItem) {
    previewItem.value = item
  }

  function closePreview() {
    previewItem.value = null
  }

  async function deleteSelected() {
    if (selectedActiveItems.value.length === 0) return

    isLoading.value = true
    try {
      const ids = selectedActiveItems.value
        .map((item) => item.imagePath)
        .filter((path): path is string => !!path)
      await deleteImages(ids)
      editStaged = true
      await refresh()
    } catch (error) {
      log.error('Failed to delete selected images:', error)
    } finally {
      isLoading.value = false
    }
  }

  async function restoreSelected() {
    if (selectedRemovedItems.value.length === 0) return

    isLoading.value = true
    try {
      const ids = selectedRemovedItems.value.map((item) => item.id)
      await restoreTrashEntries(ids)
      editStaged = true
      await refresh()
    } catch (error) {
      log.error('Failed to restore selected images:', error)
    } finally {
      isLoading.value = false
    }
  }

  async function clearTrash(ids?: string[]) {
    isLoading.value = true
    try {
      await clearTrashStore(ids && ids.length > 0 ? ids : undefined)
      await refresh()
    } catch (error) {
      log.error('Failed to clear trash:', error)
    } finally {
      isLoading.value = false
    }
  }

  async function removeFolders(folderNames: string[]) {
    if (!folderNames || folderNames.length === 0) return

    isLoading.value = true
    try {
      await removeFoldersStore(folderNames)
      await refresh()
    } catch (error) {
      log.error('Failed to remove folders:', error)
    } finally {
      isLoading.value = false
    }
  }

  function formatDate(value?: string): string {
    if (!value) return ''

    try {
      return new Date(value).toLocaleString()
    } catch {
      return value
    }
  }

  onMounted(() => {
    refresh()
  })

  return {
    folders,
    currentView,
    currentFolder,
    currentFolderDisplayName,
    folderItems,
    filteredItems,
    selectedIds,
    selectedItems,
    selectedActiveItems,
    selectedRemovedItems,
    selectedReason,
    contextMode,
    thumbnails,
    thumbnailSize,
    isLoading,
    previewItem,
    hasRemovedItems,
    trashEntries,
    openFolder,
    goBack,
    refresh,
    toggleSelection,
    selectAll,
    clearSelection,
    openPreview,
    closePreview,
    deleteSelected,
    restoreSelected,
    clearTrash,
    removeFolders,
    formatDate,
    formatToolFolderName,
  }
}

export type UseResultsViewReturn = ReturnType<typeof useResultsView>
