// Top-level orchestrator for the unified post-processing pipeline.
//
// Wires the three phase modules together, owns the post-processor worker for
// phases 1 + 2, emits progress, and produces a single result envelope. Every
// consumer (task-queue job runner, playback-page composable, offline tab
// composable) calls `PostProcessingPipeline.run` instead of re-implementing the
// 3-phase loop.

import { runDuplicatePhase } from './phase1Duplicates'
import { runExclusionPhase } from './phase2Exclusion'
import { runAIPhase } from './phase3AI'
import { createPostProcessorWorker, createWorkerHelpers } from './workerHelpers'
import type {
  PipelineDataSource,
  PostProcessingContext,
  PostProcessingInput,
  PostProcessingProgress,
  PostProcessingResult,
  SlideHashInfo
} from './types'

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
      skipped: false
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
      console.warn(`[PostProcessing] pHash failed for ${filename}: ${message}`)
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
    progress.phase3.skipped = !input.config.enableAIFiltering

    const emit = () => ctx.onProgress?.(progress)
    emit()

    const failed: PostProcessingResult['failed'] = []
    const removedDuplicates: string[] = []
    const removedExcluded: string[] = []
    const removedAINotSlide: string[] = []
    const removedAIMaybeSlideEdit: string[] = []
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

      if (ctx.signal?.aborted) {
        return finalize('cancelled')
      }

      if (input.config.enableAIFiltering) {
        progress.phase = 'phase3'
        emit()
        const remainingFiles = input.imageFiles.filter(f => !trashedSet.has(f))
        progress.phase3.total = remainingFiles.length

        const phase3 = await runAIPhase(
          {
            files: remainingFiles,
            config: input.config,
            promptType: input.promptType,
            token: input.token
          },
          dataSource,
          ctx,
          (stats) => {
            progress.phase3.processed = stats.processed
            progress.phase3.batchesCompleted = stats.batchesCompleted
            progress.phase3.batchesTotal = stats.batchesTotal
            progress.phase3.aiFiltered = stats.aiFiltered
            progress.phase3.aiFilteredEdit = stats.aiFilteredEdit
            progress.phase3.failed = stats.failed
            progress.phase3.retrying = stats.retrying
            emit()
          }
        )
        removedAINotSlide.push(...phase3.aiNotSlide)
        removedAIMaybeSlideEdit.push(...phase3.aiMaybeSlideEdit)
        failed.push(...phase3.failed)
      }

      return finalize(ctx.signal?.aborted ? 'cancelled' : 'completed')
    } catch (error) {
      console.error('[PostProcessing] Pipeline error:', error)
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
        aiNotSlide: removedAINotSlide,
        aiMaybeSlideEdit: removedAIMaybeSlideEdit,
        failed
      }
    }
  }
}
