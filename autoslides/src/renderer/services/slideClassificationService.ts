import type { ClassifierClass, ClassifyResult } from '../workers/slideClassifier.worker'
import { classifyImage as runMlClassify, ensureMlClassifierReady } from '../composables/useMlClassifier'

export type ClassificationValue = 'slide' | 'not_slide' | 'may_be_slide_edit'

export interface UnifiedClassificationResult {
  success: boolean
  result?: Record<string, ClassificationValue>
  error?: string
}

export interface UnifiedSingleClassificationResult {
  success: boolean
  result?: { classification: ClassificationValue }
  error?: string
}

export interface MlThresholdValues {
  trustLow: number
  trustHigh: number
  slideCheckLow: number
}

interface AIFilteringConfigShape {
  classifierMode?: 'llm' | 'ml'
  mlThresholds?: MlThresholdValues
}

/**
 * Pure policy function — decide the final class for a single ML inference result,
 * applying the configurable threshold bands and the distinguishMaybeSlide flag.
 */
export function applyMlDecision(
  probabilities: Record<ClassifierClass, number>,
  predictedClass: ClassifierClass,
  confidence: number,
  thresholds: MlThresholdValues,
  distinguishMaybeSlide: boolean
): ClassificationValue {
  if (predictedClass === 'slide') return 'slide'

  const mapRemoval = (): ClassificationValue => {
    if (predictedClass === 'not_slide') return 'not_slide'
    // predictedClass === 'may_be_slide'
    return distinguishMaybeSlide ? 'may_be_slide_edit' : 'not_slide'
  }

  if (confidence < thresholds.trustLow) {
    // Low confidence in non-slide prediction → keep as slide.
    return 'slide'
  }
  if (confidence > thresholds.trustHigh) {
    // High confidence → trust and remove.
    return mapRemoval()
  }
  // Check band: consult slide probability.
  const slideProb = probabilities.slide
  if (slideProb < thresholds.slideCheckLow) return mapRemoval()
  return 'slide'
}

async function decodeBase64ToImageData(base64: string): Promise<ImageData> {
  const byteStr = atob(base64)
  const len = byteStr.length
  const bytes = new Uint8Array(len)
  for (let i = 0; i < len; i++) bytes[i] = byteStr.charCodeAt(i)
  const blob = new Blob([bytes])
  const bitmap = await createImageBitmap(blob)
  try {
    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height)
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('OffscreenCanvas 2D context unavailable')
    ctx.drawImage(bitmap, 0, 0)
    return ctx.getImageData(0, 0, bitmap.width, bitmap.height)
  } finally {
    bitmap.close()
  }
}

async function classifyOneWithMl(
  base64: string,
  thresholds: MlThresholdValues,
  distinguishMaybeSlide: boolean
): Promise<ClassificationValue> {
  const imageData = await decodeBase64ToImageData(base64)
  const result: ClassifyResult = await runMlClassify(imageData)
  return applyMlDecision(
    result.probabilities,
    result.predictedClass,
    result.confidence,
    thresholds,
    distinguishMaybeSlide
  )
}

async function getActiveAISettings(): Promise<{
  mode: 'llm' | 'ml'
  thresholds: MlThresholdValues
  distinguishMaybeSlide: boolean
}> {
  const [cfg, distinguishMaybeSlide] = await Promise.all([
    window.electronAPI.config.getAIFilteringConfig() as Promise<AIFilteringConfigShape>,
    window.electronAPI.config.getDistinguishMaybeSlide() as Promise<boolean>
  ])
  const mode: 'llm' | 'ml' = cfg?.classifierMode === 'ml' ? 'ml' : 'llm'
  const thresholds: MlThresholdValues = cfg?.mlThresholds
    ? { ...cfg.mlThresholds }
    : { trustLow: 0.75, trustHigh: 0.9, slideCheckLow: 0.25 }
  return { mode, thresholds, distinguishMaybeSlide }
}

/**
 * Batch classification — drop-in replacement for window.electronAPI.ai.classifyMultipleImages.
 * Returns the same { success, result: { image_0: 'slide' | … }, error? } shape so the
 * three existing invocation sites can consume it unchanged.
 */
export async function classifyMultipleImages(
  base64Images: string[],
  type: 'live' | 'recorded',
  token?: string
): Promise<UnifiedClassificationResult> {
  const settings = await getActiveAISettings()

  if (settings.mode === 'llm') {
    const result = await window.electronAPI.ai.classifyMultipleImages(base64Images, type, token)
    return result as UnifiedClassificationResult
  }

  // ML branch
  try {
    await ensureMlClassifierReady()
    const out: Record<string, ClassificationValue> = {}
    // Process sequentially to keep the single WASM-threaded worker saturated
    // without queueing dozens of outstanding messages.
    for (let i = 0; i < base64Images.length; i++) {
      out[`image_${i}`] = await classifyOneWithMl(
        base64Images[i],
        settings.thresholds,
        settings.distinguishMaybeSlide
      )
    }
    return { success: true, result: out }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return { success: false, error: message }
  }
}

/**
 * Single-image classification — drop-in replacement for classifySingleImage
 * (live mode, returns { classification: … }).
 */
export async function classifySingleImage(
  base64Image: string,
  type: 'live' | 'recorded',
  token?: string
): Promise<UnifiedSingleClassificationResult> {
  const settings = await getActiveAISettings()

  if (settings.mode === 'llm') {
    const result = await window.electronAPI.ai.classifySingleImage(base64Image, type, token)
    return result as UnifiedSingleClassificationResult
  }

  try {
    await ensureMlClassifierReady()
    const classification = await classifyOneWithMl(
      base64Image,
      settings.thresholds,
      settings.distinguishMaybeSlide
    )
    return { success: true, result: { classification } }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return { success: false, error: message }
  }
}
