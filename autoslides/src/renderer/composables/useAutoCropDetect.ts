import { onUnmounted } from 'vue'

import type { DetectConfig, WorkerLog, WorkerResponse } from '../workers/autoCrop.worker'

export function useAutoCropDetect() {
  let worker: Worker | null = null
  let nextId = 0
  const pending = new Map<string, (r: WorkerResponse) => void>()

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

  const detectBbox = (
    imageData: ImageData,
    debug: boolean,
    config?: Partial<DetectConfig>,
  ): Promise<WorkerResponse> => {
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
  })

  return { detectBbox }
}
