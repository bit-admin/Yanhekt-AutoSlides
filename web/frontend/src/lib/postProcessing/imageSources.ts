// IndexedDB adapter implementation of PipelineDataSource.
// Ported from autoslides/src/renderer/shared/postProcessing/imageSources.ts —
// the desktop's two IPC-backed adapters collapse into one slideStore-backed
// source (blob decode replaces the base64/buffer round-trips).

import type { PipelineDataSource, TrashReason } from './types'
import { getSlideBlob, moveToTrash, slideId } from '../slideStore'
import { createLogger } from '../logger';
const log = createLogger('ImageSources');

async function decodeBlobToImageData(blob: Blob): Promise<ImageData | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(blob)
    const img = new Image()
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = img.width
      canvas.height = img.height
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        URL.revokeObjectURL(url)
        resolve(null)
        return
      }
      ctx.drawImage(img, 0, 0)
      const imageData = ctx.getImageData(0, 0, img.width, img.height)
      URL.revokeObjectURL(url)
      resolve(imageData)
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      resolve(null)
    }
    img.src = url
  })
}

/** Data source over one IndexedDB folder's active slides. */
export function createSlideStoreDataSource(folder: string): PipelineDataSource {
  return {
    async readForPHash(filename) {
      try {
        const blob = await getSlideBlob(slideId(folder, filename))
        if (!blob) return null
        return decodeBlobToImageData(blob)
      } catch (error) {
        log.error(`[PostProcessing] readForPHash failed for ${filename}:`, error)
        return null
      }
    },
    async moveToTrash(filename, reason: TrashReason, reasonDetails: string) {
      return moveToTrash(folder, filename, reason, reasonDetails)
    }
  }
}
