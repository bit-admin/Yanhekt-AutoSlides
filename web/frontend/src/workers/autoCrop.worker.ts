/**
 * Canny-only auto-crop Web Worker for AutoSlides web.
 *
 * Ported from autoslides/src/renderer/shared/workers/autoCrop.worker.ts —
 * YOLO / onnxruntime-web paths deliberately omitted this phase.
 *
 * IMPORTANT: static import of @techstark/opencv-js so Vite bundles the WASM
 * runtime into the worker. Dynamic import() of this package hangs in workers.
 */

import cvRaw from '@techstark/opencv-js'

const SUPPORTED_ASPECTS = [16 / 9, 4 / 3]

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

export interface DetectConfig {
  canny: AutoCropCannyConfig
}

const DEFAULT_CANNY_CONFIG: AutoCropCannyConfig = {
  aspectTolerance: 0.05,
  blackThreshold: 20,
  maxBorderFrac: 0.1,
  cannyLowThreshold: 20,
  cannyHighThreshold: 60,
  areaRatioMin: 0.08,
  areaRatioMax: 0.95,
  marginFrac: 0.02,
  fillRatioMin: 0.85,
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
  backend: 'canny' | null
  stripped?: { top: number; bottom: number; left: number; right: number }
  innerSize?: { width: number; height: number }
  candidates: BBox[]
  durationMs: number
}

export interface WorkerResponse {
  id: string
  success: boolean
  result?: DetectResult
  error?: string
}

interface DetectMessage {
  id: string
  type: 'detect'
  imageData: ImageData
  debug?: boolean
  config?: Partial<DetectConfig> & { canny?: Partial<AutoCropCannyConfig> }
}

// ----------------------------------------------------------------------------
// OpenCV.js loader
// ----------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let cv: any = null
let cvLoading: Promise<void> | null = null

async function ensureCvReady(): Promise<void> {
  if (cv) return
  if (!cvLoading) {
    cvLoading = (async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const candidate: any = cvRaw

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let resolved: any

      if (candidate && typeof candidate.then === 'function') {
        resolved = (
          await new Promise<{ cv: unknown }>((resolve, reject) => {
            const timer = setTimeout(
              () => reject(new Error('OpenCV.js init timed out (30 s)')),
              30_000,
            )
            candidate.then((initialised: unknown) => {
              clearTimeout(timer)
              resolve({ cv: initialised })
            })
          })
        ).cv
      } else if (typeof candidate === 'function') {
        const result = candidate({})
        resolved = result && typeof result.then === 'function' ? await result : result
      } else if (candidate && typeof candidate.cvtColor === 'function') {
        resolved = candidate
      } else {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
    })()
  }
  await cvLoading
}

// ----------------------------------------------------------------------------
// Canny pipeline (port of auto_crop_slide.py / Electron detectWithCanny)
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

async function detectWithCanny(
  imageData: ImageData,
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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const trash: any[] = [src, fullGray]
  let bbox: BBox | null = null
  const candidates: BBox[] = []

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
    cv.dilate(
      edges,
      edges,
      kernel,
      new cv.Point(-1, -1),
      1,
      cv.BORDER_CONSTANT,
      cv.morphologyDefaultBorderValue(),
    )

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
            x: cx,
            y: cy,
            w: cw,
            h: ch,
            aspect,
            aspectScore,
            areaRatio,
            fill,
            score: areaRatio * aspectScore,
          }
          candidates.push(candidate)
          if (candidate.score > bestScore) {
            bestScore = candidate.score
            bbox = candidate
          }
        } finally {
          approx.delete()
        }
      } finally {
        cnt.delete()
      }
    }

    if (bbox) {
      bbox = { ...bbox, x: bbox.x + stripped.left, y: bbox.y + stripped.top }
    }
  } finally {
    for (const m of trash) {
      try {
        m.delete()
      } catch {
        /* ignore */
      }
    }
  }

  return {
    bbox,
    stripped,
    innerSize: { width: innerW, height: innerH },
    candidates,
  }
}

function mergeConfig(
  partial?: Partial<DetectConfig> & { canny?: Partial<AutoCropCannyConfig> },
): DetectConfig {
  return {
    canny: { ...DEFAULT_CANNY_CONFIG, ...(partial?.canny ?? {}) },
  }
}

// ----------------------------------------------------------------------------
// Message handler
// ----------------------------------------------------------------------------

self.addEventListener('message', async (event: MessageEvent<DetectMessage>) => {
  const msg = event.data
  if (!msg || typeof msg !== 'object' || msg.type !== 'detect') return

  try {
    const cfg = mergeConfig(msg.config)
    const start = performance.now()
    const r = await detectWithCanny(msg.imageData, cfg.canny)
    const result: DetectResult = {
      ...r,
      backend: r.bbox ? 'canny' : null,
      durationMs: performance.now() - start,
    }
    ;(self as unknown as Worker).postMessage({
      id: msg.id,
      success: true,
      result,
    } as WorkerResponse)
  } catch (error) {
    const errMsg = error instanceof Error ? error.stack || error.message : String(error)
    ;(self as unknown as Worker).postMessage({
      id: msg.id,
      success: false,
      error: errMsg,
    } as WorkerResponse)
  }
})
