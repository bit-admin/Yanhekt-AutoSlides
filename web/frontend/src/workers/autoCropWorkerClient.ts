// Canny-only auto-crop worker client for web.
// Mirrors autoslides/src/renderer/shared/autoCrop/autoCropWorkerClient.ts
// without YOLO init / electronAPI model loading.

import AutoCropWorker from './autoCrop.worker?worker'
import type {
  AutoCropCannyConfig,
  DetectConfig,
  WorkerResponse,
} from './autoCrop.worker'

export interface AutoCropWorkerClient {
  detectBbox(
    imageData: ImageData,
    debug?: boolean,
    config?: Partial<DetectConfig> & { canny?: Partial<AutoCropCannyConfig> },
  ): Promise<WorkerResponse>
  blobToImageData(blob: Blob): Promise<ImageData>
  destroy(): void
}

function decodeBlobToImageData(blob: Blob): Promise<ImageData> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob)
    const img = new Image()
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas')
        canvas.width = img.naturalWidth || img.width
        canvas.height = img.naturalHeight || img.height
        const ctx = canvas.getContext('2d')
        if (!ctx) {
          URL.revokeObjectURL(url)
          reject(new Error('Failed to get canvas context'))
          return
        }
        ctx.drawImage(img, 0, 0)
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
        URL.revokeObjectURL(url)
        resolve(imageData)
      } catch (err) {
        URL.revokeObjectURL(url)
        reject(err)
      }
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Failed to load image for auto-crop'))
    }
    img.src = url
  })
}

export function createAutoCropWorkerClient(): AutoCropWorkerClient {
  const worker = new AutoCropWorker()

  const request = (
    data: Record<string, unknown>,
    transfer?: Transferable[],
  ): Promise<WorkerResponse> => {
    return new Promise((resolve, reject) => {
      const messageId = `detect_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`
      const handler = (event: MessageEvent) => {
        const payload = event.data as WorkerResponse
        if (!payload || payload.id !== messageId) return
        worker.removeEventListener('message', handler)
        resolve(payload)
      }
      worker.addEventListener('message', handler)
      try {
        worker.postMessage({ id: messageId, ...data }, transfer ?? [])
      } catch (err) {
        worker.removeEventListener('message', handler)
        reject(err)
      }
    })
  }

  const detectBbox = async (
    imageData: ImageData,
    debug = false,
    config?: Partial<DetectConfig> & { canny?: Partial<AutoCropCannyConfig> },
  ): Promise<WorkerResponse> => {
    // Nested config must be plain — never post Vue proxies / class instances.
    const plainConfig = config
      ? (JSON.parse(JSON.stringify(config)) as Partial<DetectConfig> & {
          canny?: Partial<AutoCropCannyConfig>
        })
      : undefined
    return request({ type: 'detect', imageData, debug, config: plainConfig })
  }

  return {
    detectBbox,
    blobToImageData: decodeBlobToImageData,
    destroy: () => worker.terminate(),
  }
}
