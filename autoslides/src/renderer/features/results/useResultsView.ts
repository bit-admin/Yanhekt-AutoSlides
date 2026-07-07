import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { formatToolFolderName } from '@shared/utils/toolWindowFolders'
import { createAutoCropWorkerClient } from '@shared/autoCrop'
import { configStore } from '@shared/services/configStore'
import { overrides } from '@shared/overrideRegistry'
import { markFolderReviewed, commitFolderEdited } from '@shared/services/slideMetadataClient'
import {
  createResultsDataIO,
  loadFolderSummaries as loadFolderSummariesCore,
  buildFolderItems as buildFolderItemsCore,
} from './resultsDataLoader'
import {
  createResultsDedupIO,
  runPHashDedup as runPHashDedupCore,
} from './resultsDedupPipeline'
import {
  createResultsCropIO,
  runResultsAutoCropPipeline,
  runBaselineCropPipeline as runBaselineCropPipelineCore,
  type CroppedItem,
} from './resultsCropPipeline'
import type {
  ResultsReason,
  CropRect,
  CropEntry,
  RemovedEntry,
  ResultsFolder,
  BaselineCrop,
  AutoCropActionSummary,
  BaselineCropActionSummary,
  DedupActionSummary,
  ResultsItem,
  ResultsViewMode,
  ContextMode,
  AutoCropTarget,
  DedupCandidate,
} from './resultsTypes'
import { createLogger } from '@shared/utils/logger';
const log = createLogger('ResultsView');

export type {
  ResultsReason,
  CropRect,
  CropEntry,
  ResultsFolder,
  BaselineCrop,
  AutoCropActionSummary,
  BaselineCropActionSummary,
  DedupActionSummary,
  ResultsItem,
}

export interface UseResultsViewOptions {
  /** Fired once when a folder transitions from not-reviewed → reviewed. */
  onFolderReviewed?: (folder: ResultsFolder) => void
  /** Fired when a folder's `edited` latch is committed (a real edit landed). */
  onFolderEdited?: (folder: ResultsFolder) => void
}

export function useResultsView(options: UseResultsViewOptions = {}) {
  const folders = ref<ResultsFolder[]>([])
  const activeFolders = ref<Array<{ name: string; path: string }>>([])
  const trashEntries = ref<RemovedEntry[]>([])
  const cropEntries = ref<CropEntry[]>([])
  const currentView = ref<ResultsViewMode>('folders')
  const currentFolder = ref<ResultsFolder | null>(null)
  const lastVisitedFolderName = ref<string | null>(null)
  const folderItems = ref<ResultsItem[]>([])
  const selectedIds = ref<string[]>([])
  const selectedReason = ref<ResultsReason | ''>('')
  const contextMode = ref<ContextMode>('context')
  const thumbnails = ref<Record<string, string>>({})
  const thumbnailSize = ref(320)
  const isLoading = ref(false)
  const previewItem = ref<ResultsItem | null>(null)
  const baselineCrop = ref<BaselineCrop | null>(null)

  let thumbnailLoadVersion = 0

  // IO adapters wrap electronAPI for the extracted pipelines.
  const dataIO = createResultsDataIO()
  const dedupIO = createResultsDedupIO()
  const cropIO = createResultsCropIO()

  const currentFolderDisplayName = computed(() => {
    return currentFolder.value ? formatToolFolderName(currentFolder.value.name) : ''
  })

  const cropEntriesByOriginalPath = computed(() => {
    return new Map(cropEntries.value.map((entry) => [entry.originalPath, entry]))
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

  const canUseAsCropActionTarget = (item: ResultsItem) => {
    return item.status === 'active' ||
      (item.status === 'removed' && item.reason === 'ai_filtered_edit')
  }

  const canRestoreAndAutoCrop = computed(() => {
    const items = selectedRemovedItems.value
    if (items.length === 0) return false
    return items.every((item) => item.reason === 'ai_filtered_edit')
  })

  const canAutoCropActive = computed(() => {
    const items = selectedItems.value
    if (items.length === 0) return false
    return items.every((item) => item.status === 'active')
  })

  const canAutoCropSelected = computed(() => {
    const items = selectedItems.value
    if (items.length === 0) return false
    return items.every(canUseAsCropActionTarget)
  })

  const canCropAndDedup = computed(() => {
    const items = selectedItems.value
    if (items.length === 0) return false
    return items.every(
      (item) =>
        item.status === 'active' ||
        (item.status === 'removed' && item.reason === 'ai_filtered_edit'),
    )
  })

  const canSetCurrentAsBaseline = computed(() => {
    const item = previewItem.value
    return !!item && item.isCropped === true && !!item.cropRect
  })

  const canSetSelectedAsBaseline = computed(() => {
    const items = selectedItems.value
    if (items.length !== 1) return false
    const item = items[0]
    return item.isCropped === true && !!item.cropRect && !!(item.imagePath || item.originalPath)
  })

  const isCurrentPreviewBaseline = computed(() => {
    const item = previewItem.value
    const baseline = baselineCrop.value
    if (!item || !baseline) return false
    const path = item.imagePath || item.originalPath || ''
    return !!path && path === baseline.sourceImagePath
  })

  const canApplyBaselineActive = computed(() => {
    if (!baselineCrop.value) return false
    const items = selectedItems.value
    if (items.length === 0) return false
    return items.every((item) => item.status === 'active')
  })

  const canApplyBaselineMixed = computed(() => {
    if (!baselineCrop.value) return false
    const items = selectedItems.value
    if (items.length === 0) return false
    return items.every(canUseAsCropActionTarget)
  })

  const canApplyBaselineDedup = computed(() => canApplyBaselineMixed.value)

  const canApplyBaselineSelected = computed(() => canApplyBaselineMixed.value)

  const canRemoveDuplicatesInCurrentFolder = computed(() => {
    if (!currentFolder.value) return false
    return folderItems.value.filter((item) => item.status === 'active' && !!item.imagePath).length > 1
  })

  const hasCroppedInCurrentFolder = computed(() => {
    return folderItems.value.some((item) => item.status === 'active' && item.isCropped)
  })

  const hasAutoCroppedInCurrentFolder = computed(() => {
    return folderItems.value.some(
      (item) => item.status === 'active' && item.isCropped && item.isAutoCropped,
    )
  })

  const autoCropClient = createAutoCropWorkerClient()
  onUnmounted(() => autoCropClient.destroy())

  // Reviewed-on-dwell: once the user has had a folder open for REVIEW_DWELL_MS,
  // mark it reviewed when they return to the folder list — not while they're
  // still browsing it. Cancelled if they leave sooner. No-op for folders
  // without metadata.json.
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
    if (!folder.path) return
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
    if (!met || !folder?.path) return
    void markFolderReviewed(folder.path)
    // Reflect locally so the badge updates without a full reload.
    if (folder.metadata?.review && !folder.metadata.review.reviewed) {
      folder.metadata.review.reviewed = true
      folder.metadata.review.reviewedAt = new Date().toISOString()
      // Not-reviewed → reviewed edge (fires once): let the host react (auto-sync).
      options.onFolderReviewed?.(folder)
    }
  }

  onUnmounted(cancelReviewDwell)

  // Edited-on-return: crop/delete/restore actions stage an `edited` latch in
  // the main process immediately (see slideMetadataService.stageEdited), but
  // it's only written to metadata.json here, when the user returns to the
  // folder list — not while they're still browsing the folder.
  function commitEditLatch() {
    const folder = currentFolder.value
    if (!folder?.path) return
    const folderPath = folder.path
    void commitFolderEdited(folderPath).then((result) => {
      if (!result || !folder.metadata?.review) return
      folder.metadata.review.edited = true
      folder.metadata.review.editedAt = new Date().toISOString()
      if (typeof result.cropped === 'boolean') {
        folder.metadata.review.cropped = result.cropped
      }
      // A real edit was latched: let the host react (auto-sync).
      options.onFolderEdited?.(folder)
    })
  }

  onUnmounted(commitEditLatch)

  watch([selectedReason, contextMode], () => {
    selectedIds.value = []
  })

  async function loadFolderSummaries() {
    const result = await loadFolderSummariesCore(dataIO)
    activeFolders.value = result.activeFolders
    trashEntries.value = result.trashEntries
    cropEntries.value = result.cropEntries
    folders.value = result.folders
  }

  async function buildFolderItems(folder: ResultsFolder): Promise<ResultsItem[]> {
    const activeFolder = activeFolders.value.find((entry) => entry.name === folder.name)
    return buildFolderItemsCore(folder, {
      io: dataIO,
      activeFolderPath: activeFolder?.path,
      trashEntries: trashEntries.value,
      cropEntriesByOriginalPath: cropEntriesByOriginalPath.value,
    })
  }

  async function loadCurrentFolderItems(folder: ResultsFolder, previewImagePath?: string) {
    thumbnails.value = {}
    folderItems.value = await buildFolderItems(folder)

    if (previewImagePath) {
      const previewMatch = folderItems.value.find((item) => item.imagePath === previewImagePath || item.originalPath === previewImagePath)
      if (previewMatch) {
        await loadThumbnails([previewMatch], true)
        previewItem.value = previewMatch
        void loadThumbnails(folderItems.value.filter((item) => item.id !== previewMatch.id))
        return
      }

      previewItem.value = null
    }

    void loadThumbnails(folderItems.value, true)
  }

  async function loadThumbnails(items: ResultsItem[], reset = false) {
    const version = reset ? ++thumbnailLoadVersion : thumbnailLoadVersion

    for (const item of items) {
      if (version !== thumbnailLoadVersion) return
      if (thumbnails.value[item.id]) continue

      // A registered override (demo mode) draws a fabricated SVG slide instead
      // of reading a real file.
      if (overrides.resultImageSource) {
        thumbnails.value[item.id] = overrides.resultImageSource(item)
        continue
      }

      try {
        const base64 = item.status === 'removed' && item.trashPath
          ? await window.electronAPI.trash.getImageAsBase64(item.trashPath)
          : item.imagePath
            ? await window.electronAPI.pdfmaker.getImageAsBase64(item.imagePath)
            : null

        if (base64 && version === thumbnailLoadVersion) {
          thumbnails.value[item.id] = `data:image/png;base64,${base64}`
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
    lastVisitedFolderName.value = folder.name
    startReviewDwell(folder)
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
    thumbnails.value = {}
    thumbnailLoadVersion += 1
  }

  function toggleSelection(id: string) {
    const index = selectedIds.value.indexOf(id)
    if (index === -1) {
      selectedIds.value.push(id)
    } else {
      selectedIds.value.splice(index, 1)
    }
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
      for (const item of selectedActiveItems.value) {
        if (item.imagePath) {
          await window.electronAPI.pdfmaker.deleteImage(item.imagePath)
        }
      }

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
      await window.electronAPI.trash.restore(ids)
      await refresh()
    } catch (error) {
      log.error('Failed to restore selected images:', error)
    } finally {
      isLoading.value = false
    }
  }

  type CropScope = 'mixed' | 'active' | 'removed'

  function buildCropTargets(scope: CropScope): AutoCropTarget[] {
    const items =
      scope === 'active' ? selectedActiveItems.value :
      scope === 'removed' ? selectedRemovedItems.value :
      selectedItems.value
    return items.map((item) => {
      const isRemoved = item.status === 'removed'
      return {
        id: isRemoved ? item.id : undefined,
        originalPath: isRemoved
          ? item.originalPath || ''
          : item.imagePath || item.originalPath || '',
        filename: item.name,
        needsRestore: isRemoved,
      }
    })
  }

  async function readDetectConfig() {
    const appConfig = configStore
    const slideCfg = appConfig.slideExtraction
    return {
      detectConfig: {
        mode: slideCfg?.autoCropDetectorMode ?? 'canny_then_yolo',
        canny: slideCfg?.autoCrop,
        yolo: slideCfg?.autoCropYolo,
      } as const,
      pHashThreshold: slideCfg?.pHashThreshold ?? 10,
    }
  }

  async function dedupAfterCrop(
    folder: ResultsFolder | null,
    croppedItems: CroppedItem[],
    pHashThreshold: number,
  ): Promise<{ deduped: number; failed: number; croppedDelta: number }> {
    if (!folder || croppedItems.length === 0) {
      return { deduped: 0, failed: 0, croppedDelta: 0 }
    }
    // Refresh active folder map before dedup so we hash the freshest set of
    // existing images in the folder, not stale paths.
    await loadFolderSummaries()
    const activeFolder = activeFolders.value.find((f) => f.name === folder.name)
    const dedupResult = await runPHashDedupCore(folder, croppedItems, {
      pHashThreshold,
      activeFolderPath: activeFolder?.path,
      io: dedupIO,
    })
    return dedupResult
  }

  interface CropActionResult {
    cropped: number
    noDetection: number
    outOfBounds: number
    deduped: number
    failed: number
  }

  /**
   * Shared skeleton for the seven crop actions: guard → build targets from the
   * selection scope → run the auto/baseline pipeline → optionally pHash-dedup
   * the fresh crops → refresh. The exported wrappers pick the summary fields
   * their callers expect.
   */
  async function runCropAction(opts: {
    canRun: boolean
    scope: CropScope
    pipeline: 'auto' | 'baseline'
    dedup: boolean
    requireFolder: boolean
    errorLabel: string
  }): Promise<CropActionResult> {
    const summary: CropActionResult = { cropped: 0, noDetection: 0, outOfBounds: 0, deduped: 0, failed: 0 }
    if (!opts.canRun) return summary
    const baselineRect = opts.pipeline === 'baseline' ? baselineCrop.value?.rect : undefined
    if (opts.pipeline === 'baseline' && !baselineRect) return summary

    const folder = currentFolder.value
    if (opts.requireFolder && !folder) return summary

    isLoading.value = true
    try {
      const targets = buildCropTargets(opts.scope)
      let pHashThreshold: number | null = null
      let cropResult: { cropped: number; failed: number; croppedItems: CroppedItem[] }

      if (opts.pipeline === 'auto') {
        const cfg = await readDetectConfig()
        pHashThreshold = cfg.pHashThreshold
        const res = await runResultsAutoCropPipeline(targets, autoCropClient, cfg.detectConfig, cropIO)
        summary.noDetection = res.noDetection
        cropResult = res
      } else {
        const res = await runBaselineCropPipelineCore(targets, baselineRect!, cropIO)
        summary.outOfBounds = res.outOfBounds
        cropResult = res
      }
      summary.cropped = cropResult.cropped
      summary.failed = cropResult.failed

      if (opts.dedup && cropResult.croppedItems.length > 0) {
        if (pHashThreshold === null) pHashThreshold = (await readDetectConfig()).pHashThreshold
        const dedup = await dedupAfterCrop(folder, cropResult.croppedItems, pHashThreshold)
        summary.cropped = Math.max(0, summary.cropped + dedup.croppedDelta)
        summary.deduped = dedup.deduped
        summary.failed += dedup.failed
      }

      await refresh()
    } catch (error) {
      log.error(`Failed to ${opts.errorLabel}:`, error)
    } finally {
      isLoading.value = false
    }

    return summary
  }

  async function autoCropSelected(
    options: { removeDuplicates?: boolean } = {},
  ): Promise<AutoCropActionSummary> {
    const s = await runCropAction({
      canRun: canAutoCropSelected.value,
      scope: 'mixed',
      pipeline: 'auto',
      dedup: options.removeDuplicates === true,
      requireFolder: false,
      errorLabel: 'auto-crop selected items',
    })
    return { cropped: s.cropped, noDetection: s.noDetection, deduped: s.deduped, failed: s.failed }
  }

  async function autoCropSelectedActive(): Promise<{ cropped: number; noDetection: number; failed: number }> {
    const s = await runCropAction({
      canRun: canAutoCropActive.value,
      scope: 'active',
      pipeline: 'auto',
      dedup: false,
      requireFolder: false,
      errorLabel: 'auto-crop selected active items',
    })
    return { cropped: s.cropped, noDetection: s.noDetection, failed: s.failed }
  }

  async function restoreAndAutoCropSelected(): Promise<{ cropped: number; noDetection: number; failed: number }> {
    const s = await runCropAction({
      canRun: canRestoreAndAutoCrop.value,
      scope: 'removed',
      pipeline: 'auto',
      dedup: false,
      requireFolder: false,
      errorLabel: 'restore and auto-crop selected',
    })
    return { cropped: s.cropped, noDetection: s.noDetection, failed: s.failed }
  }

  async function cropAndDedupSelected(): Promise<{ cropped: number; noDetection: number; deduped: number; failed: number }> {
    const s = await runCropAction({
      canRun: canCropAndDedup.value,
      scope: 'mixed',
      pipeline: 'auto',
      dedup: true,
      requireFolder: true,
      errorLabel: 'restore, auto-crop and dedup selected',
    })
    return { cropped: s.cropped, noDetection: s.noDetection, deduped: s.deduped, failed: s.failed }
  }

  function setBaselineCrop(item: ResultsItem): boolean {
    if (!item.isCropped || !item.cropRect) return false
    const path = item.imagePath || item.originalPath || ''
    if (!path) return false

    baselineCrop.value = {
      rect: { ...item.cropRect },
      sourceFilename: item.name,
      sourceImagePath: path,
    }
    return true
  }

  function setSelectedBaselineCrop(): boolean {
    if (!canSetSelectedAsBaseline.value) return false
    const didSet = setBaselineCrop(selectedItems.value[0])
    if (didSet) {
      selectedIds.value = []
    }
    return didSet
  }

  function clearBaselineCrop() {
    baselineCrop.value = null
  }

  async function applyBaselineToSelected(
    options: { removeDuplicates?: boolean } = {},
  ): Promise<BaselineCropActionSummary> {
    const s = await runCropAction({
      canRun: canApplyBaselineSelected.value,
      scope: 'mixed',
      pipeline: 'baseline',
      dedup: options.removeDuplicates === true,
      requireFolder: false,
      errorLabel: 'apply baseline crop to selected',
    })
    return { cropped: s.cropped, outOfBounds: s.outOfBounds, deduped: s.deduped, failed: s.failed }
  }

  async function restoreAndApplyBaselineSelected(): Promise<{ cropped: number; outOfBounds: number; failed: number }> {
    const s = await runCropAction({
      canRun: canApplyBaselineMixed.value,
      scope: 'mixed',
      pipeline: 'baseline',
      dedup: false,
      requireFolder: false,
      errorLabel: 'restore and apply baseline crop',
    })
    return { cropped: s.cropped, outOfBounds: s.outOfBounds, failed: s.failed }
  }

  async function applyBaselineAndDedupSelected(): Promise<{ cropped: number; outOfBounds: number; deduped: number; failed: number }> {
    const s = await runCropAction({
      canRun: canApplyBaselineDedup.value,
      scope: 'mixed',
      pipeline: 'baseline',
      dedup: true,
      requireFolder: true,
      errorLabel: 'apply baseline crop and dedup',
    })
    return { cropped: s.cropped, outOfBounds: s.outOfBounds, deduped: s.deduped, failed: s.failed }
  }

  async function removeDuplicatesInCurrentFolder(): Promise<DedupActionSummary> {
    const summary = { deduped: 0, failed: 0 }
    const folder = currentFolder.value
    if (!folder || !canRemoveDuplicatesInCurrentFolder.value) return summary

    isLoading.value = true
    try {
      const candidates: DedupCandidate[] = folderItems.value
        .filter((item) => item.status === 'active' && !!item.imagePath)
        .map((item) => ({
          originalPath: item.imagePath || '',
          filename: item.name,
        }))

      const { pHashThreshold } = await readDetectConfig()
      const dedup = await dedupAfterCrop(folder, candidates, pHashThreshold)
      summary.deduped = dedup.deduped
      summary.failed = dedup.failed
      await refresh()
    } catch (error) {
      log.error('Failed to remove duplicates in current folder:', error)
      summary.failed++
    } finally {
      isLoading.value = false
    }

    return summary
  }

  async function restoreCropsInFolder(
    predicate: (item: ResultsItem) => boolean,
  ): Promise<{ restored: number; failed: number }> {
    const summary = { restored: 0, failed: 0 }
    const targets = folderItems.value.filter(predicate)
    if (targets.length === 0) return summary

    isLoading.value = true
    try {
      for (const item of targets) {
        const path = item.imagePath || item.originalPath || ''
        if (!path) {
          summary.failed++
          continue
        }
        try {
          await window.electronAPI.crop.restore(path)
          summary.restored++
        } catch (err) {
          log.error(`Failed to restore crop for ${path}:`, err)
          summary.failed++
        }
      }
      await refresh()
    } catch (error) {
      log.error('Failed to restore crops in folder:', error)
    } finally {
      isLoading.value = false
    }

    return summary
  }

  async function restoreAllCroppedInFolder(): Promise<{ restored: number; failed: number }> {
    return restoreCropsInFolder((item) => item.status === 'active' && !!item.isCropped)
  }

  async function restoreAutoCroppedInFolder(): Promise<{ restored: number; failed: number }> {
    return restoreCropsInFolder(
      (item) => item.status === 'active' && !!item.isCropped && !!item.isAutoCropped,
    )
  }

  async function clearTrash(ids?: string[]) {
    isLoading.value = true
    try {
      if (ids && ids.length > 0) {
        await window.electronAPI.trash.clearEntries(ids)
      } else {
        await window.electronAPI.trash.clear()
      }
      await refresh()
    } catch (error) {
      log.error('Failed to clear trash:', error)
    } finally {
      isLoading.value = false
    }
  }

  async function removeFolders(folderNames: string[]): Promise<{ removed: number; failed: number }> {
    const summary = { removed: 0, failed: 0 }
    if (!folderNames || folderNames.length === 0) return summary

    isLoading.value = true
    try {
      const result = await window.electronAPI.trash.removeFolders(folderNames)
      summary.removed = result.removed
      summary.failed = result.failed
      await refresh()
    } catch (error) {
      log.error('Failed to remove folders:', error)
    } finally {
      isLoading.value = false
    }

    return summary
  }

  async function refreshPreviewByImagePath(imagePath: string): Promise<boolean> {
    if (!currentFolder.value) return false

    try {
      await loadFolderSummaries()

      const refreshedFolder = folders.value.find((folder) => folder.name === currentFolder.value?.name)
      if (!refreshedFolder) {
        goBack()
        return false
      }

      currentFolder.value = refreshedFolder
      await loadCurrentFolderItems(refreshedFolder, imagePath)
      selectedIds.value = selectedIds.value.filter((id) => {
        return folderItems.value.some((item) => item.id === id)
      })
      return !!previewItem.value
    } catch (error) {
      log.error('Failed to refresh preview item:', error)
      return false
    }
  }

  async function applyCropToImage(imagePath: string, rect: CropRect, autoCropped?: boolean): Promise<boolean> {
    isLoading.value = true

    try {
      await window.electronAPI.crop.apply(imagePath, rect, autoCropped)
      return await refreshPreviewByImagePath(imagePath)
    } catch (error) {
      log.error('Failed to apply crop:', error)
      return false
    } finally {
      isLoading.value = false
    }
  }

  async function restoreCropFromImage(imagePath: string): Promise<boolean> {
    isLoading.value = true

    try {
      await window.electronAPI.crop.restore(imagePath)
      return await refreshPreviewByImagePath(imagePath)
    } catch (error) {
      log.error('Failed to restore crop:', error)
      return false
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
    lastVisitedFolderName,
    currentFolderDisplayName,
    folderItems,
    filteredItems,
    selectedIds,
    selectedActiveItems,
    selectedRemovedItems,
    selectedReason,
    contextMode,
    thumbnails,
    thumbnailSize,
    isLoading,
    previewItem,
    baselineCrop,
    hasRemovedItems,
    canRestoreAndAutoCrop,
    canAutoCropActive,
    canAutoCropSelected,
    canCropAndDedup,
    canSetCurrentAsBaseline,
    canSetSelectedAsBaseline,
    isCurrentPreviewBaseline,
    canApplyBaselineActive,
    canApplyBaselineMixed,
    canApplyBaselineSelected,
    canApplyBaselineDedup,
    canRemoveDuplicatesInCurrentFolder,
    hasCroppedInCurrentFolder,
    hasAutoCroppedInCurrentFolder,
    trashEntries,
    openFolder,
    goBack,
    refresh,
    toggleSelection,
    openPreview,
    closePreview,
    deleteSelected,
    restoreSelected,
    autoCropSelected,
    autoCropSelectedActive,
    restoreAndAutoCropSelected,
    cropAndDedupSelected,
    setBaselineCrop,
    setSelectedBaselineCrop,
    clearBaselineCrop,
    applyBaselineToSelected,
    restoreAndApplyBaselineSelected,
    applyBaselineAndDedupSelected,
    removeDuplicatesInCurrentFolder,
    restoreAllCroppedInFolder,
    restoreAutoCroppedInFolder,
    clearTrash,
    removeFolders,
    applyCropToImage,
    restoreCropFromImage,
    formatDate,
    formatToolFolderName,
  }
}
