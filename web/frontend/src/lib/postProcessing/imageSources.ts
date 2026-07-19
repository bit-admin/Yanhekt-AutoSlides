// IndexedDB adapter implementation of PipelineDataSource.
// Ported from autoslides/src/renderer/shared/postProcessing/imageSources.ts —
// the desktop's two IPC-backed adapters collapse into one slideStore-backed
// source (blob decode replaces the base64/buffer round-trips).

import type { PipelineDataSource, TrashReason } from './types'
import { getSlideBlob, moveToTrash, slideId } from '../slideStore'
import { createLogger } from '../logger';
const log = createLogger('ImageSources');

async function decodeBlobToImage(blob: Blob): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(blob)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve(img)
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      resolve(null)
    }
    img.src = url
  })
}

async function decodeBlobToImageData(blob: Blob): Promise<ImageData | null> {
  const img = await decodeBlobToImage(blob)
  if (!img) return null
  const canvas = document.createElement('canvas')
  canvas.width = img.width
  canvas.height = img.height
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  ctx.drawImage(img, 0, 0)
  return ctx.getImageData(0, 0, img.width, img.height)
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
    async readForAI(filename, targetWidth, targetHeight) {
      try {
        const blob = await getSlideBlob(slideId(folder, filename))
        if (!blob) return null
        const img = await decodeBlobToImage(blob)
        if (!img) return null
        // Fit-inside, never upscale (desktop Sharp `fit: 'inside'` parity).
        const scale = Math.min(targetWidth / img.width, targetHeight / img.height, 1)
        const width = Math.max(1, Math.round(img.width * scale))
        const height = Math.max(1, Math.round(img.height * scale))
        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')
        if (!ctx) return null
        ctx.drawImage(img, 0, 0, width, height)
        const dataUrl = canvas.toDataURL('image/png')
        const base64 = dataUrl.split(',')[1]
        return base64 || null
      } catch (error) {
        log.error(`[PostProcessing] readForAI failed for ${filename}:`, error)
        return null
      }
    },
    async moveToTrash(filename, reason: TrashReason, reasonDetails: string) {
      return moveToTrash(folder, filename, reason, reasonDetails)
    }
  }
}
