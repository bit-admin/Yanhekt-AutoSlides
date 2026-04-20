/**
 * Auto-Crop Web Worker
 *
 * Two detection backends:
 *   1. Canny — classical CV port of REFERENCE/auto_crop_slide.py via OpenCV.js.
 *   2. YOLO  — onnxruntime-web inference against a fine-tuned YOLOv8 model.
 *
 * IMPORTANT: We use top-level static imports so Vite bundles the runtimes into
 * the worker at build time. Dynamic import() of these modules at runtime hangs
 * in Electron's worker context because Vite does not resolve dev-server
 * dynamic imports inside workers the same way it resolves static ones.
 */

import cvRaw from '@techstark/opencv-js'
import * as ort from 'onnxruntime-web'

console.log('[autoCrop worker] module body executing')

const log = (msg: string) => {
  console.log('[autoCrop worker]', msg)
  ;(self as unknown as Worker).postMessage({ type: 'log', message: msg })
}

// ----------------------------------------------------------------------------
// Shared types
// ----------------------------------------------------------------------------

const SUPPORTED_ASPECTS = [16 / 9, 4 / 3]

export type DetectorMode = 'canny_then_yolo' | 'canny_only' | 'yolo_only'

export interface AutoCropCannyConfig {
  aspectTolerance: number
  blackThreshold: number
  maxBorderFrac: number
  cannyLowThreshold: number
  cannyHighThreshold: number
  areaRatioMin: number
  areaRatioMax: number
  marginFrac: number
  fillRatioMin: number
}

export interface AutoCropYoloConfig {
  confidenceThreshold: number
  iouThreshold: number
  inputSize: number
}

export interface DetectConfig {
  mode: DetectorMode
  canny: AutoCropCannyConfig
  yolo: AutoCropYoloConfig
}

const DEFAULT_CANNY_CONFIG: AutoCropCannyConfig = {
  aspectTolerance: 0.05,
  blackThreshold: 20,
  maxBorderFrac: 0.10,
  cannyLowThreshold: 20,
  cannyHighThreshold: 60,
  areaRatioMin: 0.08,
  areaRatioMax: 0.95,
  marginFrac: 0.02,
  fillRatioMin: 0.85,
}

const DEFAULT_YOLO_CONFIG: AutoCropYoloConfig = {
  confidenceThreshold: 0.25,
  iouThreshold: 0.45,
  inputSize: 640,
}

const DEFAULT_CONFIG: DetectConfig = {
  mode: 'canny_then_yolo',
  canny: DEFAULT_CANNY_CONFIG,
  yolo: DEFAULT_YOLO_CONFIG,
}

export interface CandidateInfo {
  x: number
  y: number
  w: number
  h: number
  aspect: number
  aspectScore: number
  areaRatio: number
  fill: number
}

export interface BBox extends CandidateInfo {
  score: number
  confidence?: number
}

export interface DetectResult {
  bbox: BBox | null
  backend: 'canny' | 'yolo' | null
  stripped?: { top: number; bottom: number; left: number; right: number }
  innerSize?: { width: number; height: number }
  candidates: BBox[]
  durationMs: number
  edgesPng?: ArrayBuffer
}

export interface WorkerResponse {
  id: string
  success: boolean
  result?: DetectResult
  error?: string
}

export interface WorkerLog {
  type: 'log'
  message: string
}

interface DetectMessage {
  id: string
  type: 'detect'
  imageData: ImageData
  debug?: boolean
  config?: Partial<DetectConfig>
}

interface InitMessage {
  id: string
  type: 'init'
  modelBuffer?: ArrayBuffer
}

type IncomingMessage = DetectMessage | InitMessage

// ----------------------------------------------------------------------------
// OpenCV.js loader (Canny backend)
// ----------------------------------------------------------------------------

let cv: any = null
let cvLoading: Promise<void> | null = null

async function ensureCvReady(): Promise<void> {
  if (cv) return
  if (!cvLoading) {
    cvLoading = (async () => {
      const candidate: any = cvRaw
      log(
        `opencv import resolved: typeof=${typeof candidate}, ` +
        `hasThen=${typeof candidate?.then === 'function'}, ` +
        `hasCvtColor=${typeof candidate?.cvtColor === 'function'}`,
      )

      let resolved: any

      if (candidate && typeof candidate.then === 'function') {
        log('opencv shape: Emscripten thenable — wrapping in timed Promise…')
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
        log('opencv shape: factory function — calling…')
        const result = candidate({})
        resolved = (result && typeof result.then === 'function') ? await result : result
      } else if (candidate && typeof candidate.cvtColor === 'function') {
        log('opencv shape: already-initialised cv namespace')
        resolved = candidate
      } else {
        resolved = (self as any).cv ?? candidate
      }

      cv = resolved
      const ready =
        cv &&
        typeof cv.cvtColor === 'function' &&
        typeof cv.matFromImageData === 'function' &&
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
// ONNX Runtime Web loader (YOLO backend)
// ----------------------------------------------------------------------------

let ortSession: ort.InferenceSession | null = null
let ortLoading: Promise<void> | null = null
let ortConfigured = false
let cachedModelBuffer: ArrayBuffer | null = null

function configureOrtEnv(): void {
  if (ortConfigured) return
  // Serve WASM from the static-copy location under public/ort-wasm/.
  // Works in both Vite dev server and packaged Electron (file://).
  try {
    ort.env.wasm.wasmPaths = '/ort-wasm/'
  } catch (err) {
    log(`ort wasmPaths set failed: ${err instanceof Error ? err.message : String(err)}`)
  }
  // Single-threaded avoids the COOP/COEP requirement for SharedArrayBuffer.
  ort.env.wasm.numThreads = 1
  ortConfigured = true
}

async function ensureOrtReady(modelBuffer?: ArrayBuffer): Promise<void> {
  if (modelBuffer && modelBuffer !== cachedModelBuffer) {
    // New model provided — drop the old session.
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
      log(`ort: session ready — inputs=${session.inputNames.join(',')} outputs=${session.outputNames.join(',')}`)
    })()
  }
  await ortLoading
}

// ----------------------------------------------------------------------------
// Canny pipeline (unchanged port of auto_crop_slide.py)
// ----------------------------------------------------------------------------

function stripBlackBorders(
  data: Uint8Array | Uint8ClampedArray,
  width: number,
  height: number,
  cfg: AutoCropCannyConfig,
): { top: number; bottom: number; left: number; right: number } {
  const maxV = Math.floor(height * cfg.maxBorderFrac)
  const maxH = Math.floor(width * cfg.maxBorderFrac)

  const rowMean = (row: number) => {
    let sum = 0
    const base = row * width
    for (let j = 0; j < width; j++) sum += data[base + j]
    return sum / width
  }
  const colMean = (col: number) => {
    let sum = 0
    for (let i = 0; i < height; i++) sum += data[i * width + col]
    return sum / height
  }

  let top = 0
  for (let i = 0; i < maxV; i++) {
    if (rowMean(i) > cfg.blackThreshold) break
    top = i + 1
  }
  let bottom = 0
  for (let i = height - 1; i > height - 1 - maxV; i--) {
    if (rowMean(i) > cfg.blackThreshold) break
    bottom = height - i
  }
  let left = 0
  for (let j = 0; j < maxH; j++) {
    if (colMean(j) > cfg.blackThreshold) break
    left = j + 1
  }
  let right = 0
  for (let j = width - 1; j > width - 1 - maxH; j--) {
    if (colMean(j) > cfg.blackThreshold) break
    right = width - j
  }
  return { top, bottom, left, right }
}

function scoreAspect(aspect: number, cfg: AutoCropCannyConfig): number {
  let best = Infinity
  for (const a of SUPPORTED_ASPECTS) {
    const diff = Math.abs(aspect - a) / a
    if (diff < best) best = diff
  }
  return Math.max(0, 1 - best / cfg.aspectTolerance)
}

async function encodeEdgesToPng(edgesMat: any): Promise<ArrayBuffer> {
  const w = edgesMat.cols
  const h = edgesMat.rows
  const rgba = new Uint8ClampedArray(w * h * 4)
  const src = edgesMat.data as Uint8Array
  for (let i = 0; i < src.length; i++) {
    const v = src[i]
    const j = i * 4
    rgba[j] = v
    rgba[j + 1] = v
    rgba[j + 2] = v
    rgba[j + 3] = 255
  }
  const imageData = new ImageData(rgba, w, h)
  const canvas = new OffscreenCanvas(w, h)
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('OffscreenCanvas 2D context unavailable')
  ctx.putImageData(imageData, 0, 0)
  const blob = await canvas.convertToBlob({ type: 'image/png' })
  return await blob.arrayBuffer()
}

async function detectWithCanny(
  imageData: ImageData,
  debug: boolean,
  cfg: AutoCropCannyConfig,
): Promise<Omit<DetectResult, 'durationMs' | 'backend'>> {
  await ensureCvReady()

  const fullW = imageData.width
  const fullH = imageData.height

  const src = cv.matFromImageData(imageData)
  const fullGray = new cv.Mat()
  cv.cvtColor(src, fullGray, cv.COLOR_RGBA2GRAY)

  const stripped = stripBlackBorders(fullGray.data as Uint8Array, fullW, fullH, cfg)
  const innerW = fullW - stripped.left - stripped.right
  const innerH = fullH - stripped.top - stripped.bottom

  const trash: any[] = [src, fullGray]
  let bbox: BBox | null = null
  const candidates: BBox[] = []
  let edgesPng: ArrayBuffer | undefined

  try {
    if (innerW <= 0 || innerH <= 0) {
      return {
        bbox: null,
        stripped,
        candidates,
        innerSize: { width: Math.max(0, innerW), height: Math.max(0, innerH) },
      }
    }

    const inner = fullGray.roi(new cv.Rect(stripped.left, stripped.top, innerW, innerH))
    trash.push(inner)

    const edges = new cv.Mat()
    trash.push(edges)
    cv.Canny(inner, edges, cfg.cannyLowThreshold, cfg.cannyHighThreshold)

    const kernel = cv.Mat.ones(3, 3, cv.CV_8U)
    trash.push(kernel)
    cv.dilate(edges, edges, kernel, new cv.Point(-1, -1), 1,
      cv.BORDER_CONSTANT, cv.morphologyDefaultBorderValue())

    if (debug) {
      try { edgesPng = await encodeEdgesToPng(edges) }
      catch (err) { log(`edges PNG encode failed: ${err instanceof Error ? err.message : String(err)}`) }
    }

    const contours = new cv.MatVector()
    const hierarchy = new cv.Mat()
    trash.push(contours, hierarchy)
    cv.findContours(edges, contours, hierarchy, cv.RETR_LIST, cv.CHAIN_APPROX_SIMPLE)

    let bestScore = -1
    const innerArea = innerW * innerH
    const total = contours.size()

    for (let idx = 0; idx < total; idx++) {
      const cnt = contours.get(idx)
      try {
        const peri = cv.arcLength(cnt, true)
        const approx = new cv.Mat()
        try {
          cv.approxPolyDP(cnt, approx, 0.02 * peri, true)
          const rect = cv.boundingRect(cnt)
          const { x: cx, y: cy, width: cw, height: ch } = rect
          const area = cw * ch

          if (approx.rows !== 4) continue
          const areaRatio = area / innerArea
          if (areaRatio < cfg.areaRatioMin || areaRatio > cfg.areaRatioMax) continue
          const marginTop = cy / innerH
          const marginBottom = (innerH - cy - ch) / innerH
          if (marginTop < cfg.marginFrac && marginBottom < cfg.marginFrac) continue
          const fill = cv.contourArea(cnt, false) / area
          if (fill < cfg.fillRatioMin) continue
          const aspect = cw / ch
          const aspectScore = scoreAspect(aspect, cfg)
          if (aspectScore <= 0) continue

          const candidate: BBox = {
            x: cx, y: cy, w: cw, h: ch,
            aspect, aspectScore, areaRatio, fill,
            score: areaRatio * aspectScore,
          }
          candidates.push(candidate)
          if (candidate.score > bestScore) {
            bestScore = candidate.score
            bbox = candidate
          }
        } finally { approx.delete() }
      } finally { cnt.delete() }
    }

    if (bbox) {
      bbox = { ...bbox, x: bbox.x + stripped.left, y: bbox.y + stripped.top }
    }
  } finally {
    for (const m of trash) { try { m.delete() } catch { /* ignore */ } }
  }

  return {
    bbox,
    stripped,
    innerSize: { width: innerW, height: innerH },
    candidates,
    edgesPng,
  }
}

// ----------------------------------------------------------------------------
// YOLO pipeline
// ----------------------------------------------------------------------------

interface LetterboxResult {
  tensor: Float32Array
  scale: number
  padX: number
  padY: number
}

function letterbox(imageData: ImageData, size: number): LetterboxResult {
  const { width: srcW, height: srcH, data: srcData } = imageData
  const scale = Math.min(size / srcW, size / srcH)
  const newW = Math.round(srcW * scale)
  const newH = Math.round(srcH * scale)
  const padX = Math.floor((size - newW) / 2)
  const padY = Math.floor((size - newH) / 2)

  // Render the image into a size x size canvas with gray (114) padding.
  const canvas = new OffscreenCanvas(size, size)
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('OffscreenCanvas 2D context unavailable')
  ctx.fillStyle = 'rgb(114,114,114)'
  ctx.fillRect(0, 0, size, size)

  // Draw the source via a temp canvas so we can use drawImage with scaling.
  const srcCanvas = new OffscreenCanvas(srcW, srcH)
  const srcCtx = srcCanvas.getContext('2d')
  if (!srcCtx) throw new Error('src OffscreenCanvas 2D context unavailable')
  srcCtx.putImageData(new ImageData(new Uint8ClampedArray(srcData), srcW, srcH), 0, 0)
  ctx.drawImage(srcCanvas, 0, 0, srcW, srcH, padX, padY, newW, newH)

  const padded = ctx.getImageData(0, 0, size, size).data
  // HWC uint8 (RGBA) → CHW float32 (RGB, /255)
  const area = size * size
  const tensor = new Float32Array(3 * area)
  for (let i = 0; i < area; i++) {
    const j = i * 4
    tensor[i] = padded[j] / 255             // R
    tensor[i + area] = padded[j + 1] / 255  // G
    tensor[i + 2 * area] = padded[j + 2] / 255 // B
  }
  return { tensor, scale, padX, padY }
}

function nms(boxes: BBox[], iouThreshold: number): BBox[] {
  const sorted = [...boxes].sort((a, b) => (b.confidence ?? b.score) - (a.confidence ?? a.score))
  const kept: BBox[] = []
  const iou = (a: BBox, b: BBox) => {
    const ax2 = a.x + a.w
    const ay2 = a.y + a.h
    const bx2 = b.x + b.w
    const by2 = b.y + b.h
    const ix1 = Math.max(a.x, b.x)
    const iy1 = Math.max(a.y, b.y)
    const ix2 = Math.min(ax2, bx2)
    const iy2 = Math.min(ay2, by2)
    const iw = Math.max(0, ix2 - ix1)
    const ih = Math.max(0, iy2 - iy1)
    const inter = iw * ih
    const union = a.w * a.h + b.w * b.h - inter
    return union <= 0 ? 0 : inter / union
  }
  for (const cand of sorted) {
    let overlap = false
    for (const k of kept) {
      if (iou(cand, k) > iouThreshold) { overlap = true; break }
    }
    if (!overlap) kept.push(cand)
  }
  return kept
}

function decodeYoloOutput(
  output: Float32Array,
  dims: readonly number[],
  srcW: number,
  srcH: number,
  inputSize: number,
  scale: number,
  padX: number,
  padY: number,
  confThreshold: number,
  iouThreshold: number,
): BBox[] {
  // YOLOv8 export for single class yields [1, 5, N] (cx, cy, w, h, cls).
  // Transpose into per-anchor records.
  if (dims.length !== 3 || dims[0] !== 1) {
    throw new Error(`Unexpected YOLO output shape: [${dims.join(',')}]`)
  }
  const C = dims[1]
  const N = dims[2]
  if (C < 5) {
    throw new Error(`Unexpected YOLO output channel count: ${C} (need ≥5)`)
  }

  const candidates: BBox[] = []
  for (let i = 0; i < N; i++) {
    const cx = output[0 * N + i]
    const cy = output[1 * N + i]
    const w = output[2 * N + i]
    const h = output[3 * N + i]
    // Single-class: conf is at channel 4. For multi-class, pick max across classes.
    let conf = output[4 * N + i]
    if (C > 5) {
      for (let c = 5; c < C; c++) {
        const v = output[c * N + i]
        if (v > conf) conf = v
      }
    }
    if (conf < confThreshold) continue

    // Undo letterbox to source-image coordinates.
    const x1i = cx - w / 2
    const y1i = cy - h / 2
    const x2i = cx + w / 2
    const y2i = cy + h / 2
    const x1 = (x1i - padX) / scale
    const y1 = (y1i - padY) / scale
    const x2 = (x2i - padX) / scale
    const y2 = (y2i - padY) / scale
    const bx = Math.max(0, Math.min(srcW, x1))
    const by = Math.max(0, Math.min(srcH, y1))
    const ex = Math.max(0, Math.min(srcW, x2))
    const ey = Math.max(0, Math.min(srcH, y2))
    const bw = ex - bx
    const bh = ey - by
    if (bw <= 1 || bh <= 1) continue

    const aspect = bw / bh
    candidates.push({
      x: bx, y: by, w: bw, h: bh,
      aspect,
      aspectScore: 1,
      areaRatio: (bw * bh) / (srcW * srcH),
      fill: 1,
      score: conf,
      confidence: conf,
    })
  }
  return nms(candidates, iouThreshold)
}

async function detectWithYolo(
  imageData: ImageData,
  cfg: AutoCropYoloConfig,
): Promise<Omit<DetectResult, 'durationMs' | 'backend'>> {
  await ensureOrtReady()
  if (!ortSession) throw new Error('ORT session unavailable')

  const { tensor, scale, padX, padY } = letterbox(imageData, cfg.inputSize)
  const input = new ort.Tensor('float32', tensor, [1, 3, cfg.inputSize, cfg.inputSize])
  const inputName = ortSession.inputNames[0]
  const feeds: Record<string, ort.Tensor> = { [inputName]: input }
  const outputMap = await ortSession.run(feeds)
  const outputName = ortSession.outputNames[0]
  const outputTensor = outputMap[outputName]
  const output = outputTensor.data as Float32Array
  const dims = outputTensor.dims

  const detections = decodeYoloOutput(
    output, dims,
    imageData.width, imageData.height,
    cfg.inputSize, scale, padX, padY,
    cfg.confidenceThreshold, cfg.iouThreshold,
  )

  return {
    bbox: detections[0] ?? null,
    candidates: detections,
  }
}

// ----------------------------------------------------------------------------
// Dispatcher
// ----------------------------------------------------------------------------

function mergeConfig(partial?: Partial<DetectConfig>): DetectConfig {
  return {
    mode: partial?.mode ?? DEFAULT_CONFIG.mode,
    canny: { ...DEFAULT_CANNY_CONFIG, ...(partial?.canny ?? {}) },
    yolo: { ...DEFAULT_YOLO_CONFIG, ...(partial?.yolo ?? {}) },
  }
}

async function dispatch(
  imageData: ImageData,
  debug: boolean,
  cfg: DetectConfig,
): Promise<DetectResult> {
  const start = performance.now()

  if (cfg.mode === 'canny_only') {
    const r = await detectWithCanny(imageData, debug, cfg.canny)
    return { ...r, backend: r.bbox ? 'canny' : null, durationMs: performance.now() - start }
  }

  if (cfg.mode === 'yolo_only') {
    const r = await detectWithYolo(imageData, cfg.yolo)
    return { ...r, backend: r.bbox ? 'yolo' : null, durationMs: performance.now() - start }
  }

  // canny_then_yolo: try Canny first; fall back to YOLO on miss.
  const cannyResult = await detectWithCanny(imageData, debug, cfg.canny)
  if (cannyResult.bbox) {
    return { ...cannyResult, backend: 'canny', durationMs: performance.now() - start }
  }
  const yoloResult = await detectWithYolo(imageData, cfg.yolo)
  return {
    // Keep Canny's debug edges/stripped so the red-box overlay still has context.
    ...yoloResult,
    stripped: cannyResult.stripped,
    innerSize: cannyResult.innerSize,
    edgesPng: cannyResult.edgesPng,
    backend: yoloResult.bbox ? 'yolo' : null,
    durationMs: performance.now() - start,
  }
}

// ----------------------------------------------------------------------------
// Message handler
// ----------------------------------------------------------------------------

self.addEventListener('message', async (event: MessageEvent<IncomingMessage>) => {
  const msg = event.data
  if (!msg || typeof msg !== 'object') return

  if (msg.type === 'init') {
    try {
      if (msg.modelBuffer) {
        await ensureOrtReady(msg.modelBuffer)
      }
      ;(self as unknown as Worker).postMessage({ id: msg.id, success: true } as WorkerResponse)
    } catch (error) {
      const errMsg = error instanceof Error ? (error.stack || error.message) : String(error)
      log(`init ERROR: ${errMsg}`)
      ;(self as unknown as Worker).postMessage({ id: msg.id, success: false, error: errMsg } as WorkerResponse)
    }
    return
  }

  if (msg.type === 'detect') {
    try {
      const cfg = mergeConfig(msg.config)
      const result = await dispatch(msg.imageData, msg.debug ?? false, cfg)
      const transfers: Transferable[] = []
      if (result.edgesPng) transfers.push(result.edgesPng)
      ;(self as unknown as Worker).postMessage({ id: msg.id, success: true, result } as WorkerResponse, transfers)
    } catch (error) {
      const errMsg = error instanceof Error ? (error.stack || error.message) : String(error)
      log(`detect ERROR: ${errMsg}`)
      ;(self as unknown as Worker).postMessage({ id: msg.id, success: false, error: errMsg } as WorkerResponse)
    }
  }
})

log('message listener installed')
