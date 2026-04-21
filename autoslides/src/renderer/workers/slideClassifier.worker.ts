/**
 * Slide Classifier Web Worker
 *
 * MobileNetV4 ONNX classifier (3 classes: may_be_slide / not_slide / slide).
 * Preprocessing matches REFERENCE/inference_opencv.py:
 *   BGR->RGB -> resize 256x256 INTER_AREA -> /255 -> ImageNet mean/std -> CHW float32.
 *
 * Static top-level imports mirror autoCrop.worker.ts so Vite bundles the
 * runtimes into the worker at build time.
 */

import cvRaw from '@techstark/opencv-js'
import * as ort from 'onnxruntime-web'

const log = (msg: string) => {
  console.log('[slideClassifier worker]', msg)
  ;(self as unknown as Worker).postMessage({ type: 'log', message: msg })
}

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

export const CLASS_NAMES = ['may_be_slide', 'not_slide', 'slide'] as const
export type ClassifierClass = (typeof CLASS_NAMES)[number]

export interface ClassifyResult {
  predictedClass: ClassifierClass
  confidence: number
  probabilities: Record<ClassifierClass, number>
  durationMs: number
}

export interface WorkerResponse {
  id: string
  success: boolean
  result?: ClassifyResult
  error?: string
}

export interface WorkerLog {
  type: 'log'
  message: string
}

interface InitMessage {
  id: string
  type: 'init'
  modelBuffer: ArrayBuffer
}

interface ClassifyMessage {
  id: string
  type: 'classify'
  imageData: ImageData
}

type IncomingMessage = InitMessage | ClassifyMessage

// ----------------------------------------------------------------------------
// OpenCV.js loader (shared style with autoCrop.worker.ts)
// ----------------------------------------------------------------------------

let cv: any = null
let cvLoading: Promise<void> | null = null

async function ensureCvReady(): Promise<void> {
  if (cv) return
  if (!cvLoading) {
    cvLoading = (async () => {
      const candidate: any = cvRaw
      let resolved: any

      if (candidate && typeof candidate.then === 'function') {
        resolved = (await new Promise<{ cv: any }>((resolve, reject) => {
          const timer = setTimeout(
            () => reject(new Error('OpenCV.js init timed out (30 s)')),
            30_000,
          )
          candidate.then((initialised: any) => {
            clearTimeout(timer)
            resolve({ cv: initialised })
          })
        })).cv
      } else if (typeof candidate === 'function') {
        const result = candidate({})
        resolved = (result && typeof result.then === 'function') ? await result : result
      } else if (candidate && typeof candidate.cvtColor === 'function') {
        resolved = candidate
      } else {
        resolved = (self as any).cv ?? candidate
      }

      cv = resolved
      const ready =
        cv &&
        typeof cv.cvtColor === 'function' &&
        typeof cv.matFromImageData === 'function' &&
        typeof cv.resize === 'function' &&
        typeof cv.Mat === 'function'
      if (!ready) {
        throw new Error('OpenCV.js initialised but cv namespace is incomplete')
      }
      log('opencv ready')
    })()
  }
  await cvLoading
}

// ----------------------------------------------------------------------------
// ONNX Runtime Web loader
// ----------------------------------------------------------------------------

let ortSession: ort.InferenceSession | null = null
let ortLoading: Promise<void> | null = null
let ortConfigured = false
let cachedModelBuffer: ArrayBuffer | null = null

function resolveOrtWasmBase(): string {
  if (import.meta.env.DEV) return '/ort-wasm/'
  return new URL('../ort-wasm/', self.location.href).href
}

function configureOrtEnv(): void {
  if (ortConfigured) return
  ort.env.wasm.wasmPaths = resolveOrtWasmBase()
  ort.env.wasm.numThreads = 1
  ortConfigured = true
}

async function ensureOrtReady(modelBuffer?: ArrayBuffer): Promise<void> {
  if (modelBuffer && modelBuffer !== cachedModelBuffer) {
    ortSession = null
    ortLoading = null
    cachedModelBuffer = modelBuffer
  }
  if (ortSession) return
  if (!cachedModelBuffer) {
    throw new Error('ORT session requested before any modelBuffer was provided')
  }
  if (!ortLoading) {
    ortLoading = (async () => {
      configureOrtEnv()
      log(`ort: creating session from ${cachedModelBuffer!.byteLength} bytes…`)
      const session = await ort.InferenceSession.create(cachedModelBuffer!, {
        executionProviders: ['wasm'],
        graphOptimizationLevel: 'all',
      })
      ortSession = session
      log(`ort: classifier ready — inputs=${session.inputNames.join(',')} outputs=${session.outputNames.join(',')}`)
    })()
  }
  await ortLoading
}

// ----------------------------------------------------------------------------
// Preprocessing (matches REFERENCE/inference_opencv.py)
// ----------------------------------------------------------------------------

const INPUT_SIZE = 256
const IMAGENET_MEAN = [0.485, 0.456, 0.406]
const IMAGENET_STD = [0.229, 0.224, 0.225]

function preprocess(imageData: ImageData): Float32Array {
  const srcMat = cv.matFromImageData(imageData) // RGBA
  const rgbMat = new cv.Mat()
  try {
    cv.cvtColor(srcMat, rgbMat, cv.COLOR_RGBA2RGB)
    const resized = new cv.Mat()
    try {
      cv.resize(rgbMat, resized, new cv.Size(INPUT_SIZE, INPUT_SIZE), 0, 0, cv.INTER_AREA)

      const hw = INPUT_SIZE * INPUT_SIZE
      const out = new Float32Array(3 * hw)
      const data = resized.data as Uint8Array
      // HWC(RGB) uint8 -> CHW float32 normalised
      for (let i = 0; i < hw; i++) {
        const r = data[i * 3] / 255
        const g = data[i * 3 + 1] / 255
        const b = data[i * 3 + 2] / 255
        out[i] = (r - IMAGENET_MEAN[0]) / IMAGENET_STD[0]
        out[i + hw] = (g - IMAGENET_MEAN[1]) / IMAGENET_STD[1]
        out[i + 2 * hw] = (b - IMAGENET_MEAN[2]) / IMAGENET_STD[2]
      }
      return out
    } finally {
      resized.delete()
    }
  } finally {
    rgbMat.delete()
    srcMat.delete()
  }
}

function softmax3(logits: Float32Array | number[]): number[] {
  const m = Math.max(logits[0], logits[1], logits[2])
  const e0 = Math.exp(logits[0] - m)
  const e1 = Math.exp(logits[1] - m)
  const e2 = Math.exp(logits[2] - m)
  const s = e0 + e1 + e2
  return [e0 / s, e1 / s, e2 / s]
}

async function runClassify(imageData: ImageData): Promise<ClassifyResult> {
  const t0 = performance.now()
  await ensureCvReady()
  await ensureOrtReady()
  const tensorData = preprocess(imageData)
  const input = new ort.Tensor('float32', tensorData, [1, 3, INPUT_SIZE, INPUT_SIZE])
  const session = ortSession!
  const feeds: Record<string, ort.Tensor> = {}
  feeds[session.inputNames[0]] = input
  const results = await session.run(feeds)
  const output = results[session.outputNames[0]]
  const logits = output.data as Float32Array
  if (!logits || logits.length < 3) {
    throw new Error(`Unexpected classifier output length: ${logits?.length}`)
  }
  const probs = softmax3(logits)
  let bestIdx = 0
  for (let i = 1; i < 3; i++) if (probs[i] > probs[bestIdx]) bestIdx = i
  const probabilities: Record<ClassifierClass, number> = {
    may_be_slide: probs[0],
    not_slide: probs[1],
    slide: probs[2],
  }
  return {
    predictedClass: CLASS_NAMES[bestIdx],
    confidence: probs[bestIdx],
    probabilities,
    durationMs: performance.now() - t0,
  }
}

// ----------------------------------------------------------------------------
// Message handler
// ----------------------------------------------------------------------------

self.addEventListener('message', async (event: MessageEvent<IncomingMessage>) => {
  const msg = event.data
  if (!msg || typeof msg !== 'object' || !('type' in msg)) return

  const respond = (response: WorkerResponse): void => {
    ;(self as unknown as Worker).postMessage(response)
  }

  try {
    if (msg.type === 'init') {
      await ensureOrtReady(msg.modelBuffer)
      await ensureCvReady()
      respond({ id: msg.id, success: true })
      return
    }
    if (msg.type === 'classify') {
      const result = await runClassify(msg.imageData)
      respond({ id: msg.id, success: true, result })
      return
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    respond({ id: (msg as { id: string }).id, success: false, error: message })
  }
})
