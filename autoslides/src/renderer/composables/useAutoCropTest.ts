import { onUnmounted, ref, shallowRef } from 'vue'

import type {
  CandidateInfo,
  DetectResult,
  WorkerLog,
  WorkerResponse,
} from '../workers/autoCrop.worker'

export interface AutoCropResult {
  bbox: (CandidateInfo & { score: number }) | null
  stripped: { top: number; bottom: number; left: number; right: number }
  candidates: CandidateInfo[]
  durationMs: number
  innerSize: { width: number; height: number }
  edgesUrl: string | null
}

export function useAutoCropTest() {
  const selectedImagePath = ref<string | null>(null)
  const sourceBitmap = shallowRef<ImageBitmap | null>(null)
  const result = shallowRef<AutoCropResult | null>(null)
  const isProcessing = ref(false)
  const error = ref<string | null>(null)
  const debugEdges = ref(false)
  const diagnostics = ref<string[]>([])

  let worker: Worker | null = null
  let nextId = 0
  const pending = new Map<string, (response: WorkerResponse) => void>()

  const pushDiagnostic = (line: string) => {
    diagnostics.value = [...diagnostics.value.slice(-49), line]
  }

  const ensureWorker = (): Worker => {
    if (worker) return worker
    worker = new Worker(
      new URL('../workers/autoCrop.worker.ts', import.meta.url),
      { type: 'module' },
    )
    worker.addEventListener('message', (event: MessageEvent<WorkerResponse | WorkerLog>) => {
      const data = event.data as WorkerResponse | WorkerLog | null
      if (!data || typeof data !== 'object') return
      if ((data as WorkerLog).type === 'log') {
        const line = `[worker] ${(data as WorkerLog).message}`
        console.log(line)
        pushDiagnostic(line)
        return
      }
      const response = data as WorkerResponse
      if (!response.id) return
      const resolver = pending.get(response.id)
      if (!resolver) return
      pending.delete(response.id)
      resolver(response)
    })
    worker.addEventListener('error', (event) => {
      const line = `[worker error] ${event.message || 'unknown'} @ ${event.filename}:${event.lineno}`
      console.error(line, event)
      pushDiagnostic(line)
      error.value = event.message || 'Worker error'
      isProcessing.value = false
    })
    worker.addEventListener('messageerror', (event) => {
      const line = `[worker messageerror] ${String(event.data)}`
      console.error(line, event)
      pushDiagnostic(line)
    })
    pushDiagnostic('[main] worker constructed')
    return worker
  }

  const sendToWorker = (
    type: 'init' | 'detect',
    payload: { imageData?: ImageData; debug?: boolean } = {},
  ): Promise<WorkerResponse> => {
    const w = ensureWorker()
    const id = String(++nextId)
    return new Promise<WorkerResponse>((resolve) => {
      pending.set(id, resolve)
      const message =
        type === 'init'
          ? { id, type }
          : { id, type, imageData: payload.imageData!, debug: payload.debug ?? false }
      w.postMessage(message)
    })
  }

  const decodeBuffer = async (buffer: Uint8Array): Promise<ImageBitmap> => {
    const blob = new Blob([buffer.slice().buffer], { type: 'image/*' })
    return await createImageBitmap(blob)
  }

  const bitmapToImageData = (bitmap: ImageBitmap): ImageData => {
    const canvas = document.createElement('canvas')
    canvas.width = bitmap.width
    canvas.height = bitmap.height
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('2D context unavailable')
    ctx.drawImage(bitmap, 0, 0)
    return ctx.getImageData(0, 0, bitmap.width, bitmap.height)
  }

  const releasePreviousResult = () => {
    if (result.value?.edgesUrl) {
      URL.revokeObjectURL(result.value.edgesUrl)
    }
  }

  const releaseSourceBitmap = () => {
    if (sourceBitmap.value) {
      try {
        sourceBitmap.value.close()
      } catch {
        // ignore
      }
      sourceBitmap.value = null
    }
  }

  const runOnCurrentBitmap = async (): Promise<void> => {
    if (!sourceBitmap.value) return
    isProcessing.value = true
    error.value = null
    try {
      const imageData = bitmapToImageData(sourceBitmap.value)
      const response = await sendToWorker('detect', {
        imageData,
        debug: debugEdges.value,
      })
      if (!response.success || !response.result) {
        throw new Error(response.error || 'Auto-crop failed')
      }
      const detected: DetectResult = response.result
      let edgesUrl: string | null = null
      if (detected.edgesPng) {
        const blob = new Blob([detected.edgesPng], { type: 'image/png' })
        edgesUrl = URL.createObjectURL(blob)
      }
      releasePreviousResult()
      result.value = {
        bbox: detected.bbox,
        stripped: detected.stripped,
        candidates: detected.candidates,
        durationMs: detected.durationMs,
        innerSize: detected.innerSize,
        edgesUrl,
      }
    } catch (err) {
      error.value = err instanceof Error ? err.message : String(err)
      releasePreviousResult()
      result.value = null
    } finally {
      isProcessing.value = false
    }
  }

  const selectImage = async (): Promise<void> => {
    if (!window.electronAPI?.dialog?.openImageFile) {
      error.value = 'Image picker IPC unavailable'
      return
    }
    try {
      const path = await window.electronAPI.dialog.openImageFile()
      if (!path) return
      pushDiagnostic(`[main] selected ${path}`)
      isProcessing.value = true
      error.value = null
      const buffer = await window.electronAPI.offline.readImageBuffer(path)
      const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer)
      pushDiagnostic(`[main] read ${bytes.byteLength} bytes`)
      const bitmap = await decodeBuffer(bytes)
      pushDiagnostic(`[main] decoded ${bitmap.width}x${bitmap.height}`)
      releaseSourceBitmap()
      sourceBitmap.value = bitmap
      selectedImagePath.value = path
      releasePreviousResult()
      result.value = null
      await runOnCurrentBitmap()
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      pushDiagnostic(`[main] selectImage error: ${msg}`)
      error.value = msg
      isProcessing.value = false
    }
  }

  const rerun = async (): Promise<void> => {
    await runOnCurrentBitmap()
  }

  const clear = () => {
    releasePreviousResult()
    releaseSourceBitmap()
    selectedImagePath.value = null
    result.value = null
    error.value = null
  }

  onUnmounted(() => {
    releasePreviousResult()
    releaseSourceBitmap()
    pending.clear()
    if (worker) {
      worker.terminate()
      worker = null
    }
  })

  return {
    selectedImagePath,
    sourceBitmap,
    result,
    isProcessing,
    error,
    debugEdges,
    diagnostics,
    selectImage,
    rerun,
    clear,
  }
}

export type UseAutoCropTest = ReturnType<typeof useAutoCropTest>
