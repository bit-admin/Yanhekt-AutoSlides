import { ref } from 'vue'

import type { DetectResult } from '../workers/autoCrop.worker'
import { useAutoCropDetect } from './useAutoCropDetect'

function basename(p: string): string {
  return p.replace(/\\/g, '/').split('/').pop() ?? p
}

export interface AutoCropProgress {
  phase: 'idle' | 'processing' | 'completed' | 'error' | 'cancelled'
  current: number
  total: number
  processed: number
  failed: number
  noDetection: number
}

export function useAutoCrop() {
  const selectedImagePaths = ref<string[]>([])
  const redBoxMode = ref(false)
  const showEdges = ref(false)
  const enablePngColorReduction = ref(true)
  const isProcessing = ref(false)
  const isCancelled = ref(false)
  const progress = ref<AutoCropProgress>({
    phase: 'idle',
    current: 0,
    total: 0,
    processed: 0,
    failed: 0,
    noDetection: 0,
  })

  const outputDir = ref<string | null>(null)

  const { detectBbox } = useAutoCropDetect()

  const selectImages = async (): Promise<void> => {
    const paths = await window.electronAPI.dialog?.openImageFiles?.()
    if (!paths || paths.length === 0) return
    selectedImagePaths.value = paths
    progress.value = { phase: 'idle', current: 0, total: 0, processed: 0, failed: 0, noDetection: 0 }
  }

  const startProcessing = async (): Promise<void> => {
    if (selectedImagePaths.value.length === 0) return
    const images = [...selectedImagePaths.value]

    const config = await window.electronAPI.config.get()
    const configuredOutputDir = config.outputDirectory || ''
    if (!configuredOutputDir) {
      console.error('No output directory configured')
      progress.value.phase = 'error'
      return
    }
    const outDir = configuredOutputDir + '/cropped'
    outputDir.value = outDir
    const autoCropConfig = config.slideExtraction?.autoCrop

    isProcessing.value = true
    isCancelled.value = false
    progress.value = {
      phase: 'processing',
      current: 0,
      total: images.length,
      processed: 0,
      failed: 0,
      noDetection: 0,
    }

    for (const imagePath of images) {
      if (isCancelled.value) break
      progress.value.current++

      try {
        const buffer = await window.electronAPI.offline.readImageBuffer(imagePath)
        const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer)
        const blobArrayBuffer = new ArrayBuffer(bytes.byteLength)
        new Uint8Array(blobArrayBuffer).set(bytes)
        const blob = new Blob([blobArrayBuffer], { type: 'image/*' })
        const bitmap = await createImageBitmap(blob)

        const srcCanvas = new OffscreenCanvas(bitmap.width, bitmap.height)
        const srcCtx = srcCanvas.getContext('2d')!
        srcCtx.drawImage(bitmap, 0, 0)
        const imageData = srcCtx.getImageData(0, 0, bitmap.width, bitmap.height)

        const useDebug = redBoxMode.value && showEdges.value
        const response = await detectBbox(imageData, useDebug, autoCropConfig)

        if (!response.success || !response.result) {
          console.warn(`Auto-crop failed for ${basename(imagePath)}:`, response.error)
          progress.value.failed++
          bitmap.close()
          continue
        }

        const result: DetectResult = response.result
        if (!result.bbox) {
          progress.value.noDetection++
          bitmap.close()
          continue
        }

        const { x, y, w, h } = result.bbox
        let outCanvas: OffscreenCanvas
        let outCtx: OffscreenCanvasRenderingContext2D

        if (redBoxMode.value) {
          outCanvas = new OffscreenCanvas(bitmap.width, bitmap.height)
          outCtx = outCanvas.getContext('2d')!
          outCtx.drawImage(bitmap, 0, 0)

          if (showEdges.value && result.edgesPng) {
            const edgesBlob = new Blob([result.edgesPng], { type: 'image/png' })
            const edgesBitmap = await createImageBitmap(edgesBlob)
            outCtx.globalAlpha = 0.5
            outCtx.drawImage(
              edgesBitmap,
              result.stripped.left,
              result.stripped.top,
              result.innerSize.width,
              result.innerSize.height,
            )
            outCtx.globalAlpha = 1.0
            edgesBitmap.close()
          }

          const lineW = Math.max(2, Math.round(bitmap.width / 600))
          outCtx.strokeStyle = 'rgba(255, 40, 40, 1)'
          outCtx.lineWidth = lineW
          outCtx.strokeRect(x + lineW / 2, y + lineW / 2, w - lineW, h - lineW)
        } else {
          outCanvas = new OffscreenCanvas(w, h)
          outCtx = outCanvas.getContext('2d')!
          outCtx.drawImage(bitmap, x, y, w, h, 0, 0, w, h)
        }

        bitmap.close()

        const outBlob = await outCanvas.convertToBlob({ type: 'image/png' })
        const outBuffer = new Uint8Array(await outBlob.arrayBuffer())
        const filename = basename(imagePath).replace(/\.[^.]+$/, '.png')
        await window.electronAPI.offline.savePngBuffer(outDir, filename, outBuffer, enablePngColorReduction.value)

        progress.value.processed++
      } catch (err) {
        console.error(`Failed to auto-crop ${imagePath}:`, err)
        progress.value.failed++
      }
    }

    progress.value.phase = isCancelled.value ? 'cancelled' : 'completed'
    isProcessing.value = false
  }

  const cancelProcessing = () => {
    isCancelled.value = true
  }

  const openOutputFolder = async () => {
    if (outputDir.value) {
      await window.electronAPI.shell.openPath(outputDir.value)
    }
  }

  const reset = () => {
    selectedImagePaths.value = []
    outputDir.value = null
    progress.value = { phase: 'idle', current: 0, total: 0, processed: 0, failed: 0, noDetection: 0 }
  }

  return {
    selectedImagePaths,
    redBoxMode,
    showEdges,
    enablePngColorReduction,
    isProcessing,
    progress,
    outputDir,
    selectImages,
    startProcessing,
    cancelProcessing,
    openOutputFolder,
    reset,
  }
}

export type UseAutoCrop = ReturnType<typeof useAutoCrop>
