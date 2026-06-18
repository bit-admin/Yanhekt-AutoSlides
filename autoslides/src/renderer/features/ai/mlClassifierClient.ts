import type {
  ClassifyResult,
  WorkerResponse,
} from '@shared/workers/slideClassifier.worker'
import SlideClassifierWorker from '@shared/workers/slideClassifier.worker?worker'
import { createWorkerClient } from '@shared/workers/workerClientFactory'

const client = createWorkerClient<WorkerResponse>({
  createWorker: () => new SlideClassifierWorker(),
  workerName: 'slideClassifier',
})

let ensureInitPromise: Promise<void> | null = null
let initialized = false

export async function ensureMlClassifierReady(): Promise<void> {
  if (initialized) return
  if (ensureInitPromise) {
    await ensureInitPromise
    return
  }
  ensureInitPromise = (async () => {
    const modelBuffer = await window.electronAPI.mlClassifier.getModelBuffer()
    const response = await client.request(
      { type: 'init', modelBuffer },
      [modelBuffer],
    )
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
  const response = await client.request({ type: 'classify', imageData })
  if (!response.success || !response.result) {
    throw new Error(response.error || 'Classification failed')
  }
  return response.result
}

export function resetMlClassifier(): void {
  initialized = false
  ensureInitPromise = null
  client.destroy()
}
