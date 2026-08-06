// State engine for the Slides page.
// Ported from autoslides/src/renderer/features/results/useResultsView.ts.
// Storage goes through slideStore (IndexedDB) and thumbnails are Blob object
// URLs — revoked on reset/goBack/unmount. Manual + baseline + Canny auto-crop
// (single / batch, restore-then-crop for ai_filtered_edit). No post-crop dedup.

import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { formatToolFolderName, parseFolderDisplayName } from '../lib/toolFolders'
import {
  getSlideBlob,
  deleteImages,
  restoreTrashEntries,
  clearTrash as clearTrashStore,
  removeFolders as removeFoldersStore,
  markFolderReviewed,
  commitFolderEdited,
  applyCropToSlide,
  restoreCropFromSlide,
  getSlideSourceBuffer,
  getSlideCropSourceBlob,
} from '../lib/slideStore'
import { getImageBufferSize } from '../lib/imageCrop'
import { createAutoCropWorkerClient } from '../workers/autoCropWorkerClient'
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
  CropRect,
  BaselineCrop,
  BaselineCropActionSummary,
  AutoCropActionSummary,
} from './resultsTypes'
import { createLogger } from '../lib/logger'
const log = createLogger('ResultsView')

export type {
  ResultsReason,
  ResultsFolder,
  ResultsItem,
  CropRect,
  BaselineCrop,
  BaselineCropActionSummary,
  AutoCropActionSummary,
}

/** Active slides, or AI-edit trash that can restore-then-crop (Electron parity). */
export function canUseAsCropActionTarget(item: ResultsItem): boolean {
  return (
    item.status === 'active' ||
    (item.status === 'removed' && item.reason === 'ai_filtered_edit')
  )
}

interface AutoCropTarget {
  /** Slide record id (`folder/filename`) used by applyCrop / getSlideCropSourceBlob. */
  slideId: string
  /** Trash entry id when restore is needed first. */
  trashId?: string
  needsRestore: boolean
}

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
  const folderCovers = ref<Record<string, string>>({})
  const thumbnailSize = ref(320)
  const isLoading = ref(false)
  const previewItem = ref<ResultsItem | null>(null)
  /** Session-only baseline crop (not persisted across reloads). */
  const baselineCrop = ref<BaselineCrop | null>(null)

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

  // Thumbnails are keyed by the stable slide-record id (`folder/filename` =
  // imagePath / trashPath / originalPath), NOT by ResultsItem.id.
  // Active items use path as id; removed items use a trash-entry UUID as id
  // (needed for restore). Keying thumbs by path means a manual delete does
  // not invalidate the already-decoded blob URL — the previous item-id
  // keying revoked it in resetThumbnails() and often left a broken tile
  // until a later full refresh re-fetched the same blob.
  function blobKey(item: Pick<ResultsItem, 'status' | 'imagePath' | 'trashPath' | 'originalPath' | 'id'>): string | undefined {
    if (item.status === 'removed') {
      return item.trashPath || item.originalPath || undefined
    }
    return item.imagePath || item.originalPath || item.id || undefined
  }

  function resetThumbnails() {
    for (const url of Object.values(thumbnails.value)) {
      URL.revokeObjectURL(url)
    }
    thumbnails.value = {}
    thumbnailLoadVersion += 1
  }

  function resetFolderCovers() {
    for (const url of Object.values(folderCovers.value)) {
      URL.revokeObjectURL(url)
    }
    folderCovers.value = {}
  }

  async function loadFolderCovers(foldersList: ResultsFolder[]) {
    resetFolderCovers()
    for (const folder of foldersList) {
      if (folder.coverImageId) {
        try {
          const blob = await getSlideBlob(folder.coverImageId)
          if (blob) {
            folderCovers.value[folder.name] = URL.createObjectURL(blob)
          }
        } catch (error) {
          log.warn(`Failed to load cover for folder ${folder.name}:`, error)
        }
      }
    }
  }

  onUnmounted(() => {
    resetThumbnails()
    resetFolderCovers()
  })

  async function loadFolderSummaries() {
    const result = await loadFolderSummariesCore(dataIO)
    activeFolders.value = result.activeFolders
    trashEntries.value = result.trashEntries
    folders.value = result.folders
    void loadFolderCovers(result.folders)
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
    folderItems.value = await buildFolderItems(folder)
    await loadThumbnails(folderItems.value)
  }

  async function loadThumbnails(items: ResultsItem[]) {
    const version = ++thumbnailLoadVersion

    const needed = new Set<string>()
    for (const item of items) {
      const key = blobKey(item)
      if (key) needed.add(key)
    }

    // Drop only URLs that no longer appear in the current folder (keep the
    // rest so active→trashed does not flash a broken image).
    for (const key of Object.keys(thumbnails.value)) {
      if (!needed.has(key)) {
        URL.revokeObjectURL(thumbnails.value[key])
        delete thumbnails.value[key]
      }
    }

    for (const key of needed) {
      if (version !== thumbnailLoadVersion) return
      if (thumbnails.value[key]) continue

      try {
        const blob = await getSlideBlob(key)
        if (blob && version === thumbnailLoadVersion) {
          thumbnails.value[key] = URL.createObjectURL(blob)
        }
      } catch (error) {
        log.warn(`Failed to load thumbnail for ${key}:`, error)
      }
    }
  }

  /** Resolve the object URL for a results row (path-keyed map). */
  function thumbnailFor(item: ResultsItem): string {
    const key = blobKey(item)
    return (key && thumbnails.value[key]) || ''
  }

  async function refresh(): Promise<'ok' | 'folder-missing'> {
    isLoading.value = true
    selectedIds.value = []
    previewItem.value = null

    try {
      await loadFolderSummaries()

      if (currentView.value === 'images' && currentFolder.value) {
        const refreshedFolder = folders.value.find((folder) => folder.name === currentFolder.value?.name)
        if (!refreshedFolder) {
          goBack()
          return 'folder-missing'
        }

        currentFolder.value = refreshedFolder
        await loadCurrentFolderItems(refreshedFolder)
      }
      return 'ok'
    } catch (error) {
      log.error('Failed to refresh results view:', error)
      return 'ok'
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
    baselineCrop.value = null
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

  /** Force-reload one path-keyed thumbnail (after crop/restore). */
  async function refreshThumbnail(key: string) {
    const prev = thumbnails.value[key]
    if (prev) {
      URL.revokeObjectURL(prev)
      delete thumbnails.value[key]
    }
    try {
      const blob = await getSlideBlob(key)
      if (blob) {
        thumbnails.value[key] = URL.createObjectURL(blob)
      }
    } catch (error) {
      log.warn(`Failed to refresh thumbnail for ${key}:`, error)
    }
  }

  /**
   * Soft-refresh folder items without closing the preview: rebuild items,
   * refresh thumbs for changed crop state, re-bind previewItem only when a
   * preview is already open (never open the viewer as a side effect).
   *
   * Always re-reads trash from IDB — restore-then-crop (and any soft path that
   * mutates trash) would otherwise leave a ghost removed tile next to the
   * restored active slide, because buildFolderItems joins the in-memory
   * trashEntries snapshot.
   */
  async function softRefreshFolder() {
    if (!currentFolder.value) return
    const folder = currentFolder.value
    // Capture identity keys before rebuild — trash UUID becomes folder/filename after restore.
    const prev = previewItem.value
    const openPreviewKeys = prev
      ? new Set(
          [prev.id, prev.imagePath, prev.originalPath, prev.trashPath].filter(
            (k): k is string => !!k,
          ),
        )
      : null

    // Keep trash join current with IDB (restore/delete soft paths).
    trashEntries.value = await dataIO.getTrashEntries()
    const removedCount = trashEntries.value.filter(
      (entry) => entry.originalParentFolder === folder.name,
    ).length
    if (folder.removedCount !== removedCount) {
      const nextFolder = { ...folder, removedCount }
      currentFolder.value = nextFolder
      folders.value = folders.value.map((f) =>
        f.name === folder.name ? { ...f, removedCount } : f,
      )
    }

    const items = await buildFolderItems(currentFolder.value)
    folderItems.value = items

    // Drop selection ids that no longer exist (e.g. trash UUID after restore).
    if (selectedIds.value.length > 0) {
      const live = new Set(items.map((i) => i.id))
      selectedIds.value = selectedIds.value.filter((id) => live.has(id))
    }

    // Always re-fetch thumbs for active items that are cropped or were just restored
    // (blob bytes changed under the same path key).
    for (const item of items) {
      if (item.status !== 'active') continue
      const key = blobKey(item)
      if (!key) continue
      // Drop cached URL so loadThumbnails / refreshThumbnail picks up new bytes.
      if (thumbnails.value[key]) {
        URL.revokeObjectURL(thumbnails.value[key])
        delete thumbnails.value[key]
      }
    }
    await loadThumbnails(items)

    if (openPreviewKeys && openPreviewKeys.size > 0) {
      const next = items.find((i) =>
        [i.id, i.imagePath, i.originalPath, i.trashPath].some(
          (k) => !!k && openPreviewKeys.has(k),
        ),
      )
      previewItem.value = next ?? null
    }

    // Keep folder.metadata.review.cropped in sync if we have metadata.
    if (currentFolder.value.metadata?.review) {
      currentFolder.value.metadata.review.cropped = items.some(
        (i) => i.status === 'active' && i.isCropped,
      )
    }
  }

  async function applyCropToImage(
    imagePath: string,
    rect: CropRect,
    autoCropped = false,
  ): Promise<boolean> {
    const ok = await applyCropToSlide(imagePath, rect, autoCropped)
    if (!ok) return false
    editStaged = true
    await softRefreshFolder()
    return true
  }

  async function restoreCropFromImage(imagePath: string): Promise<boolean> {
    const ok = await restoreCropFromSlide(imagePath)
    if (!ok) return false
    editStaged = true
    // Clear baseline if it pointed at this slide.
    if (baselineCrop.value?.sourceId === imagePath) {
      baselineCrop.value = null
    }
    await softRefreshFolder()
    return true
  }

  function setBaselineCrop(item: ResultsItem): boolean {
    if (item.status !== 'active' || !item.isCropped || !item.cropRect) return false
    const sourceId = item.imagePath || item.id
    baselineCrop.value = {
      rect: { ...item.cropRect },
      sourceFilename: item.name,
      sourceId,
    }
    return true
  }

  function clearBaselineCrop() {
    baselineCrop.value = null
  }

  async function applyBaselineToSelected(): Promise<BaselineCropActionSummary> {
    const summary: BaselineCropActionSummary = {
      cropped: 0,
      outOfBounds: 0,
      failed: 0,
    }
    const baseline = baselineCrop.value
    if (!baseline) return summary

    const targets = selectedActiveItems.value
    if (targets.length === 0) return summary

    isLoading.value = true
    try {
      for (const item of targets) {
        const id = item.imagePath || item.id
        if (!id) {
          summary.failed++
          continue
        }
        try {
          const buffer = await getSlideSourceBuffer(id)
          if (!buffer) {
            summary.failed++
            continue
          }
          const { width, height } = await getImageBufferSize(buffer)
          const r = baseline.rect
          if (
            r.x < 0 ||
            r.y < 0 ||
            r.width <= 0 ||
            r.height <= 0 ||
            r.x + r.width > width ||
            r.y + r.height > height
          ) {
            summary.outOfBounds++
            continue
          }
          const ok = await applyCropToSlide(id, r, false)
          if (ok) summary.cropped++
          else summary.failed++
        } catch (err) {
          log.error(`Baseline crop failed for ${id}:`, err)
          summary.failed++
        }
      }

      if (summary.cropped > 0) {
        editStaged = true
        await softRefreshFolder()
      }
    } finally {
      isLoading.value = false
    }
    return summary
  }

  /** Revert crop on selected active cropped slides. */
  async function revertCropSelected(): Promise<{ restored: number; failed: number }> {
    const targets = selectedActiveItems.value.filter((item) => item.isCropped)
    const summary = { restored: 0, failed: 0 }
    if (targets.length === 0) return summary

    isLoading.value = true
    try {
      for (const item of targets) {
        const id = item.imagePath || item.id
        if (!id) {
          summary.failed++
          continue
        }
        const ok = await restoreCropFromSlide(id)
        if (ok) {
          summary.restored++
          if (baselineCrop.value?.sourceId === id) {
            baselineCrop.value = null
          }
        } else {
          summary.failed++
        }
      }
      if (summary.restored > 0) {
        editStaged = true
        await softRefreshFolder()
      }
    } finally {
      isLoading.value = false
    }
    return summary
  }

  const selectedCroppedCount = computed(
    () => selectedActiveItems.value.filter((item) => item.isCropped).length,
  )

  const selectedAutoCropTargets = computed(() =>
    selectedItems.value.filter(canUseAsCropActionTarget),
  )

  const selectedAutoCropCount = computed(() => selectedAutoCropTargets.value.length)

  function buildAutoCropTarget(item: ResultsItem): AutoCropTarget | null {
    if (item.status === 'active') {
      const slideId = item.imagePath || item.id
      if (!slideId) return null
      return { slideId, needsRestore: false }
    }
    if (item.status === 'removed' && item.reason === 'ai_filtered_edit') {
      // After restore, slide id is originalPath / trashPath (folder/filename).
      const slideId = item.originalPath || item.trashPath
      if (!slideId || !item.id) return null
      return { slideId, trashId: item.id, needsRestore: true }
    }
    return null
  }

  async function runAutoCropOnTargets(items: ResultsItem[]): Promise<AutoCropActionSummary> {
    const summary: AutoCropActionSummary = { cropped: 0, noDetection: 0, failed: 0 }
    const targets = items
      .map(buildAutoCropTarget)
      .filter((t): t is AutoCropTarget => t !== null)
    if (targets.length === 0) return summary

    isLoading.value = true
    const client = createAutoCropWorkerClient()
    try {
      const toRestore = targets
        .filter((t) => t.needsRestore && t.trashId)
        .map((t) => t.trashId as string)
      if (toRestore.length > 0) {
        await restoreTrashEntries(toRestore)
        editStaged = true
      }

      for (const target of targets) {
        try {
          const blob = await getSlideCropSourceBlob(target.slideId)
          if (!blob) {
            summary.failed++
            continue
          }
          const imageData = await client.blobToImageData(blob)
          const response = await client.detectBbox(imageData, false)
          if (!response.success || !response.result?.bbox) {
            summary.noDetection++
            continue
          }
          const { x, y, w, h } = response.result.bbox
          if (w < 20 || h < 20) {
            summary.noDetection++
            continue
          }
          const ok = await applyCropToSlide(
            target.slideId,
            { x, y, width: w, height: h },
            true,
          )
          if (ok) summary.cropped++
          else summary.failed++
        } catch (err) {
          log.error(`Auto-crop failed for ${target.slideId}:`, err)
          summary.failed++
        }
      }

      if (summary.cropped > 0 || toRestore.length > 0) {
        editStaged = true
        await softRefreshFolder()
      }
    } finally {
      client.destroy()
      isLoading.value = false
    }
    return summary
  }

  /** Batch Canny auto-crop: active + ai_filtered_edit (restore-then-crop). */
  async function autoCropSelected(): Promise<AutoCropActionSummary> {
    return runAutoCropOnTargets(selectedAutoCropTargets.value)
  }

  /** Single-item auto-crop (grid / preview); same eligibility as batch. */
  async function autoCropItem(item: ResultsItem): Promise<AutoCropActionSummary> {
    if (!canUseAsCropActionTarget(item)) {
      return { cropped: 0, noDetection: 0, failed: 1 }
    }
    return runAutoCropOnTargets([item])
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

    // Drop pending reviewed/edited latches for a folder we're about to wipe so
    // refresh→goBack can't fire markFolderReviewed/commitFolderEdited against
    // a just-deleted name (defense in depth; slideStore also no-ops if absent).
    if (currentFolder.value && folderNames.includes(currentFolder.value.name)) {
      cancelReviewDwell()
      editStaged = false
    }

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
    selectedCroppedCount,
    selectedAutoCropCount,
    selectedReason,
    contextMode,
    thumbnails,
    folderCovers,
    thumbnailSize,
    isLoading,
    previewItem,
    baselineCrop,
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
    applyCropToImage,
    restoreCropFromImage,
    setBaselineCrop,
    clearBaselineCrop,
    applyBaselineToSelected,
    revertCropSelected,
    autoCropSelected,
    autoCropItem,
    deleteSelected,
    restoreSelected,
    clearTrash,
    removeFolders,
    formatDate,
    formatToolFolderName,
    getFolderDisplayName: parseFolderDisplayName,
    thumbnailFor,
    blobKey,
    refreshThumbnail,
  }
}

export type UseResultsViewReturn = ReturnType<typeof useResultsView>
