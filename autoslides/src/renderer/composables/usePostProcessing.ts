import { ref, type Ref, type ShallowRef } from 'vue'
import { TokenManager } from '../services/authService'
import type { ExtractedSlide, SlideExtractor } from '../services/slideExtractor'
import type { PostProcessStatus, AIFilteringError, SlideHash, DuplicateInfo, PostProcessingConfig } from '../types/playback'

export interface UsePostProcessingOptions {
  mode: 'live' | 'recorded'
  extractedSlides: Ref<ExtractedSlide[]>
  slideExtractorInstance: ShallowRef<SlideExtractor | null>
  deleteSlide: (slide: ExtractedSlide, showConfirmation?: boolean) => Promise<void>
}

export interface UsePostProcessingReturn {
  // State
  isPostProcessing: Ref<boolean>
  postProcessStatus: Ref<PostProcessStatus>
  aiFilteringError: Ref<AIFilteringError>
  enableAIFiltering: Ref<boolean>
  autoPostProcessing: Ref<boolean>
  autoPostProcessingLive: Ref<boolean>
  aiBatchSize: Ref<number>

  // Methods
  executePostProcessing: (showResultDialog?: boolean) => Promise<void>
  processLiveModeSlide: (slide: ExtractedSlide) => Promise<void>
  parseAIError: (error: unknown) => AIFilteringError
  dismissAIError: () => void
  initConfig: () => Promise<void>
}

export function usePostProcessing(options: UsePostProcessingOptions): UsePostProcessingReturn {
  const { mode, extractedSlides, slideExtractorInstance, deleteSlide } = options

  // TokenManager instance
  const tokenManager = new TokenManager()

  // State
  const isPostProcessing = ref(false)
  const postProcessStatus = ref<PostProcessStatus>({
    isProcessing: false,
    currentPhase: 'idle',
    currentIndex: 0,
    totalCount: 0,
    duplicatesRemoved: 0,
    excludedRemoved: 0,
    aiFiltered: 0,
    phase1Skipped: false,
    phase2Skipped: false,
    phase3Skipped: false
  })
  const aiFilteringError = ref<AIFilteringError>({ type: 'none' })
  const enableAIFiltering = ref(true)
  const autoPostProcessing = ref(true)
  const autoPostProcessingLive = ref(true)
  const aiBatchSize = ref(4)

  // Create a worker helper for pHash operations
  const createWorkerHelpers = (worker: Worker) => {
    const calculatePHash = (imageData: ImageData): Promise<string> => {
      return new Promise((resolve, reject) => {
        const messageId = `pHash_${Date.now()}_${Math.random()}`
        const messageHandler = (event: MessageEvent) => {
          const { id, success, result, error } = event.data
          if (id === messageId) {
            worker.removeEventListener('message', messageHandler)
            success ? resolve(result) : reject(new Error(error))
          }
        }
        worker.addEventListener('message', messageHandler)
        worker.postMessage({ id: messageId, type: 'calculatePHash', data: { imageData } })
      })
    }

    const calculateHammingDistance = (hash1: string, hash2: string): Promise<number> => {
      return new Promise((resolve, reject) => {
        const messageId = `hamming_${Date.now()}_${Math.random()}`
        const messageHandler = (event: MessageEvent) => {
          const { id, success, result, error } = event.data
          if (id === messageId) {
            worker.removeEventListener('message', messageHandler)
            success ? resolve(result) : reject(new Error(error))
          }
        }
        worker.addEventListener('message', messageHandler)
        worker.postMessage({ id: messageId, type: 'calculateHammingDistance', data: { hash1, hash2 } })
      })
    }

    return { calculatePHash, calculateHammingDistance }
  }

  // Calculate pHash for all slides
  const calculateAllSlideHashes = async (
    slides: ExtractedSlide[],
    calculatePHash: (imageData: ImageData) => Promise<string>
  ): Promise<SlideHash[]> => {
    console.log('Calculating pHash for all slides...')
    const slideHashes: SlideHash[] = []

    for (const slide of slides) {
      const filename = `${slide.title}.png`
      try {
        if (!slide.imageData?.data) {
          console.warn(`Skipping slide ${slide.title}: ImageData has been cleaned up`)
          slideHashes.push({ slide, filename, pHash: '', error: 'ImageData has been cleaned up' })
          continue
        }
        const pHash = await calculatePHash(slide.imageData)
        slideHashes.push({ slide, filename, pHash })
        console.log(`Calculated pHash for ${filename}: ${pHash}`)
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error)
        console.error(`Failed to calculate pHash for ${slide.title}:`, errorMessage)
        slideHashes.push({ slide, filename, pHash: '', error: errorMessage })
      }
    }
    return slideHashes
  }

  // Phase 1: Remove duplicate slides
  const removeDuplicateSlides = async (
    slideHashes: SlideHash[],
    pHashThreshold: number,
    calculateHammingDistance: (hash1: string, hash2: string) => Promise<number>
  ): Promise<DuplicateInfo[]> => {
    console.log('Phase 1: Removing duplicate slides...')
    postProcessStatus.value.currentPhase = 'phase1'
    postProcessStatus.value.currentIndex = 0

    const seenHashes = new Map<string, string>()
    const duplicatesToDelete: DuplicateInfo[] = []

    for (let i = 0; i < slideHashes.length; i++) {
      const item = slideHashes[i]
      postProcessStatus.value.currentIndex = i + 1

      if (item.error || !item.pHash) continue

      let isDuplicate = false
      let duplicateOf = ''

      for (const [seenHash, seenFilename] of seenHashes.entries()) {
        try {
          const hammingDistance = await calculateHammingDistance(item.pHash, seenHash)
          if (hammingDistance <= pHashThreshold) {
            isDuplicate = true
            duplicateOf = seenFilename
            console.log(`Duplicate detected: ${item.filename} is similar to ${seenFilename} (Hamming distance: ${hammingDistance})`)
            break
          }
        } catch (error) {
          console.warn(`Failed to calculate Hamming distance between ${item.filename} and ${seenFilename}:`, error)
        }
      }

      if (isDuplicate) {
        duplicatesToDelete.push({ ...item, duplicateOf })
      } else {
        seenHashes.set(item.pHash, item.filename)
      }
    }

    // Delete duplicate slides
    for (const duplicate of duplicatesToDelete) {
      try {
        await deleteSlide(duplicate.slide, false)
        postProcessStatus.value.duplicatesRemoved++
        console.log(`Deleted duplicate slide: ${duplicate.filename} (duplicate of ${duplicate.duplicateOf})`)
      } catch (deleteError) {
        console.error(`Failed to delete duplicate slide ${duplicate.filename}:`, deleteError)
      }
    }

    return duplicatesToDelete
  }

  // Phase 2: Check slides against exclusion list
  const checkExclusionList = async (
    slideHashes: SlideHash[],
    duplicatesToDelete: DuplicateInfo[],
    exclusionList: Array<{ name: string; pHash: string }>,
    pHashThreshold: number,
    calculateHammingDistance: (hash1: string, hash2: string) => Promise<number>
  ): Promise<string[]> => {
    console.log('Phase 2: Checking slides against exclusion list...')
    postProcessStatus.value.currentPhase = 'phase2'
    postProcessStatus.value.currentIndex = 0

    const deletedSlides: string[] = []

    for (let i = 0; i < slideHashes.length; i++) {
      const item = slideHashes[i]
      postProcessStatus.value.currentIndex = i + 1

      const { slide, filename, pHash, error: itemError } = item

      if (itemError) continue

      // Skip if already deleted as duplicate
      if (duplicatesToDelete.some(d => d.filename === filename)) {
        deletedSlides.push(filename)
        continue
      }

      // Check against exclusion list
      let shouldExclude = false
      let excludedReason = ''

      for (const exclusionItem of exclusionList) {
        try {
          const hammingDistance = await calculateHammingDistance(pHash, exclusionItem.pHash)
          if (hammingDistance <= pHashThreshold) {
            shouldExclude = true
            excludedReason = `Similar to excluded item "${exclusionItem.name}" (Hamming distance: ${hammingDistance})`
            console.log(`Slide ${filename} excluded: ${excludedReason}`)
            break
          }
        } catch (error) {
          console.warn(`Failed to calculate Hamming distance for exclusion item "${exclusionItem.name}":`, error)
        }
      }

      if (shouldExclude) {
        try {
          await deleteSlide(slide, false)
          deletedSlides.push(filename)
          postProcessStatus.value.excludedRemoved++
        } catch (deleteError) {
          console.error(`Failed to delete excluded slide ${filename}:`, deleteError)
        }
      }

      console.log(`Processed ${filename} (${i + 1}/${slideHashes.length}): pHash = ${pHash}${shouldExclude ? ' [EXCLUDED]' : ''}`)
    }

    return deletedSlides
  }

  // Classify a single slide with AI
  const classifySingleSlide = async (
    slide: ExtractedSlide,
    classifyMode: 'live' | 'recorded',
    token: string | undefined,
    deletedSlides: string[]
  ): Promise<void> => {
    const base64Image = slide.dataUrl.replace(/^data:image\/\w+;base64,/, '')
    const result = await window.electronAPI.ai.classifySingleImage(base64Image, classifyMode, token)

    if (result.success && result.result) {
      const classification = (result.result as { classification: 'slide' | 'not_slide' }).classification
      slide.aiDecision = classification

      if (classification === 'not_slide') {
        try {
          await deleteSlide(slide, false)
          deletedSlides.push(`${slide.title}.png`)
          postProcessStatus.value.aiFiltered++
          console.log(`AI filtered slide: ${slide.title} (classified as not_slide)`)
        } catch (deleteError) {
          console.error(`Failed to delete AI-filtered slide ${slide.title}:`, deleteError)
        }
      } else {
        console.log(`AI kept slide: ${slide.title} (classified as slide)`)
      }
      aiFilteringError.value = { type: 'none' }
    } else {
      console.warn(`AI classification failed for ${slide.title}:`, result.error)
      aiFilteringError.value = parseAIError(result)
    }
  }

  // Classify multiple slides with AI
  const classifyBatchSlides = async (
    batch: ExtractedSlide[],
    classifyMode: 'live' | 'recorded',
    token: string | undefined,
    deletedSlides: string[]
  ): Promise<void> => {
    const base64Images = batch.map(slide => slide.dataUrl.replace(/^data:image\/\w+;base64,/, ''))
    const result = await window.electronAPI.ai.classifyMultipleImages(base64Images, classifyMode, token)

    if (result.success && result.result) {
      const batchResult = result.result as { [key: string]: 'slide' | 'not_slide' }

      for (let j = 0; j < batch.length; j++) {
        const slide = batch[j]
        const classification = batchResult[`image_${j + 1}`] || 'slide'
        slide.aiDecision = classification

        if (classification === 'not_slide') {
          try {
            await deleteSlide(slide, false)
            deletedSlides.push(`${slide.title}.png`)
            postProcessStatus.value.aiFiltered++
            console.log(`AI filtered slide: ${slide.title} (classified as not_slide)`)
          } catch (deleteError) {
            console.error(`Failed to delete AI-filtered slide ${slide.title}:`, deleteError)
          }
        } else {
          console.log(`AI kept slide: ${slide.title} (classified as slide)`)
        }
      }
      aiFilteringError.value = { type: 'none' }
    } else {
      console.warn(`AI batch classification failed:`, result.error)
      aiFilteringError.value = parseAIError(result)
      batch.forEach(slide => { slide.aiDecision = null })
    }
  }

  // Phase 3: AI filtering
  const runAIFiltering = async (
    deletedSlides: string[],
    filterMode: 'live' | 'recorded'
  ): Promise<void> => {
    console.log('Phase 3: AI filtering - classifying remaining slides...')
    postProcessStatus.value.currentPhase = 'phase3'
    postProcessStatus.value.currentIndex = 0

    // Get remaining slides (not deleted in previous phases)
    const remainingSlides = extractedSlides.value.filter(slide => {
      const filename = `${slide.title}.png`
      return !deletedSlides.includes(filename)
    })

    // Filter slides that need AI classification
    const slidesNeedingAI = remainingSlides.filter(slide => slide.aiDecision === null || slide.aiDecision === undefined)
    postProcessStatus.value.totalCount = slidesNeedingAI.length

    const token = tokenManager.getToken() || undefined
    const aiConfig = await window.electronAPI.config?.getAIFilteringConfig?.()
    const batchSize = filterMode === 'live' ? 1 : (aiConfig?.batchSize || 4)

    for (let i = 0; i < slidesNeedingAI.length; i += batchSize) {
      const batch = slidesNeedingAI.slice(i, i + batchSize)
      postProcessStatus.value.currentIndex = Math.min(i + batchSize, slidesNeedingAI.length)

      try {
        if (batch.length === 1) {
          await classifySingleSlide(batch[0], filterMode, token, deletedSlides)
        } else {
          await classifyBatchSlides(batch, filterMode, token, deletedSlides)
        }
      } catch (aiError) {
        console.error(`AI filtering error for batch:`, aiError)
        aiFilteringError.value = parseAIError(aiError)
      }
    }
  }

  // Execute post-processing on all saved slides
  const executePostProcessing = async (showResultDialog = true) => {
    try {
      if (extractedSlides.value.length === 0) return

      const outputPath = slideExtractorInstance.value?.getOutputPath()
      if (!outputPath) throw new Error('Output path not found')

      // Get configuration
      const config = await window.electronAPI.config?.getSlideExtractionConfig?.()
      if (!config) throw new Error('Failed to get slide extraction configuration')

      const ppConfig: PostProcessingConfig = {
        pHashThreshold: config.pHashThreshold || 10,
        enableDuplicateRemoval: config.enableDuplicateRemoval !== false,
        enableExclusionList: config.enableExclusionList !== false,
        enableAIFiltering: await window.electronAPI.config?.getEnableAIFiltering?.() ?? true,
        exclusionList: (config.pHashExclusionList || []).filter(
          (item: { isPreset?: boolean; isEnabled?: boolean }) => !item.isPreset || item.isEnabled !== false
        )
      }

      isPostProcessing.value = true

      // Initialize status
      postProcessStatus.value = {
        isProcessing: true,
        currentPhase: 'idle',
        currentIndex: 0,
        totalCount: extractedSlides.value.length,
        duplicatesRemoved: 0,
        excludedRemoved: 0,
        aiFiltered: 0,
        phase1Skipped: !ppConfig.enableDuplicateRemoval,
        phase2Skipped: !ppConfig.enableExclusionList,
        phase3Skipped: !ppConfig.enableAIFiltering
      }

      console.log(`Starting post-processing for ${extractedSlides.value.length} slides...`)
      console.log(`Phases enabled: duplicate=${ppConfig.enableDuplicateRemoval}, exclusion=${ppConfig.enableExclusionList}, AI=${ppConfig.enableAIFiltering}`)

      // Create worker and helpers
      const worker = new Worker(new URL('../workers/postProcessor.worker.ts', import.meta.url), { type: 'module' })
      const { calculatePHash, calculateHammingDistance } = createWorkerHelpers(worker)

      // Calculate pHash for all slides
      const slideHashes = await calculateAllSlideHashes(extractedSlides.value, calculatePHash)

      // Phase 1: Remove duplicates
      let duplicatesToDelete: DuplicateInfo[] = []
      if (ppConfig.enableDuplicateRemoval) {
        duplicatesToDelete = await removeDuplicateSlides(slideHashes, ppConfig.pHashThreshold, calculateHammingDistance)
      } else {
        console.log('Phase 1: Duplicate removal skipped (disabled)')
      }

      // Phase 2: Check exclusion list
      let deletedSlides: string[] = []
      if (ppConfig.enableExclusionList) {
        deletedSlides = await checkExclusionList(
          slideHashes, duplicatesToDelete, ppConfig.exclusionList,
          ppConfig.pHashThreshold, calculateHammingDistance
        )
      } else {
        console.log('Phase 2: Exclusion list check skipped (disabled)')
        deletedSlides = duplicatesToDelete.map(d => d.filename)
      }

      worker.terminate()

      // Phase 3: AI filtering
      if (ppConfig.enableAIFiltering) {
        await runAIFiltering(deletedSlides, mode)
      } else {
        console.log('Phase 3: AI filtering skipped (disabled)')
      }

      // Complete
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
      await window.electronAPI.dialog?.showErrorBox?.('Post-processing Failed', `Failed to execute post-processing: ${errorMessage}`)
    } finally {
      isPostProcessing.value = false
    }
  }

  // Process a single slide in live mode (post-processing phases 1, 2, 3)
  const processLiveModeSlide = async (slide: ExtractedSlide) => {
    try {
      const outputPath = slideExtractorInstance.value?.getOutputPath()
      if (!outputPath) return

      // Get pHash configuration
      const config = await window.electronAPI.config?.getSlideExtractionConfig?.()
      if (!config) return

      const pHashThreshold = config.pHashThreshold || 10
      const enableDuplicateRemoval = config.enableDuplicateRemoval !== false
      const enableExclusionListPhase = config.enableExclusionList !== false
      const exclusionList = (config.pHashExclusionList || []).filter((item: { isPreset?: boolean; isEnabled?: boolean }) => !item.isPreset || item.isEnabled !== false)

      // Create post-processing worker
      const worker = new Worker(new URL('../workers/postProcessor.worker.ts', import.meta.url), { type: 'module' })

      // Helper function to calculate pHash using worker
      const calculatePHashWithWorker = (imageData: ImageData): Promise<string> => {
        return new Promise((resolve, reject) => {
          const messageId = `pHash_live_${Date.now()}_${Math.random()}`

          const messageHandler = (event: MessageEvent) => {
            const { id, success, result, error } = event.data
            if (id === messageId) {
              worker.removeEventListener('message', messageHandler)
              if (success) {
                resolve(result)
              } else {
                reject(new Error(error))
              }
            }
          }

          worker.addEventListener('message', messageHandler)
          worker.postMessage({
            id: messageId,
            type: 'calculatePHash',
            data: { imageData }
          })
        })
      }

      // Helper function to calculate Hamming distance using worker
      const calculateHammingDistanceWithWorker = (hash1: string, hash2: string): Promise<number> => {
        return new Promise((resolve, reject) => {
          const messageId = `hamming_live_${Date.now()}_${Math.random()}`

          const messageHandler = (event: MessageEvent) => {
            const { id, success, result, error } = event.data
            if (id === messageId) {
              worker.removeEventListener('message', messageHandler)
              if (success) {
                resolve(result)
              } else {
                reject(new Error(error))
              }
            }
          }

          worker.addEventListener('message', messageHandler)
          worker.postMessage({
            id: messageId,
            type: 'calculateHammingDistance',
            data: { hash1, hash2 }
          })
        })
      }

      // Check if imageData is valid
      if (!slide.imageData || !slide.imageData.data) {
        console.warn(`[Live Post-Processing] Skipping slide ${slide.title}: ImageData has been cleaned up`)
        worker.terminate()
        return
      }

      // Calculate pHash for the new slide
      const pHash = await calculatePHashWithWorker(slide.imageData)
      console.log(`[Live Post-Processing] Calculated pHash for ${slide.title}: ${pHash}`)

      // Phase 1: Check for duplicates against existing slides (except itself)
      if (enableDuplicateRemoval) {
        const otherSlides = extractedSlides.value.filter(s => s.id !== slide.id && s.imageData && s.imageData.data)

        for (const otherSlide of otherSlides) {
          try {
            const otherPHash = await calculatePHashWithWorker(otherSlide.imageData)
            const hammingDistance = await calculateHammingDistanceWithWorker(pHash, otherPHash)

            if (hammingDistance <= pHashThreshold) {
              console.log(`[Live Post-Processing] Duplicate detected: ${slide.title} is similar to ${otherSlide.title} (Hamming distance: ${hammingDistance})`)
              await deleteSlide(slide, false)
              worker.terminate()
              return
            }
          } catch (error) {
            console.warn(`[Live Post-Processing] Failed to compare with ${otherSlide.title}:`, error)
          }
        }
      }

      // Phase 2: Check against exclusion list
      if (enableExclusionListPhase) {
        for (const exclusionItem of exclusionList) {
          try {
            const hammingDistance = await calculateHammingDistanceWithWorker(pHash, exclusionItem.pHash)
            if (hammingDistance <= pHashThreshold) {
              console.log(`[Live Post-Processing] Excluded: ${slide.title} is similar to "${exclusionItem.name}" (Hamming distance: ${hammingDistance})`)
              await deleteSlide(slide, false)
              worker.terminate()
              return
            }
          } catch (error) {
            console.warn(`[Live Post-Processing] Failed to compare with exclusion item "${exclusionItem.name}":`, error)
          }
        }
      }

      worker.terminate()

      // Phase 3: AI filtering (only if not already processed)
      if (enableAIFiltering.value && (slide.aiDecision === null || slide.aiDecision === undefined)) {
        try {
          const token = tokenManager.getToken() || undefined
          const base64Image = slide.dataUrl.replace(/^data:image\/\w+;base64,/, '')

          const result = await window.electronAPI.ai.classifySingleImage(
            base64Image,
            'live',
            token
          )

          if (result.success && result.result) {
            const classification = (result.result as { classification: 'slide' | 'not_slide' }).classification
            slide.aiDecision = classification

            if (classification === 'not_slide') {
              console.log(`[Live Post-Processing] AI filtered: ${slide.title} (classified as not_slide)`)
              await deleteSlide(slide, false)
              return
            } else {
              console.log(`[Live Post-Processing] AI kept: ${slide.title} (classified as slide)`)
            }
            // Clear any previous error on success
            aiFilteringError.value = { type: 'none' }
          } else {
            console.warn(`[Live Post-Processing] AI classification failed for ${slide.title}:`, result.error)
            // Parse and set error
            const parsedError = parseAIError(result)
            aiFilteringError.value = parsedError
          }
        } catch (aiError) {
          console.error(`[Live Post-Processing] AI filtering error for ${slide.title}:`, aiError)
          // Parse and set error
          const parsedError = parseAIError(aiError)
          aiFilteringError.value = parsedError
        }
      }

    } catch (error) {
      console.error(`[Live Post-Processing] Error processing slide ${slide.title}:`, error)
    }
  }

  // Parse AI filtering error from result or exception
  const parseAIError = (error: unknown): AIFilteringError => {
    // Check if it's an AIFilteringResult with error message
    if (error && typeof error === 'object' && 'error' in error) {
      const errorMessage = (error as { error?: string }).error || ''

      // Parse HTTP status code from error message
      const httpCodeMatch = errorMessage.match(/HTTP\s*(\d{3})/i) || errorMessage.match(/status[:\s]*(\d{3})/i)
      if (httpCodeMatch) {
        const httpCode = parseInt(httpCodeMatch[1], 10)
        if (httpCode === 403) {
          return { type: '403', httpCode: 403, message: errorMessage }
        } else if (httpCode === 413) {
          return { type: '413', httpCode: 413, message: errorMessage }
        } else {
          return { type: 'http', httpCode, message: errorMessage }
        }
      }

      // Check for specific error patterns
      if (errorMessage.includes('403') || errorMessage.toLowerCase().includes('forbidden')) {
        return { type: '403', httpCode: 403, message: errorMessage }
      }
      if (errorMessage.includes('413') || errorMessage.toLowerCase().includes('payload too large') || errorMessage.toLowerCase().includes('entity too large')) {
        return { type: '413', httpCode: 413, message: errorMessage }
      }

      return { type: 'unknown', message: errorMessage }
    }

    // Check if it's an Error object
    if (error instanceof Error) {
      const errorMessage = error.message

      if (errorMessage.includes('403') || errorMessage.toLowerCase().includes('forbidden')) {
        return { type: '403', httpCode: 403, message: errorMessage }
      }
      if (errorMessage.includes('413') || errorMessage.toLowerCase().includes('payload too large')) {
        return { type: '413', httpCode: 413, message: errorMessage }
      }

      // Try to extract HTTP code
      const httpCodeMatch = errorMessage.match(/(\d{3})/)
      if (httpCodeMatch) {
        const httpCode = parseInt(httpCodeMatch[1], 10)
        if (httpCode >= 400 && httpCode < 600) {
          return { type: 'http', httpCode, message: errorMessage }
        }
      }

      return { type: 'unknown', message: errorMessage }
    }

    return { type: 'unknown', message: String(error) }
  }

  // Dismiss AI error warning
  const dismissAIError = () => {
    aiFilteringError.value = { type: 'none' }
  }

  // Initialize config
  const initConfig = async () => {
    try {
      const config = await window.electronAPI.config.get()
      autoPostProcessing.value = config.autoPostProcessing !== undefined ? config.autoPostProcessing : true
      autoPostProcessingLive.value = config.autoPostProcessingLive !== undefined ? config.autoPostProcessingLive : true
      enableAIFiltering.value = config.enableAIFiltering !== undefined ? config.enableAIFiltering : true

      // Load AI filtering config for batch size
      const aiConfig = await window.electronAPI.config?.getAIFilteringConfig?.()
      if (aiConfig) {
        aiBatchSize.value = aiConfig.batchSize || 4
      }
    } catch (error) {
      console.error('Failed to load post-processing config:', error)
    }
  }

  return {
    // State
    isPostProcessing,
    postProcessStatus,
    aiFilteringError,
    enableAIFiltering,
    autoPostProcessing,
    autoPostProcessingLive,
    aiBatchSize,

    // Methods
    executePostProcessing,
    processLiveModeSlide,
    parseAIError,
    dismissAIError,
    initConfig
  }
}
