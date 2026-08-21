import { computed, onUnmounted, reactive, ref } from 'vue'

import {
  composeDetectionPreview,
  createAutoCropWorkerClient,
} from '@shared/autoCrop'
import { applyMlDecision, classifyImage } from '@shared/mlClassifier'
import type { ClassificationValue } from '@shared/postProcessing/types'
import { slideProcessorService } from '@shared/processing/workerHelpers'
import { tokenManager } from '@shared/services/authService'
import { configStore } from '@shared/services/configStore'
import { bytesToImageBitmap, imageBitmapToImageData } from '@shared/utils/imageDecode'
import { createLogger } from '@shared/utils/logger'
import { createPHashWorkerClient } from '@shared/workers/pHashWorkerClient'
import type { DetectResult, DetectorMode } from '@shared/workers/autoCrop.worker'
import type { ClassifierClass } from '@shared/workers/slideClassifier.worker'

const log = createLogger('DeveloperLab')

const DEFAULT_ML_THRESHOLDS = { trustLow: 0.75, trustHigh: 0.9, slideCheckLow: 0.25 }

export type ImageMode = 'one' | 'two'
export type SlotId = 'a' | 'b'

export interface LabSlotView {
  path: string | null
  name: string | null
  objectUrl: string | null
}

export interface AutoCropLabResult {
  backend: DetectResult['backend']
  durationMs: number
  bbox: DetectResult['bbox']
  candidates: number
  hasEdges: boolean
  mode: DetectorMode
}

export interface LlmLabResult {
  classification: ClassificationValue
  modelUsed?: string
  durationMs: number
}

export interface MlLabResult {
  decision: ClassificationValue
  predictedClass: ClassifierClass
  confidence: number
  probabilities: Record<ClassifierClass, number>
  thresholds: { trustLow: number; trustHigh: number; slideCheckLow: number }
  distinguishMaybeSlide: boolean
  durationMs: number
}

export interface SsimLabResult {
  score: number
  threshold: number
  downsample: { width: number; height: number } | null
  same: boolean
  durationMs: number
}

export interface PhashLabResult {
  hashA: string
  hashB: string
  distance: number
  threshold: number
  duplicate: boolean
  durationMs: number
}

interface SectionState<T> {
  running: boolean
  error: string | null
  result: T | null
  runId: number
}

function emptySection<T>(): SectionState<T> {
  return { running: false, error: null, result: null, runId: 0 }
}

function basename(p: string): string {
  return p.replace(/\\/g, '/').split('/').pop() ?? p
}

function mimeFromPath(p: string): string {
  const ext = p.split('.').pop()?.toLowerCase()
  switch (ext) {
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg'
    case 'png':
      return 'image/png'
    case 'webp':
      return 'image/webp'
    case 'bmp':
      return 'image/bmp'
    case 'tif':
    case 'tiff':
      return 'image/tiff'
    default:
      return 'image/*'
  }
}

function copyBytes(bytes: Uint8Array): ArrayBuffer {
  const copy = new ArrayBuffer(bytes.byteLength)
  new Uint8Array(copy).set(bytes)
  return copy
}

function makeObjectUrl(bytes: Uint8Array, mime: string): string {
  return URL.createObjectURL(new Blob([copyBytes(bytes)], { type: mime }))
}

function bufferToDataUrl(bytes: Uint8Array, mime: string): Promise<string> {
  const blob = new Blob([copyBytes(bytes)], { type: mime })
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error ?? new Error('Failed to encode image'))
    reader.readAsDataURL(blob)
  })
}

function errMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}

export function useDeveloperLab() {
  const imageMode = ref<ImageMode>('one')
  const slotA = reactive<LabSlotView>({ path: null, name: null, objectUrl: null })
  const slotB = reactive<LabSlotView>({ path: null, name: null, objectUrl: null })
  const overlayUrl = ref<string | null>(null)
  const loadError = ref<string | null>(null)

  const canny = reactive(emptySection<AutoCropLabResult>())
  const yolo = reactive(emptySection<AutoCropLabResult>())
  const llm = reactive(emptySection<LlmLabResult>())
  const ml = reactive(emptySection<MlLabResult>())
  const ssim = reactive(emptySection<SsimLabResult>())
  const phash = reactive(emptySection<PhashLabResult>())

  // Native buffers/ImageData must stay off the reactive tree (workers + Recurring #1).
  const pixels: Record<SlotId, { bytes: Uint8Array | null; imageData: ImageData | null }> = {
    a: { bytes: null, imageData: null },
    b: { bytes: null, imageData: null },
  }

  const autoCropClient = createAutoCropWorkerClient()
  const pHashClient = createPHashWorkerClient()

  const hasA = computed(() => Boolean(slotA.path && pixels.a.imageData))
  const hasB = computed(() => Boolean(slotB.path && pixels.b.imageData))
  const hasBoth = computed(() => hasA.value && hasB.value)

  const slotAPreview = computed(() => overlayUrl.value || slotA.objectUrl)
  const slotBPreview = computed(() => slotB.objectUrl)

  const viewOf = (id: SlotId): LabSlotView => (id === 'a' ? slotA : slotB)

  const revoke = (url: string | null) => {
    if (url) URL.revokeObjectURL(url)
  }

  const resetSection = <T>(section: SectionState<T>) => {
    section.running = false
    section.error = null
    section.result = null
  }

  const clearOverlay = () => {
    overlayUrl.value = null
  }

  const clearSlot = (id: SlotId) => {
    const view = viewOf(id)
    revoke(view.objectUrl)
    view.path = null
    view.name = null
    view.objectUrl = null
    pixels[id].bytes = null
    pixels[id].imageData = null
    if (id === 'a') {
      clearOverlay()
      resetSection(canny)
      resetSection(yolo)
      resetSection(llm)
      resetSection(ml)
    }
    resetSection(ssim)
    resetSection(phash)
  }

  const setMode = (mode: ImageMode) => {
    if (imageMode.value === mode) return
    imageMode.value = mode
    if (mode === 'one') clearSlot('b')
  }

  const pickSlot = async (id: SlotId): Promise<void> => {
    const path = await window.electronAPI.dialog?.openImageFile?.()
    if (!path) return

    loadError.value = null
    try {
      const buffer = await window.electronAPI.slideExtraction.readImageBuffer(path)
      const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer)
      const imageData = await decodeFromBytes(bytes)
      const mime = mimeFromPath(path)
      const objectUrl = makeObjectUrl(bytes, mime)

      const view = viewOf(id)
      revoke(view.objectUrl)
      pixels[id].bytes = bytes
      pixels[id].imageData = imageData
      view.path = path
      view.name = basename(path)
      view.objectUrl = objectUrl

      if (id === 'a') {
        clearOverlay()
        resetSection(canny)
        resetSection(yolo)
        resetSection(llm)
        resetSection(ml)
      }
      resetSection(ssim)
      resetSection(phash)
    } catch (err) {
      log.error('Failed to load lab image:', err)
      loadError.value = errMessage(err)
    }
  }

  async function decodeFromBytes(bytes: Uint8Array): Promise<ImageData> {
    const bitmap = await bytesToImageBitmap(bytes)
    try {
      return imageBitmapToImageData(bitmap)
    } finally {
      bitmap.close()
    }
  }

  const runAutoCrop = async (
    mode: 'canny_only' | 'yolo_only',
    section: SectionState<AutoCropLabResult>,
  ) => {
    const imageData = pixels.a.imageData
    const bytes = pixels.a.bytes
    if (!imageData || !bytes || section.running) return

    section.running = true
    section.error = null
    const started = performance.now()

    let bitmap: ImageBitmap | null = null
    try {
      const slideCfg = configStore.slideExtraction
      bitmap = await bytesToImageBitmap(bytes)
      const response = await autoCropClient.detectBbox(imageData, true, {
        mode,
        canny: slideCfg?.autoCrop,
        yolo: slideCfg?.autoCropYolo,
      })
      if (!response.success || !response.result) {
        throw new Error(response.error || 'Detection failed')
      }
      const result = response.result
      overlayUrl.value = await composeDetectionPreview(bitmap, result)
      section.result = {
        backend: result.backend,
        durationMs: result.durationMs || performance.now() - started,
        bbox: result.bbox,
        candidates: result.candidates.length,
        hasEdges: Boolean(result.edgesPng),
        mode,
      }
      section.runId += 1
    } catch (err) {
      log.error('Auto crop test failed:', err)
      section.error = errMessage(err)
      section.result = null
    } finally {
      bitmap?.close()
      section.running = false
    }
  }

  const testCanny = () => runAutoCrop('canny_only', canny)
  const testYolo = () => runAutoCrop('yolo_only', yolo)

  const testLlm = async () => {
    const bytes = pixels.a.bytes
    const path = slotA.path
    if (!bytes || !path || llm.running) return

    llm.running = true
    llm.error = null
    const started = performance.now()
    try {
      const dataUrl = await bufferToDataUrl(bytes, mimeFromPath(path))
      const token = tokenManager.getToken() || undefined
      const response = await window.electronAPI.ai.classifySingleImage(dataUrl, token)
      if (!response.success || !response.result || !('classification' in response.result)) {
        throw new Error(response.error || 'Classification failed')
      }
      llm.result = {
        classification: response.result.classification,
        modelUsed: response.modelUsed,
        durationMs: performance.now() - started,
      }
      llm.runId += 1
    } catch (err) {
      log.error('LLM test failed:', err)
      llm.error = errMessage(err)
      llm.result = null
    } finally {
      llm.running = false
    }
  }

  const testMl = async () => {
    const imageData = pixels.a.imageData
    if (!imageData || ml.running) return

    ml.running = true
    ml.error = null
    const started = performance.now()
    try {
      const raw = await classifyImage(imageData)
      const thresholds = {
        ...DEFAULT_ML_THRESHOLDS,
        ...(configStore.aiFiltering?.mlThresholds ?? {}),
      }
      const distinguishMaybeSlide = configStore.distinguishMaybeSlide !== false
      const decision = applyMlDecision(
        raw.probabilities,
        raw.predictedClass,
        raw.confidence,
        thresholds,
        distinguishMaybeSlide,
      )
      ml.result = {
        decision,
        predictedClass: raw.predictedClass,
        confidence: raw.confidence,
        probabilities: raw.probabilities,
        thresholds,
        distinguishMaybeSlide,
        durationMs: raw.durationMs || performance.now() - started,
      }
      ml.runId += 1
    } catch (err) {
      log.error('ML test failed:', err)
      ml.error = errMessage(err)
      ml.result = null
    } finally {
      ml.running = false
    }
  }

  const testSsim = async () => {
    const a = pixels.a.imageData
    const b = pixels.b.imageData
    if (!a || !b || ssim.running) return

    ssim.running = true
    ssim.error = null
    const started = performance.now()
    try {
      const slideCfg = configStore.slideExtraction
      const enableDownsampling = slideCfg?.enableDownsampling !== false
      const downsampleWidth = slideCfg?.downsampleWidth ?? 480
      const downsampleHeight = slideCfg?.downsampleHeight ?? 270
      const threshold = slideCfg?.ssimThreshold ?? 0.9987
      const config = JSON.parse(JSON.stringify({
        ssimThreshold: threshold,
        enableDownsampling,
        downsampleWidth,
        downsampleHeight,
      }))
      const score = await slideProcessorService.calculateSSIM(a, b, config)
      ssim.result = {
        score,
        threshold,
        downsample: enableDownsampling ? { width: downsampleWidth, height: downsampleHeight } : null,
        same: score >= threshold,
        durationMs: performance.now() - started,
      }
      ssim.runId += 1
    } catch (err) {
      log.error('SSIM test failed:', err)
      ssim.error = errMessage(err)
      ssim.result = null
    } finally {
      ssim.running = false
    }
  }

  const testPhash = async () => {
    const a = pixels.a.imageData
    const b = pixels.b.imageData
    if (!a || !b || phash.running) return

    phash.running = true
    phash.error = null
    const started = performance.now()
    try {
      const [hashA, hashB] = await Promise.all([
        pHashClient.calculatePHash(a),
        pHashClient.calculatePHash(b),
      ])
      const distance = await pHashClient.calculateHammingDistance(hashA, hashB)
      const threshold = configStore.slideExtraction?.pHashThreshold ?? 10
      phash.result = {
        hashA,
        hashB,
        distance,
        threshold,
        duplicate: distance <= threshold,
        durationMs: performance.now() - started,
      }
      phash.runId += 1
    } catch (err) {
      log.error('pHash test failed:', err)
      phash.error = errMessage(err)
      phash.result = null
    } finally {
      phash.running = false
    }
  }

  onUnmounted(() => {
    revoke(slotA.objectUrl)
    revoke(slotB.objectUrl)
    autoCropClient.destroy()
    pHashClient.destroy()
  })

  return {
    imageMode,
    slotA,
    slotB,
    slotAPreview,
    slotBPreview,
    overlayUrl,
    loadError,
    hasA,
    hasB,
    hasBoth,
    canny,
    yolo,
    llm,
    ml,
    ssim,
    phash,
    setMode,
    pickSlot,
    clearSlot,
    testCanny,
    testYolo,
    testLlm,
    testMl,
    testSsim,
    testPhash,
  }
}

export type UseDeveloperLab = ReturnType<typeof useDeveloperLab>
