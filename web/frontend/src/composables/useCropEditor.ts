// Crop-editor state machine for the web Slides preview modal.
// Ported from autoslides/src/renderer/features/results/useCropEditor.ts —
// pure rect math + pointer UI kept; Electron IPC / auto-crop / demo overrides
// replaced with slideStore Blob URLs and apply/restore callbacks.

import { computed, nextTick, onBeforeUnmount, ref, watch, type Ref } from 'vue'
import { getSlideCropSourceBlob } from '../lib/slideStore'
import type { CropRect, ResultsItem } from './resultsTypes'
import { createLogger } from '../lib/logger'

const log = createLogger('CropEditor')

export type CropHandle = 'nw' | 'ne' | 'sw' | 'se'

export type CropInteraction =
  | { mode: 'create'; startX: number; startY: number }
  | { mode: 'move'; startX: number; startY: number; originRect: CropRect }
  | { mode: 'resize'; startX: number; startY: number; originRect: CropRect; handle: CropHandle }

export interface CropEditorDeps {
  previewItem: Readonly<Ref<ResultsItem | null>>
  isLoading: Readonly<Ref<boolean>>
  thumbnails: Readonly<Ref<Record<string, string>>>
  applyCropToImage: (imagePath: string, rect: CropRect, autoCropped?: boolean) => Promise<boolean>
  restoreCropFromImage: (imagePath: string) => Promise<boolean>
}

const minimumCropSize = 20

export function useCropEditor(deps: CropEditorDeps) {
  const { previewItem, isLoading, thumbnails, applyCropToImage, restoreCropFromImage } = deps

  const isCropMode = ref(false)
  const cropEditorImageSrc = ref('')
  const cropImageNaturalSize = ref({ width: 0, height: 0 })
  const cropRectPx = ref<CropRect | null>(null)
  const cropInteraction = ref<CropInteraction | null>(null)
  const previewStageShell = ref<HTMLDivElement | null>(null)
  const previewStage = ref<HTMLDivElement | null>(null)
  const previewStageShellSize = ref({ width: 0, height: 0 })
  const previewResizeObserver = ref<ResizeObserver | null>(null)
  const cropSourceRequestId = ref(0)
  /** Object URL for crop-source bytes; revoked on reset. */
  let cropSourceObjectUrl: string | null = null

  const previewImageSrc = computed(() => {
    if (!previewItem.value) return ''
    if (isCropMode.value) {
      return cropEditorImageSrc.value
    }

    // Prefer path-keyed thumbs (same keys as useResultsView).
    const item = previewItem.value
    const key =
      item.status === 'removed'
        ? item.trashPath || item.originalPath
        : item.imagePath || item.originalPath || item.id
    if (key && thumbnails.value[key]) return thumbnails.value[key]
    return thumbnails.value[item.id] || ''
  })

  const canCropPreview = computed(() => {
    const item = previewItem.value
    if (!item || isLoading.value) return false
    // Web scope this step: active slides only (no ai_filtered_edit restore-and-crop).
    return item.status === 'active' && !!item.imagePath
  })

  const canRestoreCrop = computed(() => {
    const item = previewItem.value
    return canCropPreview.value && item?.status === 'active' && !!item?.isCropped
  })

  const canRecrop = computed(() => {
    // On web, originalBlob is the backup; cropRect presence is enough.
    return canRestoreCrop.value && !!previewItem.value?.cropRect
  })

  const canStartCrop = computed(() => {
    const item = previewItem.value
    if (!canCropPreview.value) return false
    if (item?.status === 'active') return !item?.isCropped
    return false
  })

  const canApplyCrop = computed(() => {
    if (!isCropMode.value || !previewItem.value?.imagePath || !cropRectPx.value) {
      return false
    }
    return cropRectPx.value.width >= minimumCropSize && cropRectPx.value.height >= minimumCropSize
  })

  const canSetBaseline = computed(() => {
    const item = previewItem.value
    return !!item && item.status === 'active' && !!item.isCropped && !!item.cropRect
  })

  const previewStageStyle = computed(() => {
    if (
      !isCropMode.value ||
      cropImageNaturalSize.value.width === 0 ||
      cropImageNaturalSize.value.height === 0 ||
      previewStageShellSize.value.width === 0 ||
      previewStageShellSize.value.height === 0
    ) {
      return {}
    }

    const scale = Math.min(
      previewStageShellSize.value.width / cropImageNaturalSize.value.width,
      previewStageShellSize.value.height / cropImageNaturalSize.value.height,
    )

    return {
      width: `${Math.max(1, Math.round(cropImageNaturalSize.value.width * scale))}px`,
      height: `${Math.max(1, Math.round(cropImageNaturalSize.value.height * scale))}px`,
    }
  })

  const cropSelectionStyle = computed(() => {
    if (
      !isCropMode.value ||
      !cropRectPx.value ||
      cropImageNaturalSize.value.width === 0 ||
      cropImageNaturalSize.value.height === 0 ||
      previewStageShellSize.value.width === 0 ||
      previewStageShellSize.value.height === 0
    ) {
      return {}
    }

    const scale = Math.min(
      previewStageShellSize.value.width / cropImageNaturalSize.value.width,
      previewStageShellSize.value.height / cropImageNaturalSize.value.height,
    )

    return {
      left: `${cropRectPx.value.x * scale}px`,
      top: `${cropRectPx.value.y * scale}px`,
      width: `${cropRectPx.value.width * scale}px`,
      height: `${cropRectPx.value.height * scale}px`,
    }
  })

  const revokeCropSourceUrl = () => {
    if (cropSourceObjectUrl) {
      URL.revokeObjectURL(cropSourceObjectUrl)
      cropSourceObjectUrl = null
    }
  }

  const resetCropState = () => {
    isCropMode.value = false
    cropEditorImageSrc.value = ''
    cropImageNaturalSize.value = { width: 0, height: 0 }
    cropRectPx.value = null
    cropInteraction.value = null
    cropSourceRequestId.value += 1
    revokeCropSourceUrl()
  }

  const disconnectPreviewResizeObserver = () => {
    previewResizeObserver.value?.disconnect()
    previewResizeObserver.value = null
  }

  const updatePreviewStageShellSize = () => {
    if (!previewStageShell.value) {
      previewStageShellSize.value = { width: 0, height: 0 }
      return
    }

    previewStageShellSize.value = {
      width: previewStageShell.value.clientWidth,
      height: previewStageShell.value.clientHeight,
    }
  }

  const observePreviewStageShell = async () => {
    await nextTick()
    disconnectPreviewResizeObserver()
    updatePreviewStageShellSize()

    if (typeof ResizeObserver !== 'undefined' && previewStageShell.value) {
      previewResizeObserver.value = new ResizeObserver(() => {
        updatePreviewStageShellSize()
      })
      previewResizeObserver.value.observe(previewStageShell.value)
    }
  }

  const normalizeCropRect = (startX: number, startY: number, endX: number, endY: number): CropRect => {
    return {
      x: Math.min(startX, endX),
      y: Math.min(startY, endY),
      width: Math.abs(endX - startX),
      height: Math.abs(endY - startY),
    }
  }

  const sanitizeCropRect = (rect: CropRect): CropRect | null => {
    if (cropImageNaturalSize.value.width === 0 || cropImageNaturalSize.value.height === 0) {
      return null
    }

    const maxWidth = cropImageNaturalSize.value.width
    const maxHeight = cropImageNaturalSize.value.height
    const x = Math.max(0, Math.min(Math.round(rect.x), maxWidth))
    const y = Math.max(0, Math.min(Math.round(rect.y), maxHeight))
    const right = Math.max(x, Math.min(Math.round(rect.x + rect.width), maxWidth))
    const bottom = Math.max(y, Math.min(Math.round(rect.y + rect.height), maxHeight))
    const width = right - x
    const height = bottom - y

    if (width <= 0 || height <= 0) {
      return null
    }

    return { x, y, width, height }
  }

  const getCropPointFromEvent = (event: PointerEvent) => {
    if (!previewStage.value || cropImageNaturalSize.value.width === 0 || cropImageNaturalSize.value.height === 0) {
      return null
    }

    const stageRect = previewStage.value.getBoundingClientRect()
    if (stageRect.width === 0 || stageRect.height === 0) {
      return null
    }

    const x = Math.max(0, Math.min(event.clientX - stageRect.left, stageRect.width))
    const y = Math.max(0, Math.min(event.clientY - stageRect.top, stageRect.height))

    return {
      x: (x / stageRect.width) * cropImageNaturalSize.value.width,
      y: (y / stageRect.height) * cropImageNaturalSize.value.height,
    }
  }

  const resizeCropRect = (
    originRect: CropRect,
    point: { x: number; y: number },
    handle: CropHandle,
  ): CropRect => {
    const maxWidth = cropImageNaturalSize.value.width
    const maxHeight = cropImageNaturalSize.value.height
    let left = originRect.x
    let top = originRect.y
    let right = originRect.x + originRect.width
    let bottom = originRect.y + originRect.height

    if (handle.includes('n')) {
      top = Math.max(0, Math.min(point.y, bottom - minimumCropSize))
    }
    if (handle.includes('s')) {
      bottom = Math.min(maxHeight, Math.max(point.y, top + minimumCropSize))
    }
    if (handle.includes('w')) {
      left = Math.max(0, Math.min(point.x, right - minimumCropSize))
    }
    if (handle.includes('e')) {
      right = Math.min(maxWidth, Math.max(point.x, left + minimumCropSize))
    }

    return {
      x: left,
      y: top,
      width: right - left,
      height: bottom - top,
    }
  }

  const loadImageSize = (src: string): Promise<{ width: number; height: number }> => {
    return new Promise((resolve, reject) => {
      const image = new window.Image()
      image.onload = () => {
        resolve({
          width: image.naturalWidth,
          height: image.naturalHeight,
        })
      }
      image.onerror = () => {
        reject(new Error('Failed to load crop source image'))
      }
      image.src = src
    })
  }

  const handlePreviewImageLoad = (event: Event) => {
    if (!isCropMode.value) return

    const target = event.target as HTMLImageElement
    if (cropImageNaturalSize.value.width === 0 || cropImageNaturalSize.value.height === 0) {
      cropImageNaturalSize.value = {
        width: target.naturalWidth,
        height: target.naturalHeight,
      }
    }

    if (cropRectPx.value) {
      cropRectPx.value = sanitizeCropRect(cropRectPx.value)
    }

    updatePreviewStageShellSize()
  }

  const startCropMode = async () => {
    const activeItem = previewItem.value
    if (!activeItem || (!canStartCrop.value && !canRecrop.value)) return
    if (activeItem.status !== 'active' || !activeItem.imagePath) return

    const requestId = cropSourceRequestId.value + 1
    cropSourceRequestId.value = requestId

    try {
      const sourceBlob = await getSlideCropSourceBlob(activeItem.imagePath)
      if (!sourceBlob) return
      if (requestId !== cropSourceRequestId.value) return

      revokeCropSourceUrl()
      cropSourceObjectUrl = URL.createObjectURL(sourceBlob)
      const cropSource = cropSourceObjectUrl

      const size = await loadImageSize(cropSource)
      if (requestId !== cropSourceRequestId.value) return

      cropEditorImageSrc.value = cropSource
      cropImageNaturalSize.value = size
      cropRectPx.value =
        activeItem.isCropped && activeItem.cropRect
          ? sanitizeCropRect({ ...activeItem.cropRect })
          : null

      cropInteraction.value = null
      isCropMode.value = true
      await observePreviewStageShell()
    } catch (error) {
      log.error('Failed to load crop editor source:', error)
    }
  }

  const cancelCropMode = () => {
    resetCropState()
  }

  const handleCropStagePointerDown = (event: PointerEvent) => {
    if (!isCropMode.value || event.button !== 0) return

    const point = getCropPointFromEvent(event)
    if (!point) return

    event.preventDefault()
    cropInteraction.value = {
      mode: 'create',
      startX: point.x,
      startY: point.y,
    }
    cropRectPx.value = {
      x: point.x,
      y: point.y,
      width: 0,
      height: 0,
    }
  }

  const startCropInteraction = (mode: 'move' | CropHandle, event: PointerEvent) => {
    if (!cropRectPx.value) return

    const point = getCropPointFromEvent(event)
    if (!point) return

    event.preventDefault()
    event.stopPropagation()
    cropInteraction.value =
      mode === 'move'
        ? { mode: 'move', startX: point.x, startY: point.y, originRect: { ...cropRectPx.value } }
        : {
            mode: 'resize',
            startX: point.x,
            startY: point.y,
            originRect: { ...cropRectPx.value },
            handle: mode,
          }
  }

  const handleGlobalCropPointerMove = (event: PointerEvent) => {
    if (!cropInteraction.value) return

    const point = getCropPointFromEvent(event)
    if (!point) return

    event.preventDefault()

    if (cropInteraction.value.mode === 'create') {
      cropRectPx.value = normalizeCropRect(
        cropInteraction.value.startX,
        cropInteraction.value.startY,
        point.x,
        point.y,
      )
      return
    }

    if (cropInteraction.value.mode === 'move') {
      const maxX = cropImageNaturalSize.value.width - cropInteraction.value.originRect.width
      const maxY = cropImageNaturalSize.value.height - cropInteraction.value.originRect.height
      const nextX = Math.max(
        0,
        Math.min(
          cropInteraction.value.originRect.x + (point.x - cropInteraction.value.startX),
          maxX,
        ),
      )
      const nextY = Math.max(
        0,
        Math.min(
          cropInteraction.value.originRect.y + (point.y - cropInteraction.value.startY),
          maxY,
        ),
      )
      cropRectPx.value = {
        ...cropInteraction.value.originRect,
        x: nextX,
        y: nextY,
      }
      return
    }

    cropRectPx.value = resizeCropRect(
      cropInteraction.value.originRect,
      point,
      cropInteraction.value.handle,
    )
  }

  const handleGlobalCropPointerUp = () => {
    if (!cropInteraction.value) return

    if (cropRectPx.value) {
      const sanitized = sanitizeCropRect(cropRectPx.value)
      if (!sanitized || sanitized.width < minimumCropSize || sanitized.height < minimumCropSize) {
        cropRectPx.value = null
      } else {
        cropRectPx.value = sanitized
      }
    }

    cropInteraction.value = null
  }

  const applyCrop = async () => {
    const item = previewItem.value
    if (!item || !cropRectPx.value) return

    const rect = sanitizeCropRect(cropRectPx.value)
    if (!rect) return

    if (item.status !== 'active' || !item.imagePath) return

    const success = await applyCropToImage(item.imagePath, rect, false)
    if (success) {
      resetCropState()
    }
  }

  const restoreCrop = async () => {
    if (!previewItem.value?.imagePath || !previewItem.value.isCropped) return

    const success = await restoreCropFromImage(previewItem.value.imagePath)
    if (success) {
      resetCropState()
    }
  }

  // Leaving the preview item cancels crop mode.
  watch(
    () => previewItem.value?.id,
    (id, prev) => {
      if (id !== prev) {
        resetCropState()
      }
    },
  )

  watch(previewItem, async (item) => {
    if (!item) {
      disconnectPreviewResizeObserver()
      previewStageShellSize.value = { width: 0, height: 0 }
      return
    }
    if (isCropMode.value) {
      await observePreviewStageShell()
    }
  })

  window.addEventListener('pointermove', handleGlobalCropPointerMove)
  window.addEventListener('pointerup', handleGlobalCropPointerUp)

  onBeforeUnmount(() => {
    disconnectPreviewResizeObserver()
    window.removeEventListener('pointermove', handleGlobalCropPointerMove)
    window.removeEventListener('pointerup', handleGlobalCropPointerUp)
    revokeCropSourceUrl()
  })

  return {
    isCropMode,
    cropRectPx,
    previewStageShell,
    previewStage,
    previewImageSrc,
    canRestoreCrop,
    canRecrop,
    canStartCrop,
    canApplyCrop,
    canSetBaseline,
    previewStageStyle,
    cropSelectionStyle,
    resetCropState,
    handlePreviewImageLoad,
    startCropMode,
    cancelCropMode,
    handleCropStagePointerDown,
    startCropInteraction,
    applyCrop,
    restoreCrop,
  }
}
