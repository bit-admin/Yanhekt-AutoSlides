import type {
  ClassifyResult,
  WorkerLog,
  WorkerResponse,
} from '../workers/slideClassifier.worker'

let worker: Worker | null = null
let nextId = 0
const pending = new Map<string, (r: WorkerResponse) => void>()

let ensureInitPromise: Promise<void> | null = null
let initialized = false

const ensureWorker = (): Worker => {
  if (worker) return worker
  worker = new Worker(
    new URL('../workers/slideClassifier.worker.ts', import.meta.url),
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
    console.error('[slideClassifier worker error]', e)
  })
  return worker
}

export async function ensureMlClassifierReady(): Promise<void> {
  if (initialized) return
  if (ensureInitPromise) {
    await ensureInitPromise
    return
  }
  ensureInitPromise = (async () => {
    const w = ensureWorker()
    const modelBuffer = await window.electronAPI.mlClassifier.getModelBuffer()
    const id = String(++nextId)
    const response = await new Promise<WorkerResponse>((resolve) => {
      pending.set(id, resolve)
      w.postMessage({ id, type: 'init', modelBuffer }, [modelBuffer])
    })
    if (!response.success) {
      throw new Error(response.error || 'Failed to initialize ML classifier')
    }
    initialized = true
  })()
  try {
    await ensureInitPromise
  } catch (err) {
    ensureInitPromise = null
    throw err
  }
}

export async function classifyImage(imageData: ImageData): Promise<ClassifyResult> {
  await ensureMlClassifierReady()
  const w = ensureWorker()
  const id = String(++nextId)
  const response = await new Promise<WorkerResponse>((resolve) => {
    pending.set(id, resolve)
    w.postMessage({ id, type: 'classify', imageData })
  })
  if (!response.success || !response.result) {
    throw new Error(response.error || 'Classification failed')
  }
  return response.result
}

export function resetMlClassifier(): void {
  initialized = false
  ensureInitPromise = null
  if (worker) {
    worker.terminate()
    worker = null
  }
  pending.clear()
}

export function useMlClassifier() {
  return {
    ensureReady: ensureMlClassifierReady,
    classify: classifyImage,
    reset: resetMlClassifier,
  }
}
