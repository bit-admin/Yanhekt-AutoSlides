// Adapter implementations of PipelineDataSource. Two source IPC namespaces exist
// on the main side:
//   - `slideExtraction` for task-queue jobs and playback-page slides (paths are
//     {outputPath, filename} pairs)
//   - `offline` for the offline-processing tab (paths are absolute strings)
// Both end up calling `slideExtraction.moveToInAppTrash` for trash moves — only
// the read APIs differ.

import type { PipelineDataSource, TrashReason } from './types'
import { moveToTrash } from './trashWriter'

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

async function decodeBufferToImageData(buffer: Uint8Array): Promise<ImageData | null> {
  return new Promise((resolve) => {
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
        console.error(`[PostProcessing] readForPHash failed for ${filename}:`, error)
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
        console.error(`[PostProcessing] readForAI failed for ${filename}:`, error)
        return null
      }
    },
    async moveToTrash(filename, reason: TrashReason, reasonDetails: string) {
      await moveToTrash({ outputPath, filename, reason, reasonDetails })
    }
  }
}

// Used by useOfflineProcessing. Files are addressed by absolute paths under
// `outputDir`, read via the `offline` namespace.
export function createOfflineDataSource(outputDir: string): PipelineDataSource {
  return {
    async readForPHash(filename) {
      try {
        const buffer = await window.electronAPI.offline.readImageBuffer(`${outputDir}/${filename}`)
        return decodeBufferToImageData(buffer)
      } catch (error) {
        console.error(`[PostProcessing] readForPHash failed for ${filename}:`, error)
        return null
      }
    },
    async readForAI(filename, targetWidth, targetHeight) {
      try {
        return await window.electronAPI.offline.readImageForAI(
          `${outputDir}/${filename}`,
          targetWidth,
          targetHeight
        )
      } catch (error) {
        console.error(`[PostProcessing] readForAI failed for ${filename}:`, error)
        return null
      }
    },
    async moveToTrash(filename, reason: TrashReason, reasonDetails: string) {
      // Offline output ends up in the same trash subfolder relative to its
      // directory, so the same slideExtraction trash IPC handles it.
      await moveToTrash({ outputPath: outputDir, filename, reason, reasonDetails })
    }
  }
}
