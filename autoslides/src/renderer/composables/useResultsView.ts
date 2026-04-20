import { ref, computed, onMounted, watch } from 'vue'
import { compareToolFolders, compareToolImages, formatToolFolderName } from '../utils/toolWindowFolders'
import { useAutoCropDetect } from './useAutoCropDetect'

export type ResultsReason = 'duplicate' | 'exclusion' | 'ai_filtered' | 'ai_filtered_edit' | 'manual'
export interface CropRect {
  x: number
  y: number
  width: number
  height: number
}

export interface CropEntry {
  filename: string
  originalPath: string
  originalParentFolder: string
  cropPath: string
  rect: CropRect
  croppedAt: string
  autoCropped?: boolean
}

interface RemovedEntry {
  id: string
  filename: string
  originalPath: string
  originalParentFolder: string
  trashPath: string
  reason: ResultsReason
  reasonDetails?: string
  trashedAt: string
}

export interface ResultsFolder {
  name: string
  path?: string
  activeCount: number
  removedCount: number
}

export interface ResultsItem {
  id: string
  name: string
  status: 'active' | 'removed'
  imagePath?: string
  trashPath?: string
  originalPath?: string
  reason?: ResultsReason
  reasonDetails?: string
  trashedAt?: string
  isCropped?: boolean
  isAutoCropped?: boolean
  cropPath?: string
  cropRect?: CropRect
  croppedAt?: string
}

type ResultsViewMode = 'folders' | 'images'
type ContextMode = 'context' | 'removed-only' | 'extracted-only'

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

  let thumbnailLoadVersion = 0

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

  const canCropAndDedup = computed(() => {
    const items = selectedItems.value
    if (items.length === 0) return false
    return items.every(
      (item) =>
        item.status === 'active' ||
        (item.status === 'removed' && item.reason === 'ai_filtered_edit'),
    )
  })

  const { detectBbox } = useAutoCropDetect()

  watch([selectedReason, contextMode], () => {
    selectedIds.value = []
  })

  async function loadFolderSummaries() {
    const [activeFolderList, removedEntries, currentCropEntries] = await Promise.all([
      window.electronAPI.pdfmaker.getFolders(),
      window.electronAPI.trash.getEntries(),
      window.electronAPI.crop.getEntries(),
    ])

    activeFolders.value = activeFolderList
    trashEntries.value = removedEntries
    cropEntries.value = currentCropEntries

    const activeCounts = await Promise.all(
      activeFolderList.map(async (folder) => {
        try {
          const images = await window.electronAPI.pdfmaker.getImages(folder.path)
          return { folder, count: images.length }
        } catch (error) {
          console.warn(`Failed to count images for ${folder.name}:`, error)
          return { folder, count: 0 }
        }
      })
    )

    const folderMap = new Map<string, ResultsFolder>()

    for (const { folder, count } of activeCounts) {
      folderMap.set(folder.name, {
        name: folder.name,
        path: folder.path,
        activeCount: count,
        removedCount: 0,
      })
    }

    for (const entry of removedEntries) {
      const existing = folderMap.get(entry.originalParentFolder)
      if (existing) {
        existing.removedCount += 1
      } else {
        folderMap.set(entry.originalParentFolder, {
          name: entry.originalParentFolder,
          activeCount: 0,
          removedCount: 1,
        })
      }
    }

    folders.value = Array.from(folderMap.values()).sort((a, b) => compareToolFolders(a.name, b.name))
  }

  async function buildFolderItems(folder: ResultsFolder): Promise<ResultsItem[]> {
    const activeFolder = activeFolders.value.find((entry) => entry.name === folder.name)
    const cropMap = cropEntriesByOriginalPath.value

    let activeItems: ResultsItem[] = []
    if (activeFolder?.path) {
      try {
        const images = await window.electronAPI.pdfmaker.getImages(activeFolder.path)
        activeItems = images.map((image) => {
          const cropEntry = cropMap.get(image.path)

          return {
            id: image.path,
            name: image.name,
            status: 'active' as const,
            imagePath: image.path,
            originalPath: image.path,
            isCropped: !!cropEntry,
            isAutoCropped: cropEntry?.autoCropped ?? false,
            cropPath: cropEntry?.cropPath,
            cropRect: cropEntry?.rect,
            croppedAt: cropEntry?.croppedAt,
          }
        })
      } catch (error) {
        console.warn(`Failed to load images for ${folder.name}:`, error)
      }
    }

    const removedItems: ResultsItem[] = trashEntries.value
      .filter((entry) => entry.originalParentFolder === folder.name)
      .map((entry) => {
        const cropEntry = cropMap.get(entry.originalPath)

        return {
          id: entry.id,
          name: entry.filename,
          status: 'removed' as const,
          trashPath: entry.trashPath,
          originalPath: entry.originalPath,
          reason: entry.reason,
          reasonDetails: entry.reasonDetails,
          trashedAt: entry.trashedAt,
          isCropped: !!cropEntry,
          isAutoCropped: cropEntry?.autoCropped ?? false,
          cropPath: cropEntry?.cropPath,
          cropRect: cropEntry?.rect,
          croppedAt: cropEntry?.croppedAt,
        }
      })

    return [...activeItems, ...removedItems].sort((a, b) => compareToolImages(a.name, b.name))
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
    contextMode.value = 'context'
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
    contextMode.value = 'context'
    previewItem.value = null
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

  interface AutoCropTarget {
    id?: string
    originalPath: string
    filename: string
    needsRestore: boolean
  }

  async function runAutoCropPipeline(
    targets: AutoCropTarget[],
    summary: { cropped: number; noDetection: number; failed: number },
  ): Promise<Array<{ originalPath: string; filename: string }>> {
    const cropped: Array<{ originalPath: string; filename: string }> = []

    const restoreIds = targets
      .filter((t) => t.needsRestore && t.id)
      .map((t) => t.id as string)
    if (restoreIds.length > 0) {
      await window.electronAPI.trash.restore(restoreIds)
    }

    const appConfig = await window.electronAPI.config.get()
    const slideCfg = appConfig.slideExtraction
    const detectConfig = {
      mode: slideCfg?.autoCropDetectorMode ?? 'canny_then_yolo',
      canny: slideCfg?.autoCrop,
      yolo: slideCfg?.autoCropYolo,
    } as const

    for (const target of targets) {
      if (!target.originalPath) {
        summary.failed++
        continue
      }
      try {
        const buffer = await window.electronAPI.offline.readImageBuffer(target.originalPath)
        const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer)
        const blobArrayBuffer = new ArrayBuffer(bytes.byteLength)
        new Uint8Array(blobArrayBuffer).set(bytes)
        const blob = new Blob([blobArrayBuffer], { type: 'image/*' })
        const bitmap = await createImageBitmap(blob)

        const canvas = new OffscreenCanvas(bitmap.width, bitmap.height)
        const ctx = canvas.getContext('2d')
        if (!ctx) {
          bitmap.close()
          summary.failed++
          continue
        }
        ctx.drawImage(bitmap, 0, 0)
        const imageData = ctx.getImageData(0, 0, bitmap.width, bitmap.height)
        bitmap.close()

        const response = await detectBbox(imageData, false, detectConfig)
        if (!response.success || !response.result?.bbox) {
          if (!response.success) summary.failed++
          else summary.noDetection++
          continue
        }

        const { x, y, w, h } = response.result.bbox
        await window.electronAPI.crop.apply(target.originalPath, { x, y, width: w, height: h }, true)
        summary.cropped++
        cropped.push({ originalPath: target.originalPath, filename: target.filename })
      } catch (err) {
        console.error(`Failed to autocrop ${target.originalPath}:`, err)
        summary.failed++
      }
    }

    return cropped
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

      await runAutoCropPipeline(targets, summary)
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

      await runAutoCropPipeline(targets, summary)
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

      const cropSummary = { cropped: 0, noDetection: 0, failed: 0 }
      const croppedItems = await runAutoCropPipeline(targets, cropSummary)
      summary.cropped = cropSummary.cropped
      summary.noDetection = cropSummary.noDetection
      summary.failed = cropSummary.failed

      if (croppedItems.length > 0) {
        const appConfig = await window.electronAPI.config.get()
        const pHashThreshold = appConfig.slideExtraction?.pHashThreshold ?? 10

        await loadFolderSummaries()
        const activeFolder = activeFolders.value.find((f) => f.name === folder.name)

        const worker = new Worker(
          new URL('../workers/postProcessor.worker.ts', import.meta.url),
          { type: 'module' },
        )

        const calculatePHash = (imageData: ImageData): Promise<string> => {
          return new Promise((resolve, reject) => {
            const messageId = `pHash_${Date.now()}_${Math.random()}`
            const messageHandler = (event: MessageEvent) => {
              const { id, success, result, error } = event.data
              if (id === messageId) {
                worker.removeEventListener('message', messageHandler)
                success ? resolve(result) : reject(new Error(error))
              }
            }
            worker.addEventListener('message', messageHandler)
            worker.postMessage({ id: messageId, type: 'calculatePHash', data: { imageData } })
          })
        }

        const calculateHammingDistance = (hash1: string, hash2: string): Promise<number> => {
          return new Promise((resolve, reject) => {
            const messageId = `hamming_${Date.now()}_${Math.random()}`
            const messageHandler = (event: MessageEvent) => {
              const { id, success, result, error } = event.data
              if (id === messageId) {
                worker.removeEventListener('message', messageHandler)
                success ? resolve(result) : reject(new Error(error))
              }
            }
            worker.addEventListener('message', messageHandler)
            worker.postMessage({ id: messageId, type: 'calculateHammingDistance', data: { hash1, hash2 } })
          })
        }

        const bufferToImageData = (buffer: Uint8Array): Promise<ImageData> => {
          return new Promise((resolve, reject) => {
            const blob = new Blob([buffer as BlobPart])
            const url = URL.createObjectURL(blob)
            const img = new Image()
            img.onload = () => {
              const canvas = document.createElement('canvas')
              canvas.width = img.width
              canvas.height = img.height
              const ctx = canvas.getContext('2d')
              if (!ctx) {
                URL.revokeObjectURL(url)
                reject(new Error('Failed to get canvas context'))
                return
              }
              ctx.drawImage(img, 0, 0)
              const imageData = ctx.getImageData(0, 0, img.width, img.height)
              URL.revokeObjectURL(url)
              resolve(imageData)
            }
            img.onerror = () => {
              URL.revokeObjectURL(url)
              reject(new Error('Failed to load image'))
            }
            img.src = url
          })
        }

        try {
          const seen: Array<{ filename: string; pHash: string }> = []
          const croppedSet = new Set(croppedItems.map((c) => c.originalPath))

          if (activeFolder?.path) {
            try {
              const existingImages = await window.electronAPI.pdfmaker.getImages(activeFolder.path)
              for (const img of existingImages) {
                if (croppedSet.has(img.path)) continue
                try {
                  const buffer = await window.electronAPI.offline.readImageBuffer(img.path)
                  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer)
                  const imageData = await bufferToImageData(bytes)
                  const pHash = await calculatePHash(imageData)
                  seen.push({ filename: img.name, pHash })
                } catch (err) {
                  console.warn(`Failed to compute pHash for existing ${img.path}:`, err)
                }
              }
            } catch (err) {
              console.warn('Failed to list existing images for dedup:', err)
            }
          }

          const folderPath = activeFolder?.path
          for (const item of croppedItems) {
            try {
              const buffer = await window.electronAPI.offline.readImageBuffer(item.originalPath)
              const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer)
              const imageData = await bufferToImageData(bytes)
              const pHash = await calculatePHash(imageData)

              let duplicateOf = ''
              for (const s of seen) {
                if (!s.pHash) continue
                const distance = await calculateHammingDistance(pHash, s.pHash)
                if (distance <= pHashThreshold) {
                  duplicateOf = s.filename
                  break
                }
              }

              if (duplicateOf && folderPath) {
                await window.electronAPI.slideExtraction.moveToInAppTrash(folderPath, item.filename, {
                  reason: 'duplicate',
                  reasonDetails: `Duplicate of ${duplicateOf}`,
                })
                summary.deduped++
                summary.cropped = Math.max(0, summary.cropped - 1)
              } else {
                seen.push({ filename: item.filename, pHash })
              }
            } catch (err) {
              console.warn(`Failed to dedup ${item.filename}:`, err)
            }
          }
        } finally {
          worker.terminate()
        }
      }

      await refresh()
    } catch (error) {
      console.error('Failed to restore, auto-crop and dedup selected:', error)
    } finally {
      isLoading.value = false
    }

    return summary
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
    hasRemovedItems,
    canRestoreAndAutoCrop,
    canAutoCropActive,
    canCropAndDedup,
    trashEntries,
    openFolder,
    goBack,
    refresh,
    toggleSelection,
    openPreview,
    closePreview,
    deleteSelected,
    restoreSelected,
    autoCropSelectedActive,
    restoreAndAutoCropSelected,
    cropAndDedupSelected,
    clearTrash,
    applyCropToImage,
    restoreCropFromImage,
    formatDate,
    formatToolFolderName,
  }
}
