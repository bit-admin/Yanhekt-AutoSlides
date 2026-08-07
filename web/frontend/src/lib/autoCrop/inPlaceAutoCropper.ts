// In-place auto-crop session for post-processing phase 3 (may_be_slide_edit).
// Desktop parity: autoslides/src/renderer/shared/autoCrop/inPlaceAutoCropper.ts
// Web uses Canny-only detection and IndexedDB applyCropToSlide (sets cropped,
// not the human edited latch).

import { createAutoCropWorkerClient, type AutoCropWorkerClient } from '../../workers/autoCropWorkerClient'
import { applyCropToSlide, getSlideCropSourceBlob, slideId } from '../slideStore'
import { createLogger } from '../logger'

const log = createLogger('InPlaceAutoCropper')

export interface InPlaceAutoCropper {
  /** Returns true only when a bbox was detected and the crop was applied. */
  crop(filename: string): Promise<boolean>
  destroy(): void
}

export function createInPlaceAutoCropper(folder: string): InPlaceAutoCropper {
  let client: AutoCropWorkerClient | null = null

  return {
    async crop(filename: string): Promise<boolean> {
      try {
        if (!client) {
          client = createAutoCropWorkerClient()
        }
        const id = slideId(folder, filename)
        const blob = await getSlideCropSourceBlob(id)
        if (!blob) {
          log.warn(`No crop source for ${id}`)
          return false
        }
        const imageData = await client.blobToImageData(blob)
        const response = await client.detectBbox(imageData, false)
        if (!response.success || !response.result?.bbox) {
          return false
        }
        const { x, y, w, h } = response.result.bbox
        if (w < 20 || h < 20) {
          return false
        }
        return applyCropToSlide(
          id,
          { x, y, width: w, height: h },
          true, // autoCropped — automated post-processing path
        )
      } catch (err) {
        log.error(`Auto-crop failed for ${folder}/${filename}:`, err)
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
