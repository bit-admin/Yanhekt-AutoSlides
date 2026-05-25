import { ref, type Ref, type ShallowRef } from 'vue'
import { TokenManager } from '../services/authService'
import type { ExtractedSlide, SlideExtractor } from '../services/slideExtractor'
import { PostProcessingPipeline } from '../postProcessing/pipeline'
import { createSlideExtractionDataSource } from '../postProcessing/imageSources'
import {
  errorInfoToBanner,
  parseBannerError,
  type BannerError,
  type ErrorType
} from '../postProcessing/errorModel'
import type {
  PostProcessingConfig,
  PostProcessingFailure,
  PostProcessingProgress,
  TrashReason
} from '../postProcessing/types'

// Playback-page manual post-processing. Adapter over the unified pipeline at
// renderer/postProcessing — owns the in-memory `extractedSlides` array mirror,
// the AI-error banner, and the auto-trigger / pending-AI-phase queueing quirk.

// Re-export under the old name so existing imports (PlaybackPage.vue) don't break.
export type AIFilteringError = BannerError

export interface PostProcessStatus {
  isProcessing: boolean
  currentPhase: 'idle' | 'phase1' | 'phase2' | 'phase3' | 'completed'
  currentIndex: number
  totalCount: number
  duplicatesRemoved: number
  excludedRemoved: number
  aiFiltered: number
  phase1Skipped: boolean
  phase2Skipped: boolean
  phase3Skipped: boolean
  // AI progress tracking for the 3-color progress bar that PlaybackPage renders.
  aiCompleted: number    // slides with aiDecision set
  aiInProgress: number   // current batch size being processed
  aiTotal: number        // total extracted slides (denominator)
}

export interface UsePostProcessingOptions {
  mode: 'live' | 'recorded'
  extractedSlides: Ref<ExtractedSlide[]>
  slideExtractorInstance: ShallowRef<SlideExtractor | null>
  deleteSlide?: (slide: ExtractedSlide, showConfirmation?: boolean) => Promise<void>  // Deprecated; kept for back-compat
}

export interface UsePostProcessingReturn {
  isPostProcessing: Ref<boolean>
  postProcessStatus: Ref<PostProcessStatus>
  aiFilteringError: Ref<AIFilteringError>
  enableAIFiltering: Ref<boolean>
  autoPostProcessing: Ref<boolean>
  autoPostProcessingLive: Ref<boolean>
  aiBatchSize: Ref<number>

  executePostProcessing: (showResultDialog?: boolean) => Promise<void>
  parseAIError: (error: unknown) => AIFilteringError
  dismissAIError: () => void
  initConfig: () => Promise<void>
}

export function usePostProcessing(options: UsePostProcessingOptions): UsePostProcessingReturn {
  const { mode, extractedSlides, slideExtractorInstance } = options
  const tokenManager = new TokenManager()

  const isPostProcessing = ref(false)
  // When true, an auto-trigger arrived while a run was in progress — the AI phase
  // re-runs once after the current run finishes to catch any newly-extracted slides.
  const pendingAIPhase = ref(false)
  const postProcessStatus = ref<PostProcessStatus>(freshStatus(0))
  const aiFilteringError = ref<AIFilteringError>({ type: 'none' })
  const enableAIFiltering = ref(true)
  const autoPostProcessing = ref(true)
  const autoPostProcessingLive = ref(true)
  const aiBatchSize = ref(4)
  const aiImageResizeWidth = ref(768)
  const aiImageResizeHeight = ref(432)

  function freshStatus(total: number): PostProcessStatus {
    return {
      isProcessing: false,
      currentPhase: 'idle',
      currentIndex: 0,
      totalCount: total,
      duplicatesRemoved: 0,
      excludedRemoved: 0,
      aiFiltered: 0,
      phase1Skipped: false,
      phase2Skipped: false,
      phase3Skipped: false,
      aiCompleted: 0,
      aiInProgress: 0,
      aiTotal: total
    }
  }

  const mirrorProgress = (snap: PostProcessingProgress) => {
    postProcessStatus.value.phase1Skipped = snap.phase1.skipped
    postProcessStatus.value.phase2Skipped = snap.phase2.skipped
    postProcessStatus.value.phase3Skipped = snap.phase3.skipped

    switch (snap.phase) {
      case 'phase1':
        postProcessStatus.value.currentPhase = 'phase1'
        postProcessStatus.value.currentIndex = snap.phase1.processed
        postProcessStatus.value.totalCount = snap.phase1.total
        break
      case 'phase2':
        postProcessStatus.value.currentPhase = 'phase2'
        postProcessStatus.value.currentIndex = snap.phase2.processed
        postProcessStatus.value.totalCount = snap.phase2.total
        break
      case 'phase3':
        postProcessStatus.value.currentPhase = 'phase3'
        postProcessStatus.value.currentIndex = snap.phase3.processed
        postProcessStatus.value.totalCount = snap.phase3.total
        postProcessStatus.value.aiInProgress = snap.phase3.retrying
        // Update aiTotal in case slides were added during processing.
        postProcessStatus.value.aiTotal = extractedSlides.value.length
        postProcessStatus.value.aiCompleted = extractedSlides.value.filter(
          slide => slide.aiDecision !== null && slide.aiDecision !== undefined
        ).length
        break
      case 'completed':
      case 'cancelled':
      case 'failed':
        postProcessStatus.value.currentPhase = 'completed'
        postProcessStatus.value.aiInProgress = 0
        break
      default:
        break
    }
  }

  const failureToBannerError = (failure: PostProcessingFailure): AIFilteringError => {
    if (failure.errorKind) {
      return parseBannerError({
        success: false,
        error: failure.message,
        errorKind: failure.errorKind
      })
    }
    return errorInfoToBanner({
      type: failure.errorType as ErrorType,
      message: failure.message,
      retryable: false
    })
  }

  // Build the PostProcessingConfig used by the pipeline. `aiOnly=true` disables
  // the pHash phases — used for the re-run pass when pendingAIPhase was set.
  const buildConfig = async (aiOnly: boolean): Promise<PostProcessingConfig> => {
    const slideConfig = await window.electronAPI.config?.getSlideExtractionConfig?.()
    if (!slideConfig) throw new Error('Failed to get slide extraction configuration')

    const enableAI = await window.electronAPI.config?.getEnableAIFiltering?.() ?? true
    const aiConfig = await window.electronAPI.config?.getAIFilteringConfig?.()
    const exclusionList = (slideConfig.pHashExclusionList || []).filter(
      (item: { isPreset?: boolean; isEnabled?: boolean }) =>
        !item.isPreset || item.isEnabled !== false
    )

    // Live mode uses single-image AI (batchSize=1) so each slide gets a snappy
    // verdict; the live prompt variant expects `{ classification: ... }` so we
    // also flip useSingleImageApi to dispatch via classifySingleImage.
    const effectiveBatchSize = mode === 'live' ? 1 : (aiConfig?.batchSize || 5)
    const useSingleImageApi = mode === 'live'

    return {
      pHashThreshold: slideConfig.pHashThreshold || 10,
      enableDuplicateRemoval: !aiOnly && slideConfig.enableDuplicateRemoval !== false,
      enableExclusionList: !aiOnly && slideConfig.enableExclusionList !== false,
      enableAIFiltering: enableAI,
      exclusionList,
      aiBatchSize: effectiveBatchSize,
      aiImageResizeWidth: aiConfig?.imageResizeWidth || aiImageResizeWidth.value,
      aiImageResizeHeight: aiConfig?.imageResizeHeight || aiImageResizeHeight.value,
      useSingleImageApi
    }
  }

  // Single pass of the pipeline against the current `extractedSlides` set.
  // Callbacks splice removed items out of the reactive array and record AI
  // verdicts on the remaining slides.
  const runOnePass = async (aiOnly: boolean): Promise<void> => {
    const outputPath = slideExtractorInstance.value?.getOutputPath()
    if (!outputPath) throw new Error('Output path not found')

    // Pipeline operates on filenames; map slide.title → filename.
    const filenameToSlide = new Map<string, ExtractedSlide>()
    const imageFiles: string[] = []
    for (const slide of extractedSlides.value) {
      const filename = `${slide.title}.png`
      filenameToSlide.set(filename, slide)
      // For AI-only passes, skip slides that already have a decision.
      if (aiOnly && slide.aiDecision !== null && slide.aiDecision !== undefined) continue
      imageFiles.push(filename)
    }
    if (imageFiles.length === 0) return

    const config = await buildConfig(aiOnly)
    const dataSource = createSlideExtractionDataSource(outputPath)
    const token = tokenManager.getToken() || undefined

    const result = await PostProcessingPipeline.run(
      {
        outputPath,
        imageFiles,
        config,
        promptType: mode,
        token
      },
      dataSource,
      {
        onProgress: mirrorProgress,
        onItemRemoved: (filename: string, reason: TrashReason) => {
          const slide = filenameToSlide.get(filename)
          if (!slide) return
          // Splice from the reactive array so the UI updates immediately.
          const idx = extractedSlides.value.findIndex(s => s.id === slide.id)
          if (idx !== -1) extractedSlides.value.splice(idx, 1)
          if (reason === 'duplicate') postProcessStatus.value.duplicatesRemoved++
          else if (reason === 'exclusion') postProcessStatus.value.excludedRemoved++
          else if (reason === 'ai_filtered' || reason === 'ai_filtered_edit') {
            postProcessStatus.value.aiFiltered++
          }
        },
        onItemClassified: (filename, classification) => {
          const slide = filenameToSlide.get(filename)
          if (slide) slide.aiDecision = classification
        }
      }
    )

    // Surface the most recent AI failure in the banner, preferring structured
    // errorKind/errorType metadata over message-only parsing.
    if (result.failed.length > 0) {
      aiFilteringError.value = failureToBannerError(result.failed[0])
    } else {
      aiFilteringError.value = { type: 'none' }
    }
  }

  const executePostProcessing = async (showResultDialog = true): Promise<void> => {
    try {
      if (extractedSlides.value.length === 0) return

      // Auto-triggered calls in live mode honor the live-specific toggle.
      if (!showResultDialog && mode === 'live') {
        const liveAutoEnabled = await window.electronAPI.config.getAutoPostProcessingLive()
        if (!liveAutoEnabled) {
          console.log('Auto post-processing for live is disabled, skipping')
          return
        }
      }

      // Concurrent-trigger handling: manual call while running is ignored; auto
      // call while running queues a pendingAIPhase re-run.
      if (isPostProcessing.value) {
        if (showResultDialog) {
          console.log('Post-processing already in progress, ignoring manual trigger')
          return
        }
        console.log('Post-processing already in progress, queuing AI phase')
        pendingAIPhase.value = true
        return
      }

      isPostProcessing.value = true
      pendingAIPhase.value = false
      postProcessStatus.value = freshStatus(extractedSlides.value.length)
      postProcessStatus.value.isProcessing = true

      console.log(`Starting post-processing for ${extractedSlides.value.length} slides...`)

      // First pass: full 3-phase pipeline.
      await runOnePass(false)

      // Re-runs: AI-only passes for any pendingAIPhase requests that arrived
      // mid-flight. Each re-run picks up slides extracted since the last pass.
      while (pendingAIPhase.value) {
        pendingAIPhase.value = false
        console.log('Processing pending AI phase request...')
        await runOnePass(true)
      }

      postProcessStatus.value.currentPhase = 'completed'
      postProcessStatus.value.isProcessing = false

      const stats = {
        total: extractedSlides.value.length,
        duplicates: postProcessStatus.value.duplicatesRemoved,
        excluded: postProcessStatus.value.excludedRemoved,
        aiFiltered: postProcessStatus.value.aiFiltered
      }
      console.log('Post-processing completed:', stats)

      if (showResultDialog) {
        await window.electronAPI.dialog?.showMessageBox?.({
          type: 'info',
          title: 'Post-processing Completed',
          message: 'Post-processing completed successfully!',
          detail: `Duplicates removed: ${stats.duplicates}\nExcluded: ${stats.excluded}\nAI filtered: ${stats.aiFiltered}`
        })
      }
    } catch (error) {
      console.error('Failed to execute post-processing:', error)
      postProcessStatus.value.isProcessing = false
      postProcessStatus.value.currentPhase = 'idle'
      const errorMessage = error instanceof Error ? error.message : String(error)
      await window.electronAPI.dialog?.showErrorBox?.(
        'Post-processing Failed',
        `Failed to execute post-processing: ${errorMessage}`
      )
    } finally {
      isPostProcessing.value = false
      pendingAIPhase.value = false
    }
  }

  const parseAIError = (error: unknown): AIFilteringError => parseBannerError(error)

  const dismissAIError = () => {
    aiFilteringError.value = { type: 'none' }
  }

  const initConfig = async (): Promise<void> => {
    try {
      const config = await window.electronAPI.config.get()
      autoPostProcessing.value = config.autoPostProcessing !== undefined ? config.autoPostProcessing : true
      autoPostProcessingLive.value = config.autoPostProcessingLive !== undefined ? config.autoPostProcessingLive : true
      enableAIFiltering.value = config.enableAIFiltering !== undefined ? config.enableAIFiltering : true

      const aiConfig = await window.electronAPI.config?.getAIFilteringConfig?.()
      if (aiConfig) {
        aiBatchSize.value = aiConfig.batchSize || 5
        aiImageResizeWidth.value = aiConfig.imageResizeWidth || 768
        aiImageResizeHeight.value = aiConfig.imageResizeHeight || 432
      }
    } catch (error) {
      console.error('Failed to load post-processing config:', error)
    }
  }

  return {
    isPostProcessing,
    postProcessStatus,
    aiFilteringError,
    enableAIFiltering,
    autoPostProcessing,
    autoPostProcessingLive,
    aiBatchSize,
    executePostProcessing,
    parseAIError,
    dismissAIError,
    initConfig
  }
}
