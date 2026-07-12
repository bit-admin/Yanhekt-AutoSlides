// Top-level orchestrator for the post-processing pipeline.
// Ported from autoslides/src/renderer/shared/postProcessing/pipeline.ts.
//
// Web changes: phase 3 (AI classification) is removed — AI filtering is not
// available in the web version, so `enableAIFiltering` is always false and
// `progress.phase3.skipped` stays true (kept for shape parity). Phases 1 + 2
// (duplicate + exclusion pHash) are unchanged.

import { runDuplicatePhase } from './phase1Duplicates'
import { runExclusionPhase } from './phase2Exclusion'
import { createPostProcessorWorker, createWorkerHelpers } from './workerHelpers'
import type {
  PipelineDataSource,
  PostProcessingContext,
  PostProcessingInput,
  PostProcessingProgress,
  PostProcessingResult,
  SlideHashInfo
} from './types'
import { createLogger } from '../logger';
const log = createLogger('PostProcessingPipeline');

function freshProgress(totalImages: number): PostProcessingProgress {
  return {
    phase: 'idle',
    phase1: { processed: 0, total: totalImages, duplicatesRemoved: 0, skipped: false },
    phase2: { processed: 0, total: totalImages, excludedRemoved: 0, skipped: false },
    phase3: {
      processed: 0,
      total: totalImages,
      batchesCompleted: 0,
      batchesTotal: 0,
      aiFiltered: 0,
      aiFilteredEdit: 0,
      failed: 0,
      retrying: 0,
      skipped: true
    }
  }
}

async function computeAllHashes(
  files: string[],
  dataSource: PipelineDataSource,
  calculatePHash: (img: ImageData) => Promise<string>,
  ctx: PostProcessingContext
): Promise<SlideHashInfo[]> {
  const hashes: SlideHashInfo[] = []
  for (const filename of files) {
    if (ctx.signal?.aborted) break
    try {
      const imageData = await dataSource.readForPHash(filename)
      if (!imageData) {
        hashes.push({ filename, pHash: '', error: 'Failed to read image' })
        continue
      }
      const pHash = await calculatePHash(imageData)
      hashes.push({ filename, pHash })
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      log.warn(`[PostProcessing] pHash failed for ${filename}: ${message}`)
      hashes.push({ filename, pHash: '', error: message })
    }
  }
  return hashes
}

export class PostProcessingPipeline {
  static async run(
    input: PostProcessingInput,
    dataSource: PipelineDataSource,
    ctx: PostProcessingContext = {}
  ): Promise<PostProcessingResult> {
    const progress = freshProgress(input.imageFiles.length)
    progress.phase1.skipped = !input.config.enableDuplicateRemoval
    progress.phase2.skipped = !input.config.enableExclusionList

    const emit = () => ctx.onProgress?.(progress)
    emit()

    const failed: PostProcessingResult['failed'] = []
    const removedDuplicates: string[] = []
    const removedExcluded: string[] = []
    const trashedSet = new Set<string>()

    const needsPHash = input.config.enableDuplicateRemoval || input.config.enableExclusionList
    let worker: ReturnType<typeof createPostProcessorWorker> | null = null

    try {
      let slideHashes: SlideHashInfo[] = []

      if (needsPHash) {
        worker = createPostProcessorWorker()
        const helpers = createWorkerHelpers(worker)
        slideHashes = await computeAllHashes(input.imageFiles, dataSource, helpers.calculatePHash, ctx)

        if (ctx.signal?.aborted) {
          return finalize('cancelled')
        }

        if (input.config.enableDuplicateRemoval) {
          progress.phase = 'phase1'
          emit()
          const phase1 = await runDuplicatePhase(
            slideHashes,
            input.config.pHashThreshold,
            helpers,
            dataSource,
            ctx,
            (processed, removed) => {
              progress.phase1.processed = processed
              progress.phase1.duplicatesRemoved = removed
              emit()
            }
          )
          for (const f of phase1.duplicatesRemoved) {
            removedDuplicates.push(f)
            trashedSet.add(f)
          }
        }

        if (ctx.signal?.aborted) {
          return finalize('cancelled')
        }

        if (input.config.enableExclusionList && input.config.exclusionList.length > 0) {
          progress.phase = 'phase2'
          emit()
          const phase2 = await runExclusionPhase(
            slideHashes,
            trashedSet,
            input.config.exclusionList,
            input.config.pHashThreshold,
            helpers,
            dataSource,
            ctx,
            (processed, removed) => {
              progress.phase2.processed = processed
              progress.phase2.excludedRemoved = removed
              emit()
            }
          )
          for (const f of phase2.excludedRemoved) {
            removedExcluded.push(f)
            trashedSet.add(f)
          }
        }

        worker.terminate()
        worker = null
      }

      return finalize(ctx.signal?.aborted ? 'cancelled' : 'completed')
    } catch (error) {
      log.error('[PostProcessing] Pipeline error:', error)
      const message = error instanceof Error ? error.message : String(error)
      failed.push({
        filename: '*',
        errorType: 'unknown',
        message,
        retryCount: 0
      })
      return finalize('failed')
    } finally {
      if (worker) {
        try {
          worker.terminate()
        } catch {
          // ignore
        }
      }
    }

    function finalize(status: PostProcessingResult['status']): PostProcessingResult {
      progress.phase = status
      emit()
      return {
        status,
        duplicatesRemoved: removedDuplicates,
        excludedRemoved: removedExcluded,
        aiNotSlide: [],
        aiMaybeSlideEdit: [],
        failed
      }
    }
  }
}
