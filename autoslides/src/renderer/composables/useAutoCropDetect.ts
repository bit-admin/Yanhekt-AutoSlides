import { onUnmounted } from 'vue'

import type {
  DetectConfig,
  DetectorMode,
  WorkerLog,
  WorkerResponse,
} from '../workers/autoCrop.worker'

export function useAutoCropDetect() {
  let worker: Worker | null = null
  let nextId = 0
  const pending = new Map<string, (r: WorkerResponse) => void>()

  let ensureYoloInitPromise: Promise<void> | null = null
  let yoloInitialized = false

  const ensureWorker = (): Worker => {
    if (worker) return worker
    worker = new Worker(
      new URL('../workers/autoCrop.worker.ts', import.meta.url),
      { type: 'module' },
    )
    worker.addEventListener('message', (event: MessageEvent<WorkerResponse | WorkerLog>) => {
      const data = event.data as WorkerResponse | WorkerLog | null
      if (!data || typeof data !== 'object') return
      if ((data as WorkerLog).type === 'log') return
      const response = data as WorkerResponse
      if (!response.id) return
      const resolver = pending.get(response.id)
      if (!resolver) return
      pending.delete(response.id)
      resolver(response)
    })
    worker.addEventListener('error', (e) => {
      console.error('[autoCrop worker error]', e)
    })
    return worker
  }

  const modeNeedsYolo = (mode: DetectorMode | undefined): boolean =>
    mode === 'yolo_only' || mode === 'canny_then_yolo'

  const ensureYoloReady = async (mode: DetectorMode): Promise<void> => {
    if (!modeNeedsYolo(mode)) return
    if (yoloInitialized) return
    if (ensureYoloInitPromise) {
      await ensureYoloInitPromise
      return
    }
    ensureYoloInitPromise = (async () => {
      const w = ensureWorker()
      const modelBuffer = await window.electronAPI.autoCrop.getModelBuffer()
      const id = String(++nextId)
      const response = await new Promise<WorkerResponse>((resolve) => {
        pending.set(id, resolve)
        w.postMessage({ id, type: 'init', modelBuffer }, [modelBuffer])
      })
      if (!response.success) {
        throw new Error(response.error || 'Failed to initialize YOLO backend')
      }
      yoloInitialized = true
    })()
    try {
      await ensureYoloInitPromise
    } catch (err) {
      ensureYoloInitPromise = null
      throw err
    }
  }

  const resetYoloInit = (): void => {
    yoloInitialized = false
    ensureYoloInitPromise = null
  }

  const detectBbox = async (
    imageData: ImageData,
    debug: boolean,
    config?: Partial<DetectConfig>,
  ): Promise<WorkerResponse> => {
    if (config?.mode) {
      await ensureYoloReady(config.mode)
    }
    const w = ensureWorker()
    const id = String(++nextId)
    return new Promise<WorkerResponse>((resolve) => {
      pending.set(id, resolve)
      w.postMessage({ id, type: 'detect', imageData, debug, config })
    })
  }

  onUnmounted(() => {
    pending.clear()
    if (worker) {
      worker.terminate()
      worker = null
    }
    resetYoloInit()
  })

  return { detectBbox, ensureYoloReady, resetYoloInit }
}
