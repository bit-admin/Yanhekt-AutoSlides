import { reactive, computed } from 'vue'
import { TokenManager } from './authService'

// Types for post-processing jobs
export type PostProcessJobStatus = 'queued' | 'processing' | 'completed' | 'failed'
export type PostProcessPhase = 'idle' | 'phase1' | 'phase2' | 'phase3' | 'completed'

export interface PostProcessJobProgress {
  phase: PostProcessPhase
  currentIndex: number
  total: number
  duplicatesRemoved: number
  excludedRemoved: number
  aiFiltered: number
  failed: number
  retrying: number
}

export interface JobError {
  filename: string
  errorType: 'network' | '403' | '413' | '429' | 'http' | 'unknown'
  message: string
  retryCount: number
}

export interface PostProcessJob {
  id: string
  taskId: string
  outputPath: string
  imageFiles: string[]      // File paths relative to outputPath
  status: PostProcessJobStatus
  progress: PostProcessJobProgress
  errors: JobError[]
  createdAt: number
  startedAt?: number
  completedAt?: number
}

export interface PostProcessingServiceState {
  jobs: PostProcessJob[]
  isProcessing: boolean
}

// Configuration for post-processing
interface PostProcessingConfig {
  pHashThreshold: number
  enableDuplicateRemoval: boolean
  enableExclusionList: boolean
  enableAIFiltering: boolean
  exclusionList: Array<{ name: string; pHash: string; isEnabled?: boolean }>
}

// Slide hash info
interface SlideHashInfo {
  filename: string
  pHash: string
  error?: string
}

// Batch processing result for AI phase
interface AIBatchResult {
  successful: string[]      // Files classified as 'slide' (kept)
  notSlide: string[]        // Files classified as 'not_slide' (to delete)
  failed: string[]          // Files that failed after retries
  pending413: string[][]    // Batches needing smaller size retry
}

// Error info for retry logic
interface ErrorInfo {
  type: 'network' | '403' | '413' | '429' | 'http' | 'unknown'
  message: string
}

// AI Classification result
interface AIClassificationResult {
  success: boolean
  result?: {
    classification?: 'slide' | 'not_slide'
    [key: string]: 'slide' | 'not_slide' | undefined
  }
  error?: string
}

class PostProcessingServiceClass {
  private state: PostProcessingServiceState = reactive({
    jobs: [],
    isProcessing: false
  })

  private tokenManager = new TokenManager()
  private processingPromise: Promise<void> | null = null

  // Image resize config (loaded from AI settings)
  private imageResizeWidth = 768
  private imageResizeHeight = 432

  // Computed properties
  get jobs() {
    return this.state.jobs
  }

  get isProcessing() {
    return this.state.isProcessing
  }

  get activeJobCount() {
    return this.state.jobs.filter(job => job.status === 'processing').length
  }

  get queuedJobCount() {
    return this.state.jobs.filter(job => job.status === 'queued').length
  }

  get completedJobCount() {
    return this.state.jobs.filter(job => job.status === 'completed').length
  }

  get failedJobCount() {
    return this.state.jobs.filter(job => job.status === 'failed').length
  }

  // Get job by task ID
  getJobByTaskId(taskId: string): PostProcessJob | undefined {
    return this.state.jobs.find(job => job.taskId === taskId)
  }

  // Get job by ID
  getJob(jobId: string): PostProcessJob | undefined {
    return this.state.jobs.find(job => job.id === jobId)
  }

  // Add a new post-processing job
  addJob(taskId: string, outputPath: string, imageFiles: string[]): string {
    // Check if job for this task already exists and is not completed/failed
    const existingJob = this.state.jobs.find(
      job => job.taskId === taskId && (job.status === 'queued' || job.status === 'processing')
    )

    if (existingJob) {
      console.log(`[PostProcessing] Job already exists for task ${taskId}, skipping`)
      return existingJob.id
    }

    const jobId = this.generateJobId()
    const job: PostProcessJob = {
      id: jobId,
      taskId,
      outputPath,
      imageFiles,
      status: 'queued',
      progress: {
        phase: 'idle',
        currentIndex: 0,
        total: imageFiles.length,
        duplicatesRemoved: 0,
        excludedRemoved: 0,
        aiFiltered: 0,
        failed: 0,
        retrying: 0
      },
      errors: [],
      createdAt: Date.now()
    }

    this.state.jobs.push(job)
    console.log(`[PostProcessing] Added job ${jobId} for task ${taskId} with ${imageFiles.length} images`)

    // Start processing if not already running
    this.startProcessing()

    return jobId
  }

  // Remove a job
  removeJob(jobId: string): void {
    const index = this.state.jobs.findIndex(job => job.id === jobId)
    if (index !== -1) {
      this.state.jobs.splice(index, 1)
    }
  }

  // Clear completed and failed jobs
  clearCompleted(): void {
    this.state.jobs = this.state.jobs.filter(
      job => job.status !== 'completed' && job.status !== 'failed'
    )
  }

  // Start processing the queue
  private startProcessing(): void {
    if (this.processingPromise) {
      return // Already processing
    }

    this.state.isProcessing = true
    this.processingPromise = this.processQueue().finally(() => {
      this.processingPromise = null
      this.state.isProcessing = false
    })
  }

  // Process the job queue
  private async processQueue(): Promise<void> {
    let nextJob = this.state.jobs.find(job => job.status === 'queued')
    while (nextJob) {
      await this.processJob(nextJob)
      nextJob = this.state.jobs.find(job => job.status === 'queued')
    }
  }

  // Process a single job with all 3 phases
  private async processJob(job: PostProcessJob): Promise<void> {
    console.log(`[PostProcessing] Starting job ${job.id}`)
    job.status = 'processing'
    job.startedAt = Date.now()

    let worker: Worker | null = null

    try {
      // Load configuration
      const config = await this.loadConfig()

      // Load AI config for image resize
      const aiConfig = await window.electronAPI.config?.getAIFilteringConfig?.()
      this.imageResizeWidth = aiConfig?.imageResizeWidth || 768
      this.imageResizeHeight = aiConfig?.imageResizeHeight || 432
      const aiBatchSize = aiConfig?.batchSize || 5

      // Track deleted files to exclude from later phases
      const deletedFiles = new Set<string>()

      // Create worker for pHash calculations (needed for phases 1 and 2)
      if (config.enableDuplicateRemoval || config.enableExclusionList) {
        worker = new Worker(
          new URL('../workers/postProcessor.worker.ts', import.meta.url),
          { type: 'module' }
        )
        const { calculatePHash, calculateHammingDistance } = this.createWorkerHelpers(worker)

        // Calculate pHash for all images
        console.log('[PostProcessing] Calculating pHash for all images...')
        const slideHashes = await this.calculateAllHashes(job, calculatePHash)

        // Phase 1: Remove duplicates
        if (config.enableDuplicateRemoval) {
          job.progress.phase = 'phase1'
          job.progress.currentIndex = 0
          console.log('[PostProcessing] Phase 1: Removing duplicates...')

          const duplicates = await this.removeDuplicates(
            job,
            slideHashes,
            config.pHashThreshold,
            calculateHammingDistance
          )

          for (const filename of duplicates) {
            deletedFiles.add(filename)
          }
        } else {
          console.log('[PostProcessing] Phase 1: Duplicate removal disabled, skipping')
        }

        // Phase 2: Check exclusion list
        if (config.enableExclusionList && config.exclusionList.length > 0) {
          job.progress.phase = 'phase2'
          job.progress.currentIndex = 0
          console.log('[PostProcessing] Phase 2: Checking exclusion list...')

          const excluded = await this.checkExclusionList(
            job,
            slideHashes,
            deletedFiles,
            config.exclusionList,
            config.pHashThreshold,
            calculateHammingDistance
          )

          for (const filename of excluded) {
            deletedFiles.add(filename)
          }
        } else {
          console.log('[PostProcessing] Phase 2: Exclusion list disabled or empty, skipping')
        }

        // Terminate worker after pHash operations
        worker.terminate()
        worker = null
      }

      // Phase 3: AI Classification
      if (config.enableAIFiltering) {
        job.progress.phase = 'phase3'
        job.progress.currentIndex = 0
        console.log('[PostProcessing] Phase 3: AI classification...')

        // Get remaining files (not deleted in previous phases)
        const remainingFiles = job.imageFiles.filter(f => !deletedFiles.has(f))
        job.progress.total = remainingFiles.length

        if (remainingFiles.length > 0) {
          const token = this.tokenManager.getToken() || undefined
          const aiResult = await this.processAIClassification(
            job,
            remainingFiles,
            aiBatchSize,
            token
          )

          // Move images classified as not_slide to in-app trash
          for (const filename of aiResult.notSlide) {
            try {
              await window.electronAPI.slideExtraction.moveToInAppTrash(job.outputPath, filename, {
                reason: 'ai_filtered',
                reasonDetails: 'AI classified as not_slide'
              })
              console.log(`[PostProcessing] Moved not_slide to trash: ${filename}`)
            } catch (deleteError) {
              console.error(`[PostProcessing] Failed to move ${filename} to trash:`, deleteError)
            }
          }

          job.progress.failed = aiResult.failed.length
        }
      } else {
        console.log('[PostProcessing] Phase 3: AI filtering disabled, skipping')
      }

      // Complete
      job.progress.phase = 'completed'
      job.status = 'completed'
      job.completedAt = Date.now()

      console.log(`[PostProcessing] Job ${job.id} completed:`, {
        duplicatesRemoved: job.progress.duplicatesRemoved,
        excludedRemoved: job.progress.excludedRemoved,
        aiFiltered: job.progress.aiFiltered,
        failed: job.progress.failed
      })

    } catch (error) {
      console.error(`[PostProcessing] Job ${job.id} failed:`, error)
      job.status = 'failed'
      job.completedAt = Date.now()
      job.errors.push({
        filename: '*',
        errorType: 'unknown',
        message: error instanceof Error ? error.message : String(error),
        retryCount: 0
      })
    } finally {
      if (worker) {
        worker.terminate()
      }
    }
  }

  // Load post-processing configuration
  private async loadConfig(): Promise<PostProcessingConfig> {
    const slideConfig = await window.electronAPI.config?.getSlideExtractionConfig?.()
    const enableAIFiltering = await window.electronAPI.config?.getEnableAIFiltering?.() ?? true

    return {
      pHashThreshold: slideConfig?.pHashThreshold || 10,
      enableDuplicateRemoval: slideConfig?.enableDuplicateRemoval !== false,
      enableExclusionList: slideConfig?.enableExclusionList !== false,
      enableAIFiltering,
      exclusionList: (slideConfig?.pHashExclusionList || []).filter(
        (item: { isPreset?: boolean; isEnabled?: boolean }) =>
          !item.isPreset || item.isEnabled !== false
      )
    }
  }

  // Create worker helpers for pHash operations
  private createWorkerHelpers(worker: Worker) {
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

  // Read a PNG file and convert to ImageData for pHash calculation
  private async readImageAsImageData(outputPath: string, filename: string): Promise<ImageData | null> {
    try {
      const base64 = await window.electronAPI.slideExtraction.readSlideAsBase64(outputPath, filename)

      return new Promise((resolve) => {
        const img = new Image()
        img.onload = () => {
          const canvas = document.createElement('canvas')
          canvas.width = img.width
          canvas.height = img.height
          const ctx = canvas.getContext('2d')
          if (!ctx) {
            resolve(null)
            return
          }
          ctx.drawImage(img, 0, 0)
          resolve(ctx.getImageData(0, 0, img.width, img.height))
        }
        img.onerror = () => resolve(null)
        img.src = `data:image/png;base64,${base64}`
      })
    } catch (error) {
      console.error(`[PostProcessing] Failed to read image ${filename}:`, error)
      return null
    }
  }

  // Calculate pHash for all images
  private async calculateAllHashes(
    job: PostProcessJob,
    calculatePHash: (imageData: ImageData) => Promise<string>
  ): Promise<SlideHashInfo[]> {
    const slideHashes: SlideHashInfo[] = []

    for (let i = 0; i < job.imageFiles.length; i++) {
      const filename = job.imageFiles[i]
      job.progress.currentIndex = i + 1

      try {
        const imageData = await this.readImageAsImageData(job.outputPath, filename)
        if (!imageData) {
          console.warn(`[PostProcessing] Failed to read image ${filename}`)
          slideHashes.push({ filename, pHash: '', error: 'Failed to read image' })
          continue
        }

        const pHash = await calculatePHash(imageData)
        slideHashes.push({ filename, pHash })
        console.log(`[PostProcessing] Calculated pHash for ${filename}: ${pHash.substring(0, 16)}...`)
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error)
        console.error(`[PostProcessing] Failed to calculate pHash for ${filename}:`, errorMessage)
        slideHashes.push({ filename, pHash: '', error: errorMessage })
      }
    }

    return slideHashes
  }

  // Phase 1: Remove duplicate slides
  private async removeDuplicates(
    job: PostProcessJob,
    slideHashes: SlideHashInfo[],
    pHashThreshold: number,
    calculateHammingDistance: (hash1: string, hash2: string) => Promise<number>
  ): Promise<string[]> {
    const seenHashes = new Map<string, string>() // pHash -> filename
    const duplicatesToDelete: string[] = []

    for (let i = 0; i < slideHashes.length; i++) {
      const item = slideHashes[i]
      job.progress.currentIndex = i + 1

      if (item.error || !item.pHash) continue

      let isDuplicate = false
      let duplicateOf = ''

      for (const [seenHash, seenFilename] of seenHashes.entries()) {
        try {
          const hammingDistance = await calculateHammingDistance(item.pHash, seenHash)
          if (hammingDistance <= pHashThreshold) {
            isDuplicate = true
            duplicateOf = seenFilename
            console.log(`[PostProcessing] Duplicate: ${item.filename} similar to ${seenFilename} (distance: ${hammingDistance})`)
            break
          }
        } catch (error) {
          console.warn(`[PostProcessing] Failed to calculate Hamming distance:`, error)
        }
      }

      if (isDuplicate) {
        duplicatesToDelete.push(item.filename)
        try {
          await window.electronAPI.slideExtraction.moveToInAppTrash(job.outputPath, item.filename, {
            reason: 'duplicate',
            reasonDetails: `Duplicate of ${duplicateOf}`
          })
          job.progress.duplicatesRemoved++
          console.log(`[PostProcessing] Moved duplicate to trash: ${item.filename} (duplicate of ${duplicateOf})`)
        } catch (deleteError) {
          console.error(`[PostProcessing] Failed to move duplicate ${item.filename} to trash:`, deleteError)
        }
      } else {
        seenHashes.set(item.pHash, item.filename)
      }
    }

    return duplicatesToDelete
  }

  // Phase 2: Check slides against exclusion list
  private async checkExclusionList(
    job: PostProcessJob,
    slideHashes: SlideHashInfo[],
    alreadyDeleted: Set<string>,
    exclusionList: Array<{ name: string; pHash: string }>,
    pHashThreshold: number,
    calculateHammingDistance: (hash1: string, hash2: string) => Promise<number>
  ): Promise<string[]> {
    const excludedFiles: string[] = []

    for (let i = 0; i < slideHashes.length; i++) {
      const item = slideHashes[i]
      job.progress.currentIndex = i + 1

      // Skip if already deleted or has error
      if (alreadyDeleted.has(item.filename) || item.error || !item.pHash) continue

      let shouldExclude = false
      let excludedReason = ''

      for (const exclusionItem of exclusionList) {
        try {
          const hammingDistance = await calculateHammingDistance(item.pHash, exclusionItem.pHash)
          if (hammingDistance <= pHashThreshold) {
            shouldExclude = true
            excludedReason = `Similar to "${exclusionItem.name}" (distance: ${hammingDistance})`
            console.log(`[PostProcessing] Excluded: ${item.filename} - ${excludedReason}`)
            break
          }
        } catch (error) {
          console.warn(`[PostProcessing] Failed to check exclusion for ${item.filename}:`, error)
        }
      }

      if (shouldExclude) {
        excludedFiles.push(item.filename)
        try {
          await window.electronAPI.slideExtraction.moveToInAppTrash(job.outputPath, item.filename, {
            reason: 'exclusion',
            reasonDetails: excludedReason
          })
          job.progress.excludedRemoved++
        } catch (deleteError) {
          console.error(`[PostProcessing] Failed to move excluded ${item.filename} to trash:`, deleteError)
        }
      }
    }

    return excludedFiles
  }

  // Phase 3: AI Classification with retry logic
  private async processAIClassification(
    job: PostProcessJob,
    files: string[],
    batchSize: number,
    token: string | undefined
  ): Promise<AIBatchResult> {
    const result: AIBatchResult = {
      successful: [],
      notSlide: [],
      failed: [],
      pending413: []
    }

    // Divide into batches
    const batches: string[][] = []
    for (let i = 0; i < files.length; i += batchSize) {
      batches.push(files.slice(i, i + batchSize))
    }

    console.log(`[PostProcessing] AI processing ${files.length} images in ${batches.length} batches`)

    // Process each batch
    const pending413Batches: string[][] = []

    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i]
      const batchResult = await this.processAIBatchWithRetry(job, batch, token, batchSize)

      result.successful.push(...batchResult.successful)
      result.notSlide.push(...batchResult.notSlide)
      result.failed.push(...batchResult.failed)

      if (batchResult.pending413.length > 0) {
        pending413Batches.push(...batchResult.pending413)
      }

      job.progress.currentIndex = Math.min((i + 1) * batchSize, files.length)
      job.progress.aiFiltered = result.notSlide.length
    }

    // Process 413 pending batches with smaller sizes
    if (pending413Batches.length > 0) {
      console.log(`[PostProcessing] Processing ${pending413Batches.length} pending 413 batches`)
      const pending413Result = await this.process413Batches(job, pending413Batches, token, batchSize)

      result.successful.push(...pending413Result.successful)
      result.notSlide.push(...pending413Result.notSlide)
      result.failed.push(...pending413Result.failed)

      job.progress.aiFiltered = result.notSlide.length
    }

    return result
  }

  // Process a single AI batch with retry logic
  private async processAIBatchWithRetry(
    job: PostProcessJob,
    batch: string[],
    token: string | undefined,
    originalBatchSize: number,
    retryCount = 0
  ): Promise<AIBatchResult> {
    const result: AIBatchResult = {
      successful: [],
      notSlide: [],
      failed: [],
      pending413: []
    }

    const maxRetries = 2

    try {
      // Read and resize images
      const base64Images = await this.readAndResizeImages(job.outputPath, batch)

      // Filter out failed reads
      const validBatch: string[] = []
      const validBase64: string[] = []
      for (let i = 0; i < batch.length; i++) {
        const base64 = base64Images[i]
        if (base64) {
          validBatch.push(batch[i])
          validBase64.push(base64)
        } else {
          result.failed.push(batch[i])
        }
      }

      if (validBatch.length === 0) {
        return result
      }

      job.progress.retrying = validBatch.length

      // Always use batch API in recorded mode (even for single image)
      const aiResult = await window.electronAPI.ai.classifyMultipleImages(
        validBase64,
        'recorded',
        token
      ) as AIClassificationResult

      job.progress.retrying = 0

      if (aiResult.success && aiResult.result) {
        // Process results - always use batch format (image_0, image_1, etc.)
        for (let j = 0; j < validBatch.length; j++) {
          const key = `image_${j}`
          const classification = aiResult.result[key] || 'slide'
          if (classification === 'slide') {
            result.successful.push(validBatch[j])
          } else {
            result.notSlide.push(validBatch[j])
          }
        }
      } else {
        // Handle error
        const errorInfo = this.parseError(aiResult.error)

        if (errorInfo.type === '413') {
          result.pending413.push(validBatch)
        } else if ((errorInfo.type === '403' || errorInfo.type === 'network' || errorInfo.type === '429') && retryCount < maxRetries) {
          // Use longer delay for 429 rate limiting
          const delay = errorInfo.type === '429'
            ? 10000 * (retryCount + 1)  // 10s, 20s, 30s for rate limits
            : 1000 * (retryCount + 1)   // 1s, 2s, 3s for other errors
          console.log(`[PostProcessing] Retrying batch due to ${errorInfo.type} (attempt ${retryCount + 1}/${maxRetries}, delay ${delay}ms)`)
          job.progress.retrying = validBatch.length
          await this.delay(delay)
          const retryResult = await this.processAIBatchWithRetry(job, validBatch, token, originalBatchSize, retryCount + 1)
          result.successful.push(...retryResult.successful)
          result.notSlide.push(...retryResult.notSlide)
          result.failed.push(...retryResult.failed)
          result.pending413.push(...retryResult.pending413)
        } else {
          console.warn(`[PostProcessing] Batch failed with ${errorInfo.type}: ${errorInfo.message}`)
          result.failed.push(...validBatch)
          for (const filename of validBatch) {
            job.errors.push({
              filename,
              errorType: errorInfo.type,
              message: errorInfo.message,
              retryCount
            })
          }
        }
      }
    } catch (error) {
      job.progress.retrying = 0
      const errorInfo = this.parseError(error)

      if ((errorInfo.type === '403' || errorInfo.type === 'network' || errorInfo.type === '429') && retryCount < maxRetries) {
        // Use longer delay for 429 rate limiting
        const delay = errorInfo.type === '429'
          ? 10000 * (retryCount + 1)  // 10s, 20s, 30s for rate limits
          : 1000 * (retryCount + 1)   // 1s, 2s, 3s for other errors
        console.log(`[PostProcessing] Retrying batch due to exception ${errorInfo.type} (delay ${delay}ms)`)
        await this.delay(delay)
        const retryResult = await this.processAIBatchWithRetry(job, batch, token, originalBatchSize, retryCount + 1)
        result.successful.push(...retryResult.successful)
        result.notSlide.push(...retryResult.notSlide)
        result.failed.push(...retryResult.failed)
        result.pending413.push(...retryResult.pending413)
      } else if (errorInfo.type === '413') {
        result.pending413.push(batch)
      } else {
        console.warn(`[PostProcessing] Batch failed with ${errorInfo.type}: ${errorInfo.message}`)
        result.failed.push(...batch)
        for (const filename of batch) {
          job.errors.push({
            filename,
            errorType: errorInfo.type,
            message: errorInfo.message,
            retryCount
          })
        }
      }
    }

    return result
  }

  // Process 413 batches with smaller sizes
  private async process413Batches(
    job: PostProcessJob,
    batches: string[][],
    token: string | undefined,
    originalBatchSize: number
  ): Promise<AIBatchResult> {
    const result: AIBatchResult = {
      successful: [],
      notSlide: [],
      failed: [],
      pending413: []
    }

    const minBatchSize = Math.max(1, originalBatchSize - 2)

    for (const batch of batches) {
      const newSize = Math.ceil(batch.length / 2)

      if (newSize < minBatchSize || batch.length === 1) {
        // Process individually
        for (const file of batch) {
          const singleResult = await this.processAIBatchWithRetry(job, [file], token, originalBatchSize, 0)
          if (singleResult.pending413.length > 0) {
            result.failed.push(file)
            job.errors.push({
              filename: file,
              errorType: '413',
              message: 'Payload too large even for single image',
              retryCount: 0
            })
          } else {
            result.successful.push(...singleResult.successful)
            result.notSlide.push(...singleResult.notSlide)
            result.failed.push(...singleResult.failed)
          }
        }
      } else {
        // Split into smaller batches
        const newBatches: string[][] = []
        for (let i = 0; i < batch.length; i += newSize) {
          newBatches.push(batch.slice(i, i + newSize))
        }

        console.log(`[PostProcessing] Splitting 413 batch of ${batch.length} into ${newBatches.length} batches`)

        for (const smallerBatch of newBatches) {
          const batchResult = await this.processAIBatchWithRetry(job, smallerBatch, token, originalBatchSize, 0)

          result.successful.push(...batchResult.successful)
          result.notSlide.push(...batchResult.notSlide)
          result.failed.push(...batchResult.failed)

          if (batchResult.pending413.length > 0) {
            const nestedResult = await this.process413Batches(job, batchResult.pending413, token, originalBatchSize)
            result.successful.push(...nestedResult.successful)
            result.notSlide.push(...nestedResult.notSlide)
            result.failed.push(...nestedResult.failed)
          }

          job.progress.aiFiltered = result.notSlide.length
        }
      }
    }

    return result
  }

  // Read images and prepare for AI processing (via main process)
  // Uses Sharp in main process to handle indexed PNG detection and resize
  private async readAndResizeImages(outputPath: string, filenames: string[]): Promise<(string | null)[]> {
    const results: (string | null)[] = []

    for (const filename of filenames) {
      try {
        // Use new readSlideForAI API which handles indexed PNG detection and resize in main process
        const base64 = await window.electronAPI.slideExtraction.readSlideForAI(
          outputPath,
          filename,
          this.imageResizeWidth,
          this.imageResizeHeight
        )
        results.push(base64)
      } catch (error) {
        console.error(`[PostProcessing] Failed to read image ${filename}:`, error)
        results.push(null)
      }
    }

    return results
  }

  // Parse error to determine type
  private parseError(error: unknown): ErrorInfo {
    let errorMessage = ''

    if (error && typeof error === 'object' && 'error' in error) {
      errorMessage = (error as { error?: string }).error || ''
    } else if (error instanceof Error) {
      errorMessage = error.message
    } else if (typeof error === 'string') {
      errorMessage = error
    } else {
      errorMessage = String(error)
    }

    const lowerMessage = errorMessage.toLowerCase()

    if (errorMessage.includes('413') || lowerMessage.includes('payload too large') || lowerMessage.includes('entity too large')) {
      return { type: '413', message: errorMessage }
    }

    if (errorMessage.includes('403') || lowerMessage.includes('forbidden')) {
      return { type: '403', message: errorMessage }
    }

    if (errorMessage.includes('429') || lowerMessage.includes('too many requests') || lowerMessage.includes('rate limit')) {
      return { type: '429', message: errorMessage }
    }

    if (lowerMessage.includes('network') ||
        lowerMessage.includes('econnreset') ||
        lowerMessage.includes('econnrefused') ||
        lowerMessage.includes('etimedout') ||
        lowerMessage.includes('timeout')) {
      return { type: 'network', message: errorMessage }
    }

    const httpCodeMatch = errorMessage.match(/(\d{3})/)
    if (httpCodeMatch) {
      const code = parseInt(httpCodeMatch[1], 10)
      if (code >= 400 && code < 600) {
        return { type: 'http', message: errorMessage }
      }
    }

    return { type: 'unknown', message: errorMessage }
  }

  // Delay helper
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  // Generate unique job ID
  private generateJobId(): string {
    return `pp_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`
  }
}

// Create singleton instance
export const PostProcessingService = new PostProcessingServiceClass()

// Export computed state for reactive access
export const postProcessingState = computed(() => ({
  jobs: PostProcessingService.jobs,
  isProcessing: PostProcessingService.isProcessing,
  activeJobCount: PostProcessingService.activeJobCount,
  queuedJobCount: PostProcessingService.queuedJobCount,
  completedJobCount: PostProcessingService.completedJobCount,
  failedJobCount: PostProcessingService.failedJobCount
}))
