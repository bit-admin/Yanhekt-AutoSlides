import type {
  ClassifyResult,
  WorkerResponse,
} from '@shared/workers/slideClassifier.worker'
import SlideClassifierWorker from '@shared/workers/slideClassifier.worker?worker'
import { createWorkerClient, WORKER_INIT_TIMEOUT_MS } from '@shared/workers/workerClientFactory'

const client = createWorkerClient<WorkerResponse>({
  createWorker: () => new SlideClassifierWorker(),
  workerName: 'slideClassifier',
})

let ensureInitPromise: Promise<void> | null = null
let initialized = false
// Bumped by a reset: an initialization begun before it may still finish (or
// fail), and must then neither mark the new worker ready nor clear the
// initialization that replaced it.
let generation = 0

export async function ensureMlClassifierReady(): Promise<void> {
  if (initialized) return
  if (ensureInitPromise) {
    await ensureInitPromise
    return
  }
  const mine = generation
  const init = (async () => {
    const modelBuffer = await window.electronAPI.mlClassifier.getModelBuffer()
    if (mine !== generation) throw new Error('The ML classifier was reset while it was starting')
    const response = await client.request(
      { type: 'init', modelBuffer },
      [modelBuffer],
      { timeoutMs: WORKER_INIT_TIMEOUT_MS },
    )
    if (!response.success) {
      throw new Error(response.error || 'Failed to initialize ML classifier')
    }
    if (mine !== generation) throw new Error('The ML classifier was reset while it was starting')
    initialized = true
  })()
  ensureInitPromise = init
  try {
    await init
  } catch (err) {
    // A failed start can be tried again; only if it is still the current one.
    if (ensureInitPromise === init) ensureInitPromise = null
    throw err
  }
}

export async function classifyImage(imageData: ImageData): Promise<ClassifyResult> {
  await ensureMlClassifierReady()
  const response = await client.request({ type: 'classify', imageData })
  if (!response.success || !response.result) {
    throw new Error(response.error || 'Classification failed')
  }
  return response.result
}

export function resetMlClassifier(): void {
  generation += 1
  initialized = false
  ensureInitPromise = null
  // Rejects whatever is waiting on the worker, including a start in progress.
  client.destroy()
}
