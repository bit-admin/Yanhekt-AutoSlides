/**
 * Auto-Crop Web Worker
 *
 * Ports REFERENCE/auto_crop_slide.py `detect_slide_bbox` to OpenCV.js.
 *
 * IMPORTANT: We use a top-level static import so Vite bundles opencv.js into
 * the worker at build time.  A dynamic import() of the same module at runtime
 * hangs in Electron's worker context because Vite does not resolve dev-server
 * dynamic imports inside workers the same way it resolves static ones.
 */

import cvRaw from '@techstark/opencv-js'

console.log('[autoCrop worker] module body executing')

const log = (msg: string) => {
  console.log('[autoCrop worker]', msg)
  ;(self as unknown as Worker).postMessage({ type: 'log', message: msg })
}

// Mirror the Python constants verbatim so the port stays in lock-step.
const SUPPORTED_ASPECTS = [16 / 9, 4 / 3]
const ASPECT_TOLERANCE = 0.12
const BLACK_THRESHOLD = 20
const MAX_BORDER_FRAC = 0.10

let cv: any = null
let cvLoading: Promise<void> | null = null

async function ensureCvReady(): Promise<void> {
  if (cv) return
  if (!cvLoading) {
    cvLoading = (async () => {
      // @techstark/opencv-js CJS default export is the Emscripten Module
      // object.  It has a non-standard `.then` that:
      //   • calls the callback synchronously if WASM is already done
      //   • defers to onRuntimeInitialized otherwise
      // Crucially it ignores the `reject` argument, so `await module` hangs
      // forever if init fails.  We wrap it in a real Promise with a timeout.
      const candidate: any = cvRaw
      log(
        `static import resolved: typeof=${typeof candidate}, ` +
        `hasThen=${typeof candidate?.then === 'function'}, ` +
        `hasCvtColor=${typeof candidate?.cvtColor === 'function'}`,
      )

      let resolved: any

      if (candidate && typeof candidate.then === 'function') {
        // Emscripten thenable — wrap in a real timed Promise so we get a
        // proper rejection if WASM init never completes.
        //
        // IMPORTANT: resolve({ cv: initialised }) instead of resolve(initialised).
        // The cv Module is itself a thenable, so passing it directly to resolve()
        // causes JavaScript's Promise resolution to follow the thenable again,
        // creating an infinite loop.  Wrapping it in a plain object stops that.
        log('shape: Emscripten thenable — wrapping in timed Promise…')
        resolved = (await new Promise<{ cv: any }>((resolve, reject) => {
          const timer = setTimeout(
            () => reject(new Error('OpenCV.js init timed out (30 s)')),
            30_000,
          )
          candidate.then((initialised: any) => {
            clearTimeout(timer)
            log(`thenable resolved: cvtColor=${typeof initialised?.cvtColor}`)
            resolve({ cv: initialised })
          })
        })).cv

      } else if (typeof candidate === 'function') {
        log('shape: factory function — calling…')
        const result = candidate({})
        log(`factory result hasPromise=${typeof result?.then === 'function'}`)
        resolved = (result && typeof result.then === 'function') ? await result : result

      } else if (candidate && typeof candidate.cvtColor === 'function') {
        log('shape: already-initialised cv namespace')
        resolved = candidate

      } else {
        const globalCv = (self as any).cv
        log(`shape unknown — trying self.cv: typeof=${typeof globalCv}`)
        resolved = globalCv ?? candidate
      }

      cv = resolved
      const ready =
        cv &&
        typeof cv.cvtColor === 'function' &&
        typeof cv.matFromImageData === 'function' &&
        typeof cv.Mat === 'function'
      log(
        `cv ready=${ready} | cvtColor=${typeof cv?.cvtColor} | ` +
        `matFromImageData=${typeof cv?.matFromImageData} | ` +
        `Canny=${typeof cv?.Canny} | findContours=${typeof cv?.findContours}`,
      )
      if (!ready) {
        throw new Error('OpenCV.js initialised but cv namespace is incomplete')
      }
    })()
  }
  await cvLoading
}

interface DetectMessage {
  id: string
  type: 'detect'
  imageData: ImageData
  debug?: boolean
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

export interface DetectResult {
  bbox: (CandidateInfo & { score: number }) | null
  stripped: { top: number; bottom: number; left: number; right: number }
  candidates: CandidateInfo[]
  durationMs: number
  innerSize: { width: number; height: number }
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

type IncomingMessage = DetectMessage | { id: string; type: 'init' }

function stripBlackBorders(
  data: Uint8Array | Uint8ClampedArray,
  width: number,
  height: number,
): { top: number; bottom: number; left: number; right: number } {
  const maxV = Math.floor(height * MAX_BORDER_FRAC)
  const maxH = Math.floor(width * MAX_BORDER_FRAC)

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
    if (rowMean(i) > BLACK_THRESHOLD) break
    top = i + 1
  }

  let bottom = 0
  for (let i = height - 1; i > height - 1 - maxV; i--) {
    if (rowMean(i) > BLACK_THRESHOLD) break
    bottom = height - i
  }

  let left = 0
  for (let j = 0; j < maxH; j++) {
    if (colMean(j) > BLACK_THRESHOLD) break
    left = j + 1
  }

  let right = 0
  for (let j = width - 1; j > width - 1 - maxH; j--) {
    if (colMean(j) > BLACK_THRESHOLD) break
    right = width - j
  }

  return { top, bottom, left, right }
}

function scoreAspect(aspect: number): number {
  let best = Infinity
  for (const a of SUPPORTED_ASPECTS) {
    const diff = Math.abs(aspect - a) / a
    if (diff < best) best = diff
  }
  return Math.max(0, 1 - best / ASPECT_TOLERANCE)
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

async function detectSlideBbox(
  imageData: ImageData,
  debug: boolean,
): Promise<DetectResult> {
  const start = performance.now()
  await ensureCvReady()
  log(`detect: ${imageData.width}x${imageData.height} debug=${debug}`)

  const fullW = imageData.width
  const fullH = imageData.height

  const src = cv.matFromImageData(imageData)
  const fullGray = new cv.Mat()
  cv.cvtColor(src, fullGray, cv.COLOR_RGBA2GRAY)

  const stripped = stripBlackBorders(fullGray.data as Uint8Array, fullW, fullH)
  const innerW = fullW - stripped.left - stripped.right
  const innerH = fullH - stripped.top - stripped.bottom
  log(
    `stripped t=${stripped.top} b=${stripped.bottom} l=${stripped.left} r=${stripped.right} ` +
    `inner=${innerW}x${innerH}`,
  )

  const trash: any[] = [src, fullGray]
  let bbox: (CandidateInfo & { score: number }) | null = null
  const candidates: CandidateInfo[] = []
  let edgesPng: ArrayBuffer | undefined

  try {
    if (innerW <= 0 || innerH <= 0) {
      return {
        bbox: null, stripped, candidates,
        durationMs: performance.now() - start,
        innerSize: { width: Math.max(0, innerW), height: Math.max(0, innerH) },
      }
    }

    const inner = fullGray.roi(new cv.Rect(stripped.left, stripped.top, innerW, innerH))
    trash.push(inner)

    const edges = new cv.Mat()
    trash.push(edges)
    cv.Canny(inner, edges, 20, 60)

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
    log(`findContours: ${total} contours`)

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
          if (areaRatio < 0.08 || areaRatio > 0.95) continue
          const marginTop = cy / innerH
          const marginBottom = (innerH - cy - ch) / innerH
          if (marginTop < 0.02 && marginBottom < 0.02) continue
          const fill = cv.contourArea(cnt, false) / area
          if (fill < 0.85) continue
          const aspect = cw / ch
          const aspectScore = scoreAspect(aspect)
          if (aspectScore <= 0) continue

          const candidate: CandidateInfo = { x: cx, y: cy, w: cw, h: ch, aspect, aspectScore, areaRatio, fill }
          candidates.push(candidate)
          const score = areaRatio * aspectScore
          if (score > bestScore) { bestScore = score; bbox = { ...candidate, score } }
        } finally { approx.delete() }
      } finally { cnt.delete() }
    }

    if (bbox) {
      bbox = { ...bbox, x: bbox.x + stripped.left, y: bbox.y + stripped.top }
    }
    log(
      `done: candidates=${candidates.length} ` +
      `best=${bbox ? `(${bbox.x},${bbox.y},${bbox.w},${bbox.h}) aspect=${bbox.aspect.toFixed(3)}` : 'none'}`,
    )
  } finally {
    for (const m of trash) { try { m.delete() } catch { /* ignore */ } }
  }

  return { bbox, stripped, candidates, durationMs: performance.now() - start, innerSize: { width: innerW, height: innerH }, edgesPng }
}

self.addEventListener('message', async (event: MessageEvent<IncomingMessage>) => {
  const msg = event.data
  if (!msg || typeof msg !== 'object') return

  if (msg.type === 'init') {
    try {
      await ensureCvReady()
      ;(self as unknown as Worker).postMessage({ id: msg.id, success: true } as WorkerResponse)
    } catch (error) {
      const errMsg = error instanceof Error ? (error.stack || error.message) : String(error)
      ;(self as unknown as Worker).postMessage({ id: msg.id, success: false, error: errMsg } as WorkerResponse)
    }
    return
  }

  if (msg.type === 'detect') {
    try {
      const result = await detectSlideBbox(msg.imageData, msg.debug ?? false)
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
