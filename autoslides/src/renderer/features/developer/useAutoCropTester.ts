import { computed, onUnmounted, ref } from 'vue'

import {
  composeDetectionPreview,
  createAutoCropWorkerClient,
} from '@shared/autoCrop'
import { configStore } from '@shared/services/configStore'
import { bytesToImageBitmap, imageBitmapToImageData } from '@shared/utils/imageDecode'
import { createLogger } from '@shared/utils/logger'
import type { DetectConfig, DetectorMode, DetectResult } from '@shared/workers/autoCrop.worker'

const log = createLogger('AutoCropTester')

function basename(p: string): string {
  return p.replace(/\\/g, '/').split('/').pop() ?? p
}

function readDetectConfig(): Partial<DetectConfig> {
  const slideCfg = configStore.slideExtraction
  return {
    mode: (slideCfg?.autoCropDetectorMode as DetectorMode | undefined) ?? 'canny_then_yolo',
    canny: slideCfg?.autoCrop,
    yolo: slideCfg?.autoCropYolo,
  }
}

export function useAutoCropTester() {
  const imagePath = ref<string | null>(null)
  const imageName = ref<string | null>(null)
  const previewUrl = ref<string | null>(null)
  const isRunning = ref(false)
  const error = ref<string | null>(null)
  const result = ref<DetectResult | null>(null)

  const detectorMode = computed<DetectorMode>(
    () => configStore.slideExtraction?.autoCropDetectorMode ?? 'canny_then_yolo',
  )
  const hasEdges = computed(() => Boolean(result.value?.edgesPng))
  const yoloOnly = computed(() => detectorMode.value === 'yolo_only')

  const client = createAutoCropWorkerClient()
  onUnmounted(() => client.destroy())

  const runDetection = async (): Promise<void> => {
    const path = imagePath.value
    if (!path || isRunning.value) return

    isRunning.value = true
    error.value = null
    result.value = null

    let bitmap: ImageBitmap | null = null
    try {
      const buffer = await window.electronAPI.slideExtraction.readImageBuffer(path)
      bitmap = await bytesToImageBitmap(buffer)
      const imageData = imageBitmapToImageData(bitmap)
      const detectConfig = readDetectConfig()
      const response = await client.detectBbox(imageData, true, detectConfig)

      if (!response.success || !response.result) {
        throw new Error(response.error || 'Detection failed')
      }

      result.value = response.result
      previewUrl.value = await composeDetectionPreview(bitmap, response.result)
    } catch (err) {
      log.error('Auto crop test failed:', err)
      error.value = err instanceof Error ? err.message : String(err)
      if (bitmap && !previewUrl.value) {
        try {
          previewUrl.value = await composeDetectionPreview(bitmap, {
            bbox: null,
            backend: null,
            candidates: [],
            durationMs: 0,
          })
        } catch {
          /* preview is best-effort on failure */
        }
      }
    } finally {
      bitmap?.close()
      isRunning.value = false
    }
  }

  const pickImage = async (): Promise<void> => {
    const path = await window.electronAPI.dialog?.openImageFile?.()
    if (!path) return
    imagePath.value = path
    imageName.value = basename(path)
    previewUrl.value = null
    result.value = null
    error.value = null
    await runDetection()
  }

  return {
    imagePath,
    imageName,
    previewUrl,
    isRunning,
    error,
    result,
    detectorMode,
    hasEdges,
    yoloOnly,
    pickImage,
    runDetection,
  }
}

export type UseAutoCropTester = ReturnType<typeof useAutoCropTester>
