import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { formatToolFolderName } from '@shared/utils/toolWindowFolders'
import { createAutoCropWorkerClient } from '@shared/autoCrop'
import { configStore } from '@shared/services/configStore'
import { isDemoMode, demoResultImageDataUri } from '@shared/services/demoData'
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

export function useResultsView() {
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

      // Demo mode: draw a fabricated SVG slide instead of reading a real file.
      if (isDemoMode()) {
        thumbnails.value[item.id] = demoResultImageDataUri(item)
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
        console.warn(`Failed to load thumbnail for ${item.name}:`, error)
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
      console.error('Failed to refresh results view:', error)
    } finally {
      isLoading.value = false
    }
  }

  async function openFolder(folder: ResultsFolder) {
    currentView.value = 'images'
    currentFolder.value = folder
    lastVisitedFolderName.value = folder.name
    selectedIds.value = []
    selectedReason.value = ''
    previewItem.value = null
    isLoading.value = true

    try {
      await loadCurrentFolderItems(folder)
    } catch (error) {
      console.error('Failed to open results folder:', error)
    } finally {
      isLoading.value = false
    }
  }

  function goBack() {
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
      console.error('Failed to delete selected images:', error)
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
      console.error('Failed to restore selected images:', error)
    } finally {
      isLoading.value = false
    }
  }

  function buildSelectedCropTargets(): AutoCropTarget[] {
    return selectedItems.value.map((item) => {
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

  async function autoCropSelected(
    options: { removeDuplicates?: boolean } = {},
  ): Promise<AutoCropActionSummary> {
    const summary = { cropped: 0, noDetection: 0, deduped: 0, failed: 0 }
    if (!canAutoCropSelected.value) return summary

    const folder = currentFolder.value

    isLoading.value = true
    try {
      const { detectConfig, pHashThreshold } = await readDetectConfig()
      const cropResult = await runResultsAutoCropPipeline(
        buildSelectedCropTargets(),
        autoCropClient,
        detectConfig,
        cropIO,
      )
      summary.cropped = cropResult.cropped
      summary.noDetection = cropResult.noDetection
      summary.failed = cropResult.failed

      if (options.removeDuplicates && cropResult.croppedItems.length > 0) {
        const dedup = await dedupAfterCrop(folder, cropResult.croppedItems, pHashThreshold)
        summary.cropped = Math.max(0, summary.cropped + dedup.croppedDelta)
        summary.deduped = dedup.deduped
        summary.failed += dedup.failed
      }

      await refresh()
    } catch (error) {
      console.error('Failed to auto-crop selected items:', error)
    } finally {
      isLoading.value = false
    }

    return summary
  }

  async function autoCropSelectedActive(): Promise<{ cropped: number; noDetection: number; failed: number }> {
    const summary = { cropped: 0, noDetection: 0, failed: 0 }
    if (!canAutoCropActive.value) return summary

    isLoading.value = true
    try {
      const targets: AutoCropTarget[] = selectedActiveItems.value.map((item) => ({
        originalPath: item.imagePath || item.originalPath || '',
        filename: item.name,
        needsRestore: false,
      }))

      const { detectConfig } = await readDetectConfig()
      const cropResult = await runResultsAutoCropPipeline(targets, autoCropClient, detectConfig, cropIO)
      summary.cropped = cropResult.cropped
      summary.noDetection = cropResult.noDetection
      summary.failed = cropResult.failed
      await refresh()
    } catch (error) {
      console.error('Failed to auto-crop selected active items:', error)
    } finally {
      isLoading.value = false
    }

    return summary
  }

  async function restoreAndAutoCropSelected(): Promise<{ cropped: number; noDetection: number; failed: number }> {
    const summary = { cropped: 0, noDetection: 0, failed: 0 }
    if (!canRestoreAndAutoCrop.value) return summary

    isLoading.value = true
    try {
      const targets: AutoCropTarget[] = selectedRemovedItems.value.map((item) => ({
        id: item.id,
        originalPath: item.originalPath || '',
        filename: item.name,
        needsRestore: true,
      }))

      const { detectConfig } = await readDetectConfig()
      const cropResult = await runResultsAutoCropPipeline(targets, autoCropClient, detectConfig, cropIO)
      summary.cropped = cropResult.cropped
      summary.noDetection = cropResult.noDetection
      summary.failed = cropResult.failed
      await refresh()
    } catch (error) {
      console.error('Failed to restore and auto-crop selected:', error)
    } finally {
      isLoading.value = false
    }

    return summary
  }

  async function cropAndDedupSelected(): Promise<{ cropped: number; noDetection: number; deduped: number; failed: number }> {
    const summary = { cropped: 0, noDetection: 0, deduped: 0, failed: 0 }
    if (!canCropAndDedup.value) return summary

    const folder = currentFolder.value
    if (!folder) return summary

    isLoading.value = true
    try {
      const targets: AutoCropTarget[] = selectedItems.value.map((item) => {
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

      const { detectConfig, pHashThreshold } = await readDetectConfig()
      const cropResult = await runResultsAutoCropPipeline(targets, autoCropClient, detectConfig, cropIO)
      summary.cropped = cropResult.cropped
      summary.noDetection = cropResult.noDetection
      summary.failed = cropResult.failed

      if (cropResult.croppedItems.length > 0) {
        const dedup = await dedupAfterCrop(folder, cropResult.croppedItems, pHashThreshold)
        summary.cropped = Math.max(0, summary.cropped + dedup.croppedDelta)
        summary.deduped = dedup.deduped
        summary.failed += dedup.failed
      }

      await refresh()
    } catch (error) {
      console.error('Failed to restore, auto-crop and dedup selected:', error)
    } finally {
      isLoading.value = false
    }

    return summary
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
    const summary = { cropped: 0, outOfBounds: 0, deduped: 0, failed: 0 }
    if (!canApplyBaselineSelected.value || !baselineCrop.value) return summary

    const folder = currentFolder.value

    isLoading.value = true
    try {
      const cropResult = await runBaselineCropPipelineCore(
        buildSelectedCropTargets(),
        baselineCrop.value.rect,
        cropIO,
      )
      summary.cropped = cropResult.cropped
      summary.outOfBounds = cropResult.outOfBounds
      summary.failed = cropResult.failed

      if (options.removeDuplicates && cropResult.croppedItems.length > 0) {
        const { pHashThreshold } = await readDetectConfig()
        const dedup = await dedupAfterCrop(folder, cropResult.croppedItems, pHashThreshold)
        summary.cropped = Math.max(0, summary.cropped + dedup.croppedDelta)
        summary.deduped = dedup.deduped
        summary.failed += dedup.failed
      }

      await refresh()
    } catch (error) {
      console.error('Failed to apply baseline crop to selected:', error)
    } finally {
      isLoading.value = false
    }

    return summary
  }

  async function restoreAndApplyBaselineSelected(): Promise<{ cropped: number; outOfBounds: number; failed: number }> {
    const summary = { cropped: 0, outOfBounds: 0, failed: 0 }
    if (!canApplyBaselineMixed.value || !baselineCrop.value) return summary

    isLoading.value = true
    try {
      const targets: AutoCropTarget[] = selectedItems.value.map((item) => {
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
      const cropResult = await runBaselineCropPipelineCore(targets, baselineCrop.value.rect, cropIO)
      summary.cropped = cropResult.cropped
      summary.outOfBounds = cropResult.outOfBounds
      summary.failed = cropResult.failed
      await refresh()
    } catch (error) {
      console.error('Failed to restore and apply baseline crop:', error)
    } finally {
      isLoading.value = false
    }

    return summary
  }

  async function applyBaselineAndDedupSelected(): Promise<{ cropped: number; outOfBounds: number; deduped: number; failed: number }> {
    const summary = { cropped: 0, outOfBounds: 0, deduped: 0, failed: 0 }
    if (!canApplyBaselineDedup.value || !baselineCrop.value) return summary

    const folder = currentFolder.value
    if (!folder) return summary

    isLoading.value = true
    try {
      const targets: AutoCropTarget[] = selectedItems.value.map((item) => {
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

      const cropResult = await runBaselineCropPipelineCore(targets, baselineCrop.value.rect, cropIO)
      summary.cropped = cropResult.cropped
      summary.outOfBounds = cropResult.outOfBounds
      summary.failed = cropResult.failed

      if (cropResult.croppedItems.length > 0) {
        const { pHashThreshold } = await readDetectConfig()
        const dedup = await dedupAfterCrop(folder, cropResult.croppedItems, pHashThreshold)
        summary.cropped = Math.max(0, summary.cropped + dedup.croppedDelta)
        summary.deduped = dedup.deduped
        summary.failed += dedup.failed
      }

      await refresh()
    } catch (error) {
      console.error('Failed to apply baseline crop and dedup:', error)
    } finally {
      isLoading.value = false
    }

    return summary
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
      console.error('Failed to remove duplicates in current folder:', error)
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
          console.error(`Failed to restore crop for ${path}:`, err)
          summary.failed++
        }
      }
      await refresh()
    } catch (error) {
      console.error('Failed to restore crops in folder:', error)
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
      console.error('Failed to clear trash:', error)
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
      console.error('Failed to remove folders:', error)
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
      console.error('Failed to refresh preview item:', error)
      return false
    }
  }

  async function applyCropToImage(imagePath: string, rect: CropRect, autoCropped?: boolean): Promise<boolean> {
    isLoading.value = true

    try {
      await window.electronAPI.crop.apply(imagePath, rect, autoCropped)
      return await refreshPreviewByImagePath(imagePath)
    } catch (error) {
      console.error('Failed to apply crop:', error)
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
      console.error('Failed to restore crop:', error)
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
