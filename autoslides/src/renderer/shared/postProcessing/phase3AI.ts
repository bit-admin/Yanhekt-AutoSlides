// Phase 3 — AI classification with per-batch trash, transport-level retry, and
// 413 split-batch handling.
//
// KEY BEHAVIOR (changed from the old postProcessingService implementation):
// trash moves happen IMMEDIATELY after each batch resolves, not after the whole
// AI phase finishes. This means a stall in batch N no longer loses batches 1..N-1's
// classifications — they're already on disk in the trash.
//
// Retry policy preserved from the original code: transport already retried
// rate_limited / upstream_rate_limited / timeout under-the-hood, so the pipeline
// only retries genuine network/timeout one more time (maxRetries=2). 413 is
// handled via recursive split-batch.

import {
  classifyMultipleImages as dispatchClassifyMultiple,
  classifySingleImage as dispatchClassifySingle,
  type UnifiedClassificationResult
} from '@features/ai/slideClassificationService'
import { parseError, type ErrorInfo } from './errorModel'
import { trashReasonForAI, trashReasonDetailsForAI } from './trashWriter'
import type {
  PipelineDataSource,
  PostProcessingConfig,
  PostProcessingContext,
  PostProcessingFailure
} from './types'

type ClassificationValue = 'slide' | 'not_slide' | 'may_be_slide_edit'

const MAX_RETRIES = 2
const RETRY_DELAY_BASE_MS = 1000

const sleep = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms))

export interface AIPhaseInput {
  files: string[]
  config: PostProcessingConfig
  promptType: 'live' | 'recorded'
  token?: string
}

export interface AIPhaseResult {
  aiNotSlide: string[]
  aiMaybeSlideEdit: string[]
  failed: PostProcessingFailure[]
  // For UI mirrors that want to know what kept slides were classified as 'slide'
  // — emitted via ctx.onItemClassified during the run; not returned here.
}

interface AIPhaseStats {
  batchesCompleted: number
  batchesTotal: number
  processed: number
  retrying: number
}

interface BatchOutcome {
  notSlide: string[]
  maybeSlideEdit: string[]
  failed: PostProcessingFailure[]
  pending413: string[][] // batches whose payload was too large, queued for split
}

function emptyOutcome(): BatchOutcome {
  return { notSlide: [], maybeSlideEdit: [], failed: [], pending413: [] }
}

// Always returns a `{ image_0, image_1, ... }`-shaped result regardless of which
// underlying API was used. The single-image endpoint is used when the prompt
// variant expects a `{ classification }` response (live mode); the batch endpoint
// is used otherwise. This shields the rest of phase3AI from the dual-shape API.
async function dispatchClassification(
  base64s: string[],
  promptType: 'live' | 'recorded',
  token: string | undefined,
  useSingleImageWhenAlone: boolean
): Promise<UnifiedClassificationResult> {
  if (useSingleImageWhenAlone && base64s.length === 1) {
    const single = await dispatchClassifySingle(base64s[0], promptType, token)
    if (single.success && single.result) {
      return {
        success: true,
        result: { image_0: single.result.classification }
      }
    }
    return { success: false, error: single.error, errorKind: single.errorKind }
  }
  return dispatchClassifyMultiple(base64s, promptType, token)
}

async function readAndResizeImages(
  dataSource: PipelineDataSource,
  filenames: string[],
  targetWidth: number,
  targetHeight: number
): Promise<(string | null)[]> {
  const results: (string | null)[] = []
  for (const filename of filenames) {
    results.push(await dataSource.readForAI(filename, targetWidth, targetHeight))
  }
  return results
}

async function applyClassificationsToTrash(
  validFilenames: string[],
  classifications: Record<string, ClassificationValue>,
  dataSource: PipelineDataSource,
  ctx: PostProcessingContext
): Promise<{ notSlide: string[]; maybeSlideEdit: string[] }> {
  const notSlide: string[] = []
  const maybeSlideEdit: string[] = []
  for (let j = 0; j < validFilenames.length; j++) {
    const filename = validFilenames[j]
    const cls = classifications[`image_${j}`] || 'slide'
    ctx.onItemClassified?.(filename, cls)
    if (cls === 'slide') continue

    const reason = trashReasonForAI(cls)
    const moved = await dataSource.moveToTrash(filename, reason, trashReasonDetailsForAI(cls))
    if (moved) {
      ctx.onItemRemoved?.(filename, reason)
      if (cls === 'may_be_slide_edit') maybeSlideEdit.push(filename)
      else notSlide.push(filename)
    }
  }
  return { notSlide, maybeSlideEdit }
}

async function processBatchWithRetry(
  batch: string[],
  input: AIPhaseInput,
  dataSource: PipelineDataSource,
  ctx: PostProcessingContext,
  stats: AIPhaseStats,
  reportStats: () => void,
  retryCount = 0
): Promise<BatchOutcome> {
  const outcome = emptyOutcome()

  if (ctx.signal?.aborted) {
    return outcome
  }

  // Read & resize images. Failed reads count as failed-without-classification.
  const base64Images = await readAndResizeImages(
    dataSource,
    batch,
    input.config.aiImageResizeWidth,
    input.config.aiImageResizeHeight
  )
  const validFilenames: string[] = []
  const validBase64: string[] = []
  for (let i = 0; i < batch.length; i++) {
    if (base64Images[i]) {
      validFilenames.push(batch[i])
      validBase64.push(base64Images[i] as string)
    } else {
      outcome.failed.push({
        filename: batch[i],
        errorType: 'unknown',
        message: 'Failed to read image for AI',
        retryCount
      })
    }
  }
  if (validBase64.length === 0) return outcome

  stats.retrying = validFilenames.length
  reportStats()
  let result: UnifiedClassificationResult
  let errorInfo: ErrorInfo | null = null
  try {
    result = await dispatchClassification(
      validBase64,
      input.promptType,
      input.token,
      input.config.useSingleImageApi === true
    )
    if (!result.success || !result.result) {
      errorInfo = parseError(result)
    }
  } catch (thrown) {
    errorInfo = parseError(thrown)
    result = { success: false, error: errorInfo.message }
  } finally {
    stats.retrying = 0
    reportStats()
  }

  if (result.success && result.result) {
    const applied = await applyClassificationsToTrash(
      validFilenames,
      result.result as Record<string, ClassificationValue>,
      dataSource,
      ctx
    )
    outcome.notSlide.push(...applied.notSlide)
    outcome.maybeSlideEdit.push(...applied.maybeSlideEdit)
    return outcome
  }

  // Error path.
  if (errorInfo!.type === '413') {
    outcome.pending413.push(validFilenames)
    return outcome
  }
  if (errorInfo!.retryable && retryCount < MAX_RETRIES) {
    const delay = RETRY_DELAY_BASE_MS * (retryCount + 1)
    console.log(
      `[PostProcessing] AI batch ${errorInfo!.type} (attempt ${retryCount + 1}/${MAX_RETRIES}, delay ${delay}ms)`
    )
    stats.retrying = validFilenames.length
    reportStats()
    await sleep(delay)
    stats.retrying = 0
    reportStats()
    if (ctx.signal?.aborted) return outcome
    const retryOutcome = await processBatchWithRetry(
      validFilenames,
      input,
      dataSource,
      ctx,
      stats,
      reportStats,
      retryCount + 1
    )
    outcome.notSlide.push(...retryOutcome.notSlide)
    outcome.maybeSlideEdit.push(...retryOutcome.maybeSlideEdit)
    outcome.failed.push(...retryOutcome.failed)
    outcome.pending413.push(...retryOutcome.pending413)
    return outcome
  }

  console.warn(`[PostProcessing] AI batch failed with ${errorInfo!.type}: ${errorInfo!.message}`)
  for (const filename of validFilenames) {
    outcome.failed.push({
      filename,
      errorType: errorInfo!.type,
      errorKind: errorInfo!.kind,
      message: errorInfo!.message,
      retryCount
    })
  }
  return outcome
}

async function processPending413(
  batches: string[][],
  input: AIPhaseInput,
  dataSource: PipelineDataSource,
  ctx: PostProcessingContext,
  stats: AIPhaseStats,
  reportStats: () => void,
  originalBatchSize: number
): Promise<BatchOutcome> {
  const outcome = emptyOutcome()
  const minBatchSize = Math.max(1, originalBatchSize - 2)

  for (const batch of batches) {
    if (ctx.signal?.aborted) break
    const newSize = Math.ceil(batch.length / 2)

    if (newSize < minBatchSize || batch.length === 1) {
      // Process individually.
      for (const file of batch) {
        if (ctx.signal?.aborted) break
        const singleOutcome = await processBatchWithRetry([file], input, dataSource, ctx, stats, reportStats)
        if (singleOutcome.pending413.length > 0) {
          outcome.failed.push({
            filename: file,
            errorType: '413',
            message: 'Payload too large even for single image',
            retryCount: 0
          })
        } else {
          outcome.notSlide.push(...singleOutcome.notSlide)
          outcome.maybeSlideEdit.push(...singleOutcome.maybeSlideEdit)
          outcome.failed.push(...singleOutcome.failed)
        }
      }
      continue
    }

    const splitBatches: string[][] = []
    for (let i = 0; i < batch.length; i += newSize) {
      splitBatches.push(batch.slice(i, i + newSize))
    }
    console.log(
      `[PostProcessing] Splitting 413 batch of ${batch.length} into ${splitBatches.length} batches`
    )
    for (const sub of splitBatches) {
      if (ctx.signal?.aborted) break
      const subOutcome = await processBatchWithRetry(sub, input, dataSource, ctx, stats, reportStats)
      outcome.notSlide.push(...subOutcome.notSlide)
      outcome.maybeSlideEdit.push(...subOutcome.maybeSlideEdit)
      outcome.failed.push(...subOutcome.failed)
      if (subOutcome.pending413.length > 0) {
        const nested = await processPending413(
          subOutcome.pending413,
          input,
          dataSource,
          ctx,
          stats,
          reportStats,
          originalBatchSize
        )
        outcome.notSlide.push(...nested.notSlide)
        outcome.maybeSlideEdit.push(...nested.maybeSlideEdit)
        outcome.failed.push(...nested.failed)
      }
    }
  }

  return outcome
}

export async function runAIPhase(
  input: AIPhaseInput,
  dataSource: PipelineDataSource,
  ctx: PostProcessingContext,
  reportProgress: (stats: AIPhaseStats & { aiFiltered: number; aiFilteredEdit: number; failed: number }) => void
): Promise<AIPhaseResult> {
  const batchSize = Math.max(1, input.config.aiBatchSize)
  const batches: string[][] = []
  for (let i = 0; i < input.files.length; i += batchSize) {
    batches.push(input.files.slice(i, i + batchSize))
  }

  const stats: AIPhaseStats = {
    batchesCompleted: 0,
    batchesTotal: batches.length,
    processed: 0,
    retrying: 0
  }
  const final: AIPhaseResult = { aiNotSlide: [], aiMaybeSlideEdit: [], failed: [] }
  const pending413: string[][] = []

  const emit = () =>
    reportProgress({
      ...stats,
      aiFiltered: final.aiNotSlide.length,
      aiFilteredEdit: final.aiMaybeSlideEdit.length,
      failed: final.failed.length
    })

  emit()

  for (let i = 0; i < batches.length; i++) {
    if (ctx.signal?.aborted) break
    const batch = batches[i]
    const outcome = await processBatchWithRetry(batch, input, dataSource, ctx, stats, emit)
    final.aiNotSlide.push(...outcome.notSlide)
    final.aiMaybeSlideEdit.push(...outcome.maybeSlideEdit)
    final.failed.push(...outcome.failed)
    pending413.push(...outcome.pending413)
    stats.batchesCompleted = i + 1
    stats.processed = Math.min((i + 1) * batchSize, input.files.length)
    emit()
  }

  if (pending413.length > 0 && !ctx.signal?.aborted) {
    console.log(`[PostProcessing] Processing ${pending413.length} pending 413 batches`)
    const pending413Outcome = await processPending413(
      pending413,
      input,
      dataSource,
      ctx,
      stats,
      emit,
      batchSize
    )
    final.aiNotSlide.push(...pending413Outcome.notSlide)
    final.aiMaybeSlideEdit.push(...pending413Outcome.maybeSlideEdit)
    final.failed.push(...pending413Outcome.failed)
    emit()
  }

  return final
}
