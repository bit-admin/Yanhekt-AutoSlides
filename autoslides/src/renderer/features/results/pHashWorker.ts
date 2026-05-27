/**
 * Helpers wrapping the postProcessor.worker for pHash computation and
 * Hamming-distance comparison. Each `createPHashWorkerClient` call creates a
 * fresh Worker. Callers are responsible for calling `terminate()`.
 */

export interface PHashWorkerClient {
  calculatePHash: (imageData: ImageData) => Promise<string>
  calculateHammingDistance: (hash1: string, hash2: string) => Promise<number>
  bufferToImageData: (buffer: Uint8Array) => Promise<ImageData>
  terminate: () => void
}

export function createPHashWorkerClient(): PHashWorkerClient {
  const worker = new Worker(
    new URL('../../shared/workers/postProcessor.worker.ts', import.meta.url),
    { type: 'module' }
  )

  const calculatePHash = (imageData: ImageData): Promise<string> => {
    return new Promise((resolve, reject) => {
      const messageId = `pHash_${Date.now()}_${Math.random()}`
      const messageHandler = (event: MessageEvent) => {
        const { id, success, result, error } = event.data
        if (id === messageId) {
          worker.removeEventListener('message', messageHandler)
          success ? resolve(result) : reject(new Error(error))
        }
      }
      worker.addEventListener('message', messageHandler)
      worker.postMessage({ id: messageId, type: 'calculatePHash', data: { imageData } })
    })
  }

  const calculateHammingDistance = (hash1: string, hash2: string): Promise<number> => {
    return new Promise((resolve, reject) => {
      const messageId = `hamming_${Date.now()}_${Math.random()}`
      const messageHandler = (event: MessageEvent) => {
        const { id, success, result, error } = event.data
        if (id === messageId) {
          worker.removeEventListener('message', messageHandler)
          success ? resolve(result) : reject(new Error(error))
        }
      }
      worker.addEventListener('message', messageHandler)
      worker.postMessage({ id: messageId, type: 'calculateHammingDistance', data: { hash1, hash2 } })
    })
  }

  const bufferToImageData = (buffer: Uint8Array): Promise<ImageData> => {
    return new Promise((resolve, reject) => {
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
          reject(new Error('Failed to get canvas context'))
          return
        }
        ctx.drawImage(img, 0, 0)
        const imageData = ctx.getImageData(0, 0, img.width, img.height)
        URL.revokeObjectURL(url)
        resolve(imageData)
      }
      img.onerror = () => {
        URL.revokeObjectURL(url)
        reject(new Error('Failed to load image'))
      }
      img.src = url
    })
  }

  return {
    calculatePHash,
    calculateHammingDistance,
    bufferToImageData,
    terminate: () => worker.terminate()
  }
}
