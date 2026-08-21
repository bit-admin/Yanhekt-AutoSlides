// Adapter implementations of PipelineDataSource. Task-queue jobs and playback-page
// slides are read via the `slideExtraction` namespace (paths are {outputPath, filename}
// pairs). Trash moves also go through `slideExtraction.moveToInAppTrash`.

import type { PipelineDataSource, TrashReason } from './types'
import { moveToTrash } from './trashWriter'
import { createLogger } from '@shared/utils/logger';
const log = createLogger('ImageSources');

async function decodeBase64ToImageData(base64: string): Promise<ImageData | null> {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = img.width
      canvas.height = img.height
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        resolve(null)
        return
      }
      ctx.drawImage(img, 0, 0)
      resolve(ctx.getImageData(0, 0, img.width, img.height))
    }
    img.onerror = () => resolve(null)
    img.src = `data:image/png;base64,${base64}`
  })
}

// Used by postProcessingService (task-queue jobs) and usePostProcessing (playback
// page). Files live under `outputPath` and are read via the `slideExtraction`
// namespace — main-process Sharp handles indexed-PNG detection and resize.
export function createSlideExtractionDataSource(outputPath: string): PipelineDataSource {
  return {
    async readForPHash(filename) {
      try {
        const base64 = await window.electronAPI.slideExtraction.readSlideAsBase64(outputPath, filename)
        return decodeBase64ToImageData(base64)
      } catch (error) {
        log.error(`[PostProcessing] readForPHash failed for ${filename}:`, error)
        return null
      }
    },
    async readForAI(filename, targetWidth, targetHeight) {
      try {
        return await window.electronAPI.slideExtraction.readSlideForAI(
          outputPath,
          filename,
          targetWidth,
          targetHeight
        )
      } catch (error) {
        log.error(`[PostProcessing] readForAI failed for ${filename}:`, error)
        return null
      }
    },
    async moveToTrash(filename, reason: TrashReason, reasonDetails: string, duplicateOf?: string) {
      return moveToTrash({ outputPath, filename, reason, reasonDetails, duplicateOf })
    }
  }
}
