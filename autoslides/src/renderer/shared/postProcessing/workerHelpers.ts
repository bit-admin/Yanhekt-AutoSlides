// Bridge between the renderer and the post-processor worker (pHash + Hamming).
// Extracted from three near-identical copies that previously lived in
// postProcessingService.ts, usePostProcessing.ts, and useOfflineProcessing.ts.

export interface WorkerHelpers {
  calculatePHash: (imageData: ImageData) => Promise<string>
  calculateHammingDistance: (hash1: string, hash2: string) => Promise<number>
}

export function createWorkerHelpers(worker: Worker): WorkerHelpers {
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

  return { calculatePHash, calculateHammingDistance }
}

// Helper that owns the worker lifetime for one phase block. The post-processor
// worker is shared between phases 1 and 2 and torn down once both finish.
export function createPostProcessorWorker(): Worker {
  return new Worker(
    new URL('../workers/postProcessor.worker.ts', import.meta.url),
    { type: 'module' }
  )
}
