import { ref, type Ref, type ShallowRef } from 'vue'
import { TokenManager } from '../services/authService'
import type { ExtractedSlide, SlideExtractor } from '../services/slideExtractor'

// Types for post-processing
export interface AIFilteringError {
  type: 'none' | '403' | '413' | '429' | 'http' | 'unknown'
  httpCode?: number
  message?: string
}

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
  // AI progress tracking for 3-color progress bar
  aiCompleted: number    // Slides with aiDecision set
  aiInProgress: number   // Current batch size being processed
  aiTotal: number        // Total extracted slides (denominator)
}

export interface SlideHash {
  slide: ExtractedSlide
  filename: string
  pHash: string
  error?: string
}

export interface DuplicateInfo {
  slide: ExtractedSlide
  filename: string
  pHash: string
  duplicateOf: string
}

export interface PostProcessingConfig {
  pHashThreshold: number
  enableDuplicateRemoval: boolean
  enableExclusionList: boolean
  enableAIFiltering: boolean
  exclusionList: Array<{ name: string; pHash: string }>
}

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
  const pendingAIPhase = ref(false) // Flag for queued AI phase when auto-triggered during processing
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
    phase3Skipped: false,
    aiCompleted: 0,
    aiInProgress: 0,
    aiTotal: 0
  })
  const aiFilteringError = ref<AIFilteringError>({ type: 'none' })
  const enableAIFiltering = ref(true)
  const autoPostProcessing = ref(true)
  const autoPostProcessingLive = ref(true)
  const aiBatchSize = ref(4)
  const aiImageResizeWidth = ref(768)
  const aiImageResizeHeight = ref(432)

  // Helper function to resize a base64 image using Canvas
  const resizeBase64Image = async (
    dataUrl: string,
    targetWidth: number,
    targetHeight: number
  ): Promise<string> => {
    return new Promise((resolve, reject) => {
      const img = new Image()
      img.onload = () => {
        // Skip resize if target is same or larger than original
        if (targetWidth >= img.width && targetHeight >= img.height) {
          resolve(dataUrl)
          return
        }

        const canvas = document.createElement('canvas')
        canvas.width = targetWidth
        canvas.height = targetHeight
        const ctx = canvas.getContext('2d')
        if (!ctx) {
          reject(new Error('Failed to get canvas context'))
          return
        }
        ctx.drawImage(img, 0, 0, targetWidth, targetHeight)
        resolve(canvas.toDataURL('image/png'))
      }
      img.onerror = () => reject(new Error('Failed to load image for resize'))
      img.src = dataUrl
    })
  }

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
    // Resize image if needed
    let processedDataUrl = slide.dataUrl
    if (aiImageResizeWidth.value < 1920 || aiImageResizeHeight.value < 1080) {
      try {
        processedDataUrl = await resizeBase64Image(
          slide.dataUrl,
          aiImageResizeWidth.value,
          aiImageResizeHeight.value
        )
      } catch (resizeError) {
        console.warn(`Failed to resize image for ${slide.title}, using original:`, resizeError)
      }
    }

    const base64Image = processedDataUrl.replace(/^data:image\/\w+;base64,/, '')

    // Use appropriate API based on mode:
    // - 'live' mode uses classifySingleImage (expects {"classification": ...})
    // - 'recorded' mode uses classifyMultipleImages (expects {"image_0": ...})
    let classification: 'slide' | 'not_slide'

    if (classifyMode === 'live') {
      const result = await window.electronAPI.ai.classifySingleImage(base64Image, classifyMode, token)
      if (!result.success || !result.result) {
        console.warn(`AI classification failed for ${slide.title}:`, result.error)
        aiFilteringError.value = parseAIError(result)
        return
      }
      classification = (result.result as { classification: 'slide' | 'not_slide' }).classification
    } else {
      // recorded mode - always use batch API even for single image
      const result = await window.electronAPI.ai.classifyMultipleImages([base64Image], classifyMode, token)
      if (!result.success || !result.result) {
        console.warn(`AI classification failed for ${slide.title}:`, result.error)
        aiFilteringError.value = parseAIError(result)
        return
      }
      const batchResult = result.result as { [key: string]: 'slide' | 'not_slide' }
      classification = batchResult['image_0'] || 'slide'
    }

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
  }

  // Classify multiple slides with AI
  const classifyBatchSlides = async (
    batch: ExtractedSlide[],
    classifyMode: 'live' | 'recorded',
    token: string | undefined,
    deletedSlides: string[]
  ): Promise<void> => {
    // Resize images if needed
    const base64Images: string[] = []
    for (const slide of batch) {
      let processedDataUrl = slide.dataUrl
      if (aiImageResizeWidth.value < 1920 || aiImageResizeHeight.value < 1080) {
        try {
          processedDataUrl = await resizeBase64Image(
            slide.dataUrl,
            aiImageResizeWidth.value,
            aiImageResizeHeight.value
          )
        } catch (resizeError) {
          console.warn(`Failed to resize image for ${slide.title}, using original:`, resizeError)
        }
      }
      base64Images.push(processedDataUrl.replace(/^data:image\/\w+;base64,/, ''))
    }

    const result = await window.electronAPI.ai.classifyMultipleImages(base64Images, classifyMode, token)

    if (result.success && result.result) {
      const batchResult = result.result as { [key: string]: 'slide' | 'not_slide' }

      for (let j = 0; j < batch.length; j++) {
        const slide = batch[j]
        const classification = batchResult[`image_${j}`] || 'slide'
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

    // Update AI progress tracking: aiTotal is total extracted slides
    postProcessStatus.value.aiTotal = extractedSlides.value.length
    // Count how many already have AI decisions
    postProcessStatus.value.aiCompleted = extractedSlides.value.filter(
      slide => slide.aiDecision !== null && slide.aiDecision !== undefined
    ).length
    postProcessStatus.value.aiInProgress = 0

    const token = tokenManager.getToken() || undefined
    const aiConfig = await window.electronAPI.config?.getAIFilteringConfig?.()
    const batchSize = filterMode === 'live' ? 1 : (aiConfig?.batchSize || 5)

    for (let i = 0; i < slidesNeedingAI.length; i += batchSize) {
      const batch = slidesNeedingAI.slice(i, i + batchSize)
      postProcessStatus.value.currentIndex = Math.min(i + batchSize, slidesNeedingAI.length)

      // Update aiTotal in case new slides were extracted during processing
      postProcessStatus.value.aiTotal = extractedSlides.value.length

      // Set in-progress count before sending request
      postProcessStatus.value.aiInProgress = batch.length

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

      // Update completed count after batch finishes (whether success or failure)
      postProcessStatus.value.aiCompleted = extractedSlides.value.filter(
        slide => slide.aiDecision !== null && slide.aiDecision !== undefined
      ).length
      // Reset in-progress after batch completes
      postProcessStatus.value.aiInProgress = 0
    }
  }

  // Execute post-processing on all saved slides
  const executePostProcessing = async (showResultDialog = true) => {
    try {
      if (extractedSlides.value.length === 0) return

      // Handle concurrent triggers
      if (isPostProcessing.value) {
        if (showResultDialog) {
          // Manual trigger while processing - ignore (debounce)
          console.log('Post-processing already in progress, ignoring manual trigger')
          return
        } else {
          // Auto trigger while processing - queue AI phase for later
          console.log('Post-processing already in progress, queuing AI phase')
          pendingAIPhase.value = true
          return
        }
      }

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
      pendingAIPhase.value = false // Clear any pending flag when starting

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
        phase3Skipped: !ppConfig.enableAIFiltering,
        aiCompleted: 0,
        aiInProgress: 0,
        aiTotal: extractedSlides.value.length
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

      // Phase 3: AI filtering (with pending queue support)
      if (ppConfig.enableAIFiltering) {
        // Run AI filtering, and keep running while there are pending requests
        do {
          pendingAIPhase.value = false // Clear flag before running
          await runAIFiltering(deletedSlides, mode)
          // If pendingAIPhase was set during runAIFiltering, loop again
          // Reset deletedSlides for re-run (all previously deleted slides are still deleted)
          if (pendingAIPhase.value) {
            console.log('Processing pending AI phase request...')
            deletedSlides = [] // Reset for new AI-only pass
          }
        } while (pendingAIPhase.value)
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
      pendingAIPhase.value = false // Clear pending flag on completion
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
        } else if (httpCode === 429) {
          return { type: '429', httpCode: 429, message: errorMessage }
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
      if (errorMessage.includes('429') || errorMessage.toLowerCase().includes('too many requests') || errorMessage.toLowerCase().includes('rate limit')) {
        return { type: '429', httpCode: 429, message: errorMessage }
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
      if (errorMessage.includes('429') || errorMessage.toLowerCase().includes('too many requests') || errorMessage.toLowerCase().includes('rate limit')) {
        return { type: '429', httpCode: 429, message: errorMessage }
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

      // Load AI filtering config for batch size and image resize
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
    parseAIError,
    dismissAIError,
    initConfig
  }
}
