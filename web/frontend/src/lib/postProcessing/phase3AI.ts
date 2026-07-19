// Phase 3 — AI classification with per-file trash and pipeline-level retry.
// Ported from autoslides/src/renderer/shared/postProcessing/phase3AI.ts,
// simplified for the web: always single-image (the desktop's batch dispatch
// and 413 split-batch machinery have no equivalent here).
//
// Trash moves happen IMMEDIATELY after each file's verdict resolves, so a
// stall on file N never loses files 1..N-1's classifications. Retry policy
// kept from desktop: the transport already retried 429/502 internally, so this
// layer only re-tries genuine network/timeout failures (MAX_RETRIES=2).

import { parseError, type ErrorInfo } from './errorModel'
import type {
  ClassificationValue,
  PipelineDataSource,
  PostProcessingConfig,
  PostProcessingContext,
  PostProcessingFailure,
  SingleClassificationResult,
  TrashReason
} from './types'
import { createLogger } from '../logger'

const log = createLogger('Phase3AI')

const MAX_RETRIES = 2
const RETRY_DELAY_BASE_MS = 1000

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

export interface AIPhaseInput {
  files: string[]
  config: PostProcessingConfig
  token?: string
}

export interface AIPhaseResult {
  aiNotSlide: string[]
  aiMaybeSlideEdit: string[]
  failed: PostProcessingFailure[]
}

export interface AIPhaseStats {
  processed: number
  total: number
  batchesCompleted: number
  batchesTotal: number
  aiFiltered: number
  aiFilteredEdit: number
  failed: number
  retrying: number
}

export function trashReasonForAI(classification: 'not_slide' | 'may_be_slide_edit'): TrashReason {
  return classification === 'may_be_slide_edit' ? 'ai_filtered_edit' : 'ai_filtered'
}

export function trashReasonDetailsForAI(classification: 'not_slide' | 'may_be_slide_edit'): string {
  return classification === 'may_be_slide_edit'
    ? 'AI classified as may_be_slide_edit'
    : 'AI classified as not_slide'
}

interface FileOutcome {
  classification?: ClassificationValue
  failure?: PostProcessingFailure
}

async function classifyWithRetry(
  base64: string,
  input: AIPhaseInput,
  ctx: PostProcessingContext,
  setRetrying: (retrying: boolean) => void,
  retryCount = 0
): Promise<{ result?: SingleClassificationResult; error?: ErrorInfo; retryCount: number }> {
  if (!ctx.classifier) {
    throw new Error('phase3AI requires ctx.classifier to be injected by the caller')
  }

  let result: SingleClassificationResult
  let errorInfo: ErrorInfo | null = null
  try {
    result = await ctx.classifier.classifySingleImage(base64, input.token)
    if (!result.success || !result.result) {
      errorInfo = parseError(result)
    }
  } catch (thrown) {
    errorInfo = parseError(thrown)
    result = { success: false, error: errorInfo.message }
  }

  if (result.success && result.result) {
    return { result, retryCount }
  }

  const err = errorInfo ?? parseError(result)
  if (err.retryable && retryCount < MAX_RETRIES && !ctx.signal?.aborted) {
    const delay = RETRY_DELAY_BASE_MS * (retryCount + 1)
    log.debug(`AI request ${err.type} (attempt ${retryCount + 1}/${MAX_RETRIES}, delay ${delay}ms)`)
    setRetrying(true)
    await sleep(delay)
    setRetrying(false)
    if (ctx.signal?.aborted) return { error: err, retryCount }
    return classifyWithRetry(base64, input, ctx, setRetrying, retryCount + 1)
  }
  return { error: err, retryCount }
}

async function processFile(
  filename: string,
  input: AIPhaseInput,
  dataSource: PipelineDataSource,
  ctx: PostProcessingContext,
  setRetrying: (retrying: boolean) => void
): Promise<FileOutcome> {
  const base64 = await dataSource.readForAI(
    filename,
    input.config.aiImageResizeWidth,
    input.config.aiImageResizeHeight
  )
  if (!base64) {
    return {
      failure: { filename, errorType: 'unknown', message: 'Failed to read image for AI', retryCount: 0 }
    }
  }

  const { result, error, retryCount } = await classifyWithRetry(base64, input, ctx, setRetrying)
  if (result?.result) {
    return { classification: result.result.classification }
  }
  const err = error ?? parseError(result ?? 'Unknown error')
  log.warn(`AI classification failed for ${filename} with ${err.type}: ${err.message}`)
  return {
    failure: { filename, errorType: err.type, errorKind: err.kind, message: err.message, retryCount }
  }
}

export async function runAIPhase(
  input: AIPhaseInput,
  dataSource: PipelineDataSource,
  ctx: PostProcessingContext,
  reportProgress: (stats: AIPhaseStats) => void
): Promise<AIPhaseResult> {
  const final: AIPhaseResult = { aiNotSlide: [], aiMaybeSlideEdit: [], failed: [] }
  const stats: AIPhaseStats = {
    processed: 0,
    total: input.files.length,
    // Single-image requests: one "batch" per file, keeps the desktop-shaped
    // progress envelope meaningful for the UI.
    batchesCompleted: 0,
    batchesTotal: input.files.length,
    aiFiltered: 0,
    aiFilteredEdit: 0,
    failed: 0,
    retrying: 0
  }
  const emit = () => reportProgress({ ...stats })
  emit()

  for (const filename of input.files) {
    if (ctx.signal?.aborted) break

    const outcome = await processFile(filename, input, dataSource, ctx, (retrying) => {
      stats.retrying = retrying ? 1 : 0
      emit()
    })
    stats.retrying = 0

    if (outcome.classification) {
      const cls = outcome.classification
      ctx.onItemClassified?.(filename, cls)
      if (cls !== 'slide') {
        const reason = trashReasonForAI(cls)
        const moved = await dataSource.moveToTrash(filename, reason, trashReasonDetailsForAI(cls))
        if (moved) {
          ctx.onItemRemoved?.(filename, reason)
          if (cls === 'may_be_slide_edit') {
            final.aiMaybeSlideEdit.push(filename)
            stats.aiFilteredEdit += 1
          } else {
            final.aiNotSlide.push(filename)
            stats.aiFiltered += 1
          }
        }
      }
    } else if (outcome.failure) {
      final.failed.push(outcome.failure)
      stats.failed += 1
    }

    stats.processed += 1
    stats.batchesCompleted = stats.processed
    emit()
  }

  return final
}
