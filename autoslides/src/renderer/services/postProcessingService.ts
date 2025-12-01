import { reactive, computed } from 'vue'
import { TokenManager } from './authService'

// Debug logging flag - set to true for detailed logging
const DEBUG = false

const debugLog = (...args: unknown[]) => {
  if (DEBUG) {
    console.log('[PostProcessing:DEBUG]', ...args)
  }
}

const debugError = (...args: unknown[]) => {
  if (DEBUG) {
    console.error('[PostProcessing:DEBUG:ERROR]', ...args)
  }
}

// Types for post-processing jobs
export type PostProcessJobStatus = 'queued' | 'processing' | 'completed' | 'failed'

export interface PostProcessJobProgress {
  completed: number    // Successfully processed images
  failed: number       // Failed images (after retries)
  total: number        // Total images to process
  retrying: number     // Currently retrying
}

export interface JobError {
  filename: string
  errorType: 'network' | '403' | '413' | 'http' | 'unknown'
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

// Batch processing result
interface BatchResult {
  successful: string[]      // Files classified as 'slide' (kept)
  notSlide: string[]        // Files classified as 'not_slide' (to delete)
  failed: string[]          // Files that failed after retries
  pending413: string[][]    // Batches needing smaller size retry
}

// Error info for retry logic
interface ErrorInfo {
  type: 'network' | '403' | '413' | 'http' | 'unknown'
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

  // Helper function to resize a base64 image using Canvas
  private async resizeBase64Image(
    base64: string,
    targetWidth: number,
    targetHeight: number
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      const img = new Image()
      img.onload = () => {
        // Skip resize if target is same or larger than original
        if (targetWidth >= img.width && targetHeight >= img.height) {
          resolve(base64)
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
        // Return just the base64 part (without data:image/png;base64, prefix)
        const resizedDataUrl = canvas.toDataURL('image/png')
        resolve(resizedDataUrl.replace(/^data:image\/\w+;base64,/, ''))
      }
      img.onerror = () => reject(new Error('Failed to load image for resize'))
      // Add the data URL prefix for the Image to load
      img.src = `data:image/png;base64,${base64}`
    })
  }

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
    debugLog('addJob called', { taskId, outputPath, imageFilesCount: imageFiles.length, imageFiles })

    // Check if job for this task already exists and is not completed/failed
    const existingJob = this.state.jobs.find(
      job => job.taskId === taskId && (job.status === 'queued' || job.status === 'processing')
    )

    if (existingJob) {
      console.log(`[PostProcessing] Job already exists for task ${taskId}, skipping`)
      debugLog('Existing job found, skipping', existingJob)
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
        completed: 0,
        failed: 0,
        total: imageFiles.length,
        retrying: 0
      },
      errors: [],
      createdAt: Date.now()
    }

    this.state.jobs.push(job)
    console.log(`[PostProcessing] Added job ${jobId} for task ${taskId} with ${imageFiles.length} images`)
    debugLog('Job created', job)

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

  // Process a single job
  private async processJob(job: PostProcessJob): Promise<void> {
    console.log(`[PostProcessing] Starting job ${job.id}`)
    job.status = 'processing'
    job.startedAt = Date.now()

    try {
      // Get AI config
      const aiConfig = await window.electronAPI.config?.getAIFilteringConfig?.()
      const batchSize = aiConfig?.batchSize || 4
      const enableAIFiltering = await window.electronAPI.config?.getEnableAIFiltering?.() ?? true

      // Update image resize config
      this.imageResizeWidth = aiConfig?.imageResizeWidth || 768
      this.imageResizeHeight = aiConfig?.imageResizeHeight || 432

      if (!enableAIFiltering) {
        console.log(`[PostProcessing] AI filtering disabled, marking job as completed`)
        job.status = 'completed'
        job.completedAt = Date.now()
        job.progress.completed = job.progress.total
        return
      }

      const token = this.tokenManager.getToken() || undefined

      // Process images with retry logic
      const result = await this.processImagesWithRetry(
        job,
        batchSize,
        token
      )

      // Delete images classified as not_slide
      for (const filename of result.notSlide) {
        try {
          await window.electronAPI.slideExtraction.deleteSlide(job.outputPath, filename)
          console.log(`[PostProcessing] Deleted not_slide: ${filename}`)
        } catch (deleteError) {
          console.error(`[PostProcessing] Failed to delete ${filename}:`, deleteError)
        }
      }

      // Update job status
      job.completedAt = Date.now()
      if (result.failed.length > 0 && result.successful.length === 0 && result.notSlide.length === 0) {
        job.status = 'failed'
      } else {
        job.status = 'completed'
      }

      console.log(`[PostProcessing] Job ${job.id} completed:`, {
        kept: result.successful.length,
        deleted: result.notSlide.length,
        failed: result.failed.length
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
    }
  }

  // Process images with sophisticated retry logic
  private async processImagesWithRetry(
    job: PostProcessJob,
    batchSize: number,
    token: string | undefined
  ): Promise<BatchResult> {
    const result: BatchResult = {
      successful: [],
      notSlide: [],
      failed: [],
      pending413: []
    }

    // Divide images into batches
    const batches: string[][] = []
    for (let i = 0; i < job.imageFiles.length; i += batchSize) {
      batches.push(job.imageFiles.slice(i, i + batchSize))
    }

    console.log(`[PostProcessing] Processing ${job.imageFiles.length} images in ${batches.length} batches`)

    // Track pending 413 batches
    const pending413Batches: string[][] = []

    // Process each batch
    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i]
      const batchResult = await this.processBatchWithRetry(
        job,
        batch,
        token,
        batchSize // original batch size for 413 splitting reference
      )

      result.successful.push(...batchResult.successful)
      result.notSlide.push(...batchResult.notSlide)
      result.failed.push(...batchResult.failed)

      if (batchResult.pending413.length > 0) {
        pending413Batches.push(...batchResult.pending413)
      }

      // Update progress
      job.progress.completed = result.successful.length + result.notSlide.length
      job.progress.failed = result.failed.length
    }

    // Process 413 pending batches with smaller sizes
    if (pending413Batches.length > 0) {
      console.log(`[PostProcessing] Processing ${pending413Batches.length} pending 413 batches`)
      const pending413Result = await this.process413Batches(
        job,
        pending413Batches,
        token,
        batchSize
      )
      result.successful.push(...pending413Result.successful)
      result.notSlide.push(...pending413Result.notSlide)
      result.failed.push(...pending413Result.failed)

      job.progress.completed = result.successful.length + result.notSlide.length
      job.progress.failed = result.failed.length
    }

    return result
  }

  // Process a single batch with retry logic
  private async processBatchWithRetry(
    job: PostProcessJob,
    batch: string[],
    token: string | undefined,
    originalBatchSize: number,
    retryCount = 0
  ): Promise<BatchResult> {
    debugLog('processBatchWithRetry called', {
      jobId: job.id,
      batchSize: batch.length,
      batch,
      hasToken: !!token,
      originalBatchSize,
      retryCount
    })

    const result: BatchResult = {
      successful: [],
      notSlide: [],
      failed: [],
      pending413: []
    }

    const maxRetries = 2

    try {
      // Read images from files
      debugLog('Reading images from files...', { outputPath: job.outputPath, files: batch })
      const base64Images = await this.readImagesAsBase64(job.outputPath, batch)
      debugLog('Images read result', {
        totalRequested: batch.length,
        successfullyRead: base64Images.filter(Boolean).length,
        failedToRead: base64Images.filter(x => !x).length
      })

      if (base64Images.length === 0) {
        // All images failed to read
        debugError('All images failed to read')
        result.failed.push(...batch)
        return result
      }

      // Filter out images that failed to read
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
        debugError('No valid images after filtering')
        return result
      }

      // Resize images if needed (reduces payload size for AI)
      const resizedBase64: string[] = []
      if (this.imageResizeWidth < 1920 || this.imageResizeHeight < 1080) {
        debugLog('Resizing images before AI classification', {
          targetWidth: this.imageResizeWidth,
          targetHeight: this.imageResizeHeight
        })
        for (let i = 0; i < validBase64.length; i++) {
          try {
            const resized = await this.resizeBase64Image(
              validBase64[i],
              this.imageResizeWidth,
              this.imageResizeHeight
            )
            resizedBase64.push(resized)
          } catch (resizeError) {
            console.warn(`[PostProcessing] Failed to resize image ${validBatch[i]}, using original:`, resizeError)
            resizedBase64.push(validBase64[i])
          }
        }
      } else {
        // No resize needed, use original
        resizedBase64.push(...validBase64)
      }

      // Update in-progress count
      job.progress.retrying = validBatch.length

      // Call AI classification - always use batch API in recorded mode
      debugLog('Calling AI classification', {
        imageCount: validBatch.length,
        imageSizes: resizedBase64.map(b64 => b64.length)
      })

      const startTime = Date.now()

      debugLog('Calling classifyMultipleImages...')
      const aiResult = await window.electronAPI.ai.classifyMultipleImages(
        resizedBase64,
        'recorded',
        token
      ) as AIClassificationResult

      const endTime = Date.now()
      debugLog('AI classification response received', {
        duration: `${endTime - startTime}ms`,
        success: aiResult.success,
        hasResult: !!aiResult.result,
        error: aiResult.error,
        result: aiResult.result
      })

      job.progress.retrying = 0

      if (aiResult.success && aiResult.result) {
        // Process successful result - always use batch format (zero-based indexing)
        for (let j = 0; j < validBatch.length; j++) {
          const key = `image_${j}`
          const classification = aiResult.result[key] || 'slide'
          debugLog('Batch image classification', { filename: validBatch[j], key, classification })
          if (classification === 'slide') {
            result.successful.push(validBatch[j])
          } else {
            result.notSlide.push(validBatch[j])
          }
        }
      } else {
        // Handle error
        const errorInfo = this.parseError(aiResult.error)
        debugError('AI classification failed', { errorInfo, rawError: aiResult.error })

        if (errorInfo.type === '413') {
          // Queue for smaller batch retry
          debugLog('413 error - queuing for smaller batch retry')
          result.pending413.push(validBatch)
        } else if ((errorInfo.type === '403' || errorInfo.type === 'network') && retryCount < maxRetries) {
          // Retry for 403 and network errors
          console.log(`[PostProcessing] Retrying batch due to ${errorInfo.type} (attempt ${retryCount + 1}/${maxRetries})`)
          debugLog('Retrying batch', { errorType: errorInfo.type, retryCount, maxRetries })
          job.progress.retrying = validBatch.length
          await this.delay(1000 * (retryCount + 1)) // Exponential backoff
          const retryResult = await this.processBatchWithRetry(
            job,
            validBatch,
            token,
            originalBatchSize,
            retryCount + 1
          )
          result.successful.push(...retryResult.successful)
          result.notSlide.push(...retryResult.notSlide)
          result.failed.push(...retryResult.failed)
          result.pending413.push(...retryResult.pending413)
        } else {
          // Mark as failed after max retries
          debugError('Max retries exceeded or non-retryable error', { errorInfo, retryCount })
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
      debugError('Exception during batch processing', error)
      const errorInfo = this.parseError(error)

      if ((errorInfo.type === '403' || errorInfo.type === 'network') && retryCount < maxRetries) {
        console.log(`[PostProcessing] Retrying batch due to exception ${errorInfo.type} (attempt ${retryCount + 1}/${maxRetries})`)
        await this.delay(1000 * (retryCount + 1))
        const retryResult = await this.processBatchWithRetry(
          job,
          batch,
          token,
          originalBatchSize,
          retryCount + 1
        )
        result.successful.push(...retryResult.successful)
        result.notSlide.push(...retryResult.notSlide)
        result.failed.push(...retryResult.failed)
        result.pending413.push(...retryResult.pending413)
      } else if (errorInfo.type === '413') {
        result.pending413.push(batch)
      } else {
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

    debugLog('processBatchWithRetry result', result)
    return result
  }

  // Process 413 batches with smaller sizes
  private async process413Batches(
    job: PostProcessJob,
    batches: string[][],
    token: string | undefined,
    originalBatchSize: number
  ): Promise<BatchResult> {
    const result: BatchResult = {
      successful: [],
      notSlide: [],
      failed: [],
      pending413: []
    }

    // Min batch size is batchSize - 2, but at least 1
    const minBatchSize = Math.max(1, originalBatchSize - 2)

    for (const batch of batches) {
      const newSize = Math.ceil(batch.length / 2)

      if (newSize < minBatchSize || batch.length === 1) {
        // Can't split further, process individually or mark as failed
        if (batch.length === 1) {
          // Try one more time with single image
          const singleResult = await this.processBatchWithRetry(
            job,
            batch,
            token,
            originalBatchSize,
            0 // Reset retry count for smaller batch
          )

          // If still 413, mark as failed
          if (singleResult.pending413.length > 0) {
            result.failed.push(...batch)
            job.errors.push({
              filename: batch[0],
              errorType: '413',
              message: 'Payload too large even for single image',
              retryCount: 0
            })
          } else {
            result.successful.push(...singleResult.successful)
            result.notSlide.push(...singleResult.notSlide)
            result.failed.push(...singleResult.failed)
          }
        } else {
          // Process each image individually as last resort
          for (const file of batch) {
            const singleResult = await this.processBatchWithRetry(
              job,
              [file],
              token,
              originalBatchSize,
              0
            )
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
        }
      } else {
        // Split into smaller batches
        const newBatches: string[][] = []
        for (let i = 0; i < batch.length; i += newSize) {
          newBatches.push(batch.slice(i, i + newSize))
        }

        console.log(`[PostProcessing] Splitting 413 batch of ${batch.length} into ${newBatches.length} batches of ~${newSize}`)

        for (const smallerBatch of newBatches) {
          const batchResult = await this.processBatchWithRetry(
            job,
            smallerBatch,
            token,
            originalBatchSize,
            0 // Reset retry count for smaller batch
          )

          result.successful.push(...batchResult.successful)
          result.notSlide.push(...batchResult.notSlide)
          result.failed.push(...batchResult.failed)

          // Handle nested 413 by recursive call
          if (batchResult.pending413.length > 0) {
            const nestedResult = await this.process413Batches(
              job,
              batchResult.pending413,
              token,
              originalBatchSize
            )
            result.successful.push(...nestedResult.successful)
            result.notSlide.push(...nestedResult.notSlide)
            result.failed.push(...nestedResult.failed)
          }

          job.progress.completed = result.successful.length + result.notSlide.length
          job.progress.failed = result.failed.length
        }
      }
    }

    return result
  }

  // Read images from files as base64
  private async readImagesAsBase64(outputPath: string, filenames: string[]): Promise<(string | null)[]> {
    const results: (string | null)[] = []

    for (const filename of filenames) {
      try {
        const base64 = await window.electronAPI.slideExtraction.readSlideAsBase64(outputPath, filename)
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

    // Check for 413
    if (errorMessage.includes('413') || lowerMessage.includes('payload too large') || lowerMessage.includes('entity too large')) {
      return { type: '413', message: errorMessage }
    }

    // Check for 403
    if (errorMessage.includes('403') || lowerMessage.includes('forbidden')) {
      return { type: '403', message: errorMessage }
    }

    // Check for network errors
    if (lowerMessage.includes('network') ||
        lowerMessage.includes('econnreset') ||
        lowerMessage.includes('econnrefused') ||
        lowerMessage.includes('etimedout') ||
        lowerMessage.includes('timeout')) {
      return { type: 'network', message: errorMessage }
    }

    // Check for other HTTP errors
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
