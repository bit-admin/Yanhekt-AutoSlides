import { computed, nextTick, onBeforeUnmount, ref, watch, type Ref } from 'vue'
import type { AutoCropWorkerClient } from '@shared/autoCrop'
import { decodeBase64ToImageData } from '@shared/utils/imageDecode'
import { configStore } from '@shared/services/configStore'
import { overrides } from '@shared/overrideRegistry'
import type { CropRect, ResultsItem } from './useResultsView'
import { createLogger } from '@shared/utils/logger';
const log = createLogger('CropEditor');

export type CropHandle = 'nw' | 'ne' | 'sw' | 'se'

export type CropInteraction =
  | { mode: 'create'; startX: number; startY: number }
  | { mode: 'move'; startX: number; startY: number; originRect: CropRect }
  | { mode: 'resize'; startX: number; startY: number; originRect: CropRect; handle: CropHandle }

export interface CropEditorDeps {
  previewItem: Readonly<Ref<ResultsItem | null>>
  isLoading: Readonly<Ref<boolean>>
  thumbnails: Readonly<Ref<Record<string, string>>>
  /** ResultsWindow's metadata-visibility flag; crop actions collapse it. */
  showPreviewMetadata: Ref<boolean>
  applyCropToImage: (imagePath: string, rect: CropRect, autoCropped?: boolean) => Promise<boolean>
  restoreCropFromImage: (imagePath: string) => Promise<boolean>
  detectBbox: AutoCropWorkerClient['detectBbox']
  t: (key: string, ...args: unknown[]) => string
}

const minimumCropSize = 20

/**
 * Crop-editor state machine for the Results View preview modal. Extracted
 * verbatim from ResultsWindow.vue — the 12 reactive refs, 7 computed, the
 * pointer/ResizeObserver interaction handlers, and the apply/restore actions.
 * ResultsWindow destructures the return into the same names it used inline, so
 * the template is unchanged.
 */
export function useCropEditor(deps: CropEditorDeps) {
  const { previewItem, isLoading, thumbnails, showPreviewMetadata, applyCropToImage, restoreCropFromImage, detectBbox, t } = deps

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
  const isAutoCropDetecting = ref(false)
  const isAutoCropPending = ref(false)

  const previewImageSrc = computed(() => {
    if (!previewItem.value) return ''
    if (isCropMode.value) {
      return cropEditorImageSrc.value
    }

    return thumbnails.value[previewItem.value.id] || ''
  })

  const canCropPreview = computed(() => {
    const item = previewItem.value
    if (!item || isLoading.value) return false
    if (item.status === 'active' && !!item.imagePath) return true
    if (item.status === 'removed' && item.reason === 'ai_filtered_edit' && !!item.originalPath) return true
    return false
  })

  const canRestoreCrop = computed(() => {
    const item = previewItem.value
    return canCropPreview.value && item?.status === 'active' && !!item?.isCropped
  })

  const canRecrop = computed(() => {
    return canRestoreCrop.value && !!previewItem.value?.cropPath && !!previewItem.value?.cropRect
  })

  const canStartCrop = computed(() => {
    const item = previewItem.value
    if (!canCropPreview.value) return false
    if (item?.status === 'active') return !item?.isCropped
    return true
  })

  const canApplyCrop = computed(() => {
    if (!isCropMode.value || !previewItem.value?.imagePath || !cropRectPx.value) {
      return false
    }

    return cropRectPx.value.width >= minimumCropSize && cropRectPx.value.height >= minimumCropSize
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
      previewStageShellSize.value.height / cropImageNaturalSize.value.height
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
      previewStageShellSize.value.height / cropImageNaturalSize.value.height
    )

    return {
      left: `${cropRectPx.value.x * scale}px`,
      top: `${cropRectPx.value.y * scale}px`,
      width: `${cropRectPx.value.width * scale}px`,
      height: `${cropRectPx.value.height * scale}px`,
    }
  })

  const resetCropState = () => {
    isCropMode.value = false
    cropEditorImageSrc.value = ''
    cropImageNaturalSize.value = { width: 0, height: 0 }
    cropRectPx.value = null
    cropInteraction.value = null
    cropSourceRequestId.value += 1
    isAutoCropPending.value = false
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

  const resizeCropRect = (originRect: CropRect, point: { x: number; y: number }, handle: CropHandle): CropRect => {
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

  const loadPreviewImageBase64 = async (item: ResultsItem): Promise<string | null> => {
    if (item.status === 'active' && item.imagePath) {
      if (item.isCropped && item.cropPath) {
        return window.electronAPI.crop.getImageAsBase64(item.cropPath)
      }
      return window.electronAPI.pdfmaker.getImageAsBase64(item.imagePath)
    }

    if (item.status === 'removed' && item.trashPath) {
      return window.electronAPI.trash.getImageAsBase64(item.trashPath)
    }

    return null
  }

  const startCropMode = async () => {
    const activeItem = previewItem.value
    if (!activeItem || (!canStartCrop.value && !canRecrop.value)) return
    if (activeItem.status === 'active' && !activeItem.imagePath) return
    if (activeItem.status === 'removed' && !activeItem.trashPath) return

    const requestId = cropSourceRequestId.value + 1
    cropSourceRequestId.value = requestId
    showPreviewMetadata.value = false

    try {
      // A registered override (demo mode) uses a fabricated SVG slide and skips
      // the IPC base64 read.
      let cropSource: string
      if (overrides.resultImageSource) {
        cropSource = overrides.resultImageSource(activeItem)
      } else {
        const sourceBase64 = await loadPreviewImageBase64(activeItem)
        if (!sourceBase64) return
        if (requestId !== cropSourceRequestId.value) return
        cropSource = `data:image/png;base64,${sourceBase64}`
      }

      const size = await loadImageSize(cropSource)

      if (requestId !== cropSourceRequestId.value) return

      cropEditorImageSrc.value = cropSource
      cropImageNaturalSize.value = size
      cropRectPx.value = activeItem.isCropped && activeItem.cropRect
        ? sanitizeCropRect({ ...activeItem.cropRect })
        : overrides.cropDefaultRect
          // Seed a box framing the slide inside the PowerPoint edit chrome so
          // the crop UI is visible without a drag (deterministic screenshots).
          ? sanitizeCropRect(overrides.cropDefaultRect())
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
    showPreviewMetadata.value = false
  }

  const startAutoCropMode = async () => {
    const activeItem = previewItem.value
    if (!canStartCrop.value || !activeItem || isAutoCropDetecting.value) return
    if (activeItem.status === 'active' && !activeItem.imagePath) return
    if (activeItem.status === 'removed' && !activeItem.trashPath) return

    isAutoCropDetecting.value = true
    showPreviewMetadata.value = false

    try {
      const sourceBase64 = await loadPreviewImageBase64(activeItem)
      if (!sourceBase64) return
      const cropSource = `data:image/png;base64,${sourceBase64}`

      const imageData = await decodeBase64ToImageData(sourceBase64)

      const appConfig = configStore
      const slideCfg = appConfig.slideExtraction
      const response = await detectBbox(imageData, false, {
        mode: slideCfg?.autoCropDetectorMode ?? 'canny_then_yolo',
        canny: slideCfg?.autoCrop,
        yolo: slideCfg?.autoCropYolo,
      })

      if (!response.success || !response.result?.bbox) {
        await window.electronAPI.dialog?.showMessageBox?.({
          type: 'info',
          buttons: ['OK'],
          title: t('trash.autoCropNoDetectionTitle'),
          message: t('trash.autoCropNoDetectionMessage'),
        })
        return
      }

      const { x, y, w, h } = response.result.bbox
      const size = await loadImageSize(cropSource)

      cropEditorImageSrc.value = cropSource
      cropImageNaturalSize.value = size
      cropRectPx.value = { x, y, width: w, height: h }
      cropInteraction.value = null
      isAutoCropPending.value = true
      isCropMode.value = true
      await observePreviewStageShell()
    } catch (error) {
      log.error('Failed to run auto-crop detection:', error)
    } finally {
      isAutoCropDetecting.value = false
    }
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
    cropInteraction.value = mode === 'move'
      ? { mode: 'move', startX: point.x, startY: point.y, originRect: { ...cropRectPx.value } }
      : { mode: 'resize', startX: point.x, startY: point.y, originRect: { ...cropRectPx.value }, handle: mode }
  }

  const handleGlobalCropPointerMove = (event: PointerEvent) => {
    if (!cropInteraction.value) return

    const point = getCropPointFromEvent(event)
    if (!point) return

    event.preventDefault()

    if (cropInteraction.value.mode === 'create') {
      cropRectPx.value = normalizeCropRect(cropInteraction.value.startX, cropInteraction.value.startY, point.x, point.y)
      return
    }

    if (cropInteraction.value.mode === 'move') {
      const maxX = cropImageNaturalSize.value.width - cropInteraction.value.originRect.width
      const maxY = cropImageNaturalSize.value.height - cropInteraction.value.originRect.height
      const nextX = Math.max(0, Math.min(cropInteraction.value.originRect.x + (point.x - cropInteraction.value.startX), maxX))
      const nextY = Math.max(0, Math.min(cropInteraction.value.originRect.y + (point.y - cropInteraction.value.startY), maxY))
      cropRectPx.value = {
        ...cropInteraction.value.originRect,
        x: nextX,
        y: nextY,
      }
      return
    }

    cropRectPx.value = resizeCropRect(cropInteraction.value.originRect, point, cropInteraction.value.handle)
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

    let targetPath: string | undefined
    if (item.status === 'active') {
      targetPath = item.imagePath
    } else if (item.status === 'removed' && item.reason === 'ai_filtered_edit' && item.originalPath) {
      try {
        await window.electronAPI.trash.restore([item.id])
        targetPath = item.originalPath
      } catch (error) {
        log.error('Failed to restore item before crop:', error)
        return
      }
    }

    if (!targetPath) return

    const success = await applyCropToImage(targetPath, rect, isAutoCropPending.value)
    if (success) {
      resetCropState()
      showPreviewMetadata.value = false
    }
  }

  const restoreCrop = async () => {
    if (!previewItem.value?.imagePath || !previewItem.value.isCropped) return

    const success = await restoreCropFromImage(previewItem.value.imagePath)
    if (success) {
      resetCropState()
      showPreviewMetadata.value = false
    }
  }

  // Re-measure the crop stage whenever the previewed item changes; tear down
  // the observer when the modal closes.
  watch(previewItem, async (item) => {
    if (!item) {
      disconnectPreviewResizeObserver()
      previewStageShellSize.value = { width: 0, height: 0 }
      return
    }

    await observePreviewStageShell()
  })

  window.addEventListener('pointermove', handleGlobalCropPointerMove)
  window.addEventListener('pointerup', handleGlobalCropPointerUp)

  onBeforeUnmount(() => {
    disconnectPreviewResizeObserver()
    window.removeEventListener('pointermove', handleGlobalCropPointerMove)
    window.removeEventListener('pointerup', handleGlobalCropPointerUp)
  })

  return {
    isCropMode,
    cropRectPx,
    previewStageShell,
    previewStage,
    isAutoCropDetecting,
    previewImageSrc,
    canRestoreCrop,
    canRecrop,
    canStartCrop,
    canApplyCrop,
    previewStageStyle,
    cropSelectionStyle,
    resetCropState,
    handlePreviewImageLoad,
    startCropMode,
    cancelCropMode,
    startAutoCropMode,
    handleCropStagePointerDown,
    startCropInteraction,
    applyCrop,
    restoreCrop,
  }
}
