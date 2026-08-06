// In-place auto-crop session used by post-processing phase 3 when a frame is
// classified as may_be_slide_edit. Reuses the same detector config as the Slides
// page and applies via crop.apply(..., autoCropped=true, isAutomated=true) so
// metadata gets review.cropped without the human `edited` latch.

import { configStore } from '@shared/services/configStore'
import { decodeBufferToImageData } from '@shared/utils/imageDecode'
import { createLogger } from '@shared/utils/logger'
import {
  createAutoCropWorkerClient,
  type AutoCropWorkerClient,
} from './autoCropWorkerClient'
import type { DetectConfig, DetectorMode } from '../workers/autoCrop.worker'

const log = createLogger('InPlaceAutoCropper')

export interface InPlaceAutoCropper {
  /** Returns true only when a bbox was detected and the crop was applied. */
  crop(imagePath: string): Promise<boolean>
  destroy(): void
}

function readDetectConfig(): Partial<DetectConfig> {
  const slideCfg = configStore.slideExtraction
  return {
    mode: (slideCfg?.autoCropDetectorMode as DetectorMode | undefined) ?? 'canny_then_yolo',
    canny: slideCfg?.autoCrop,
    yolo: slideCfg?.autoCropYolo,
  }
}

export function createInPlaceAutoCropper(): InPlaceAutoCropper {
  let client: AutoCropWorkerClient | null = null

  return {
    async crop(imagePath: string): Promise<boolean> {
      try {
        if (!client) {
          client = createAutoCropWorkerClient()
        }
        const detectConfig = readDetectConfig()
        const buffer = await window.electronAPI.offline.readImageBuffer(imagePath)
        const imageData = await decodeBufferToImageData(buffer)
        const response = await client.detectBbox(imageData, false, detectConfig)
        if (!response.success || !response.result?.bbox) {
          return false
        }
        const { x, y, w, h } = response.result.bbox
        const res = await window.electronAPI.crop.apply(
          imagePath,
          { x, y, width: w, height: h },
          true, // autoCropped
          true, // isAutomated — setCropped, not stageEdited
        )
        return res?.success === true
      } catch (err) {
        log.error(`Auto-crop failed for ${imagePath}:`, err)
        return false
      }
    },
    destroy() {
      if (client) {
        client.destroy()
        client = null
      }
    },
  }
}
