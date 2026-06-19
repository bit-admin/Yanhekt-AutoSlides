import { reactive, computed } from 'vue'
import { tokenManager } from './authService'
import { PostProcessingPipeline } from '@shared/postProcessing/pipeline'
import { createSlideExtractionDataSource } from '@shared/postProcessing/imageSources'
import type {
  AIErrorKind,
  ClassifierCallbacks,
  PostProcessingConfig,
  PostProcessingProgress
} from '@shared/postProcessing/types'
import { createLogger } from '@shared/utils/logger';
const log = createLogger('ServicesPostProcessing');

// Task-queue post-processing jobs. Adapter around the unified pipeline at
// renderer/postProcessing — owns the job-state map that RightPanel.vue and
// extractionQueueService.ts read from, plus the queue execution loop.

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
  errorType: 'network' | 'timeout' | '403' | '413' | '429' | 'quota_exceeded' | 'service_unavailable' | 'parse_failed' | 'http' | 'unknown'
  errorKind?: AIErrorKind
  message: string
  retryCount: number
}

export interface PostProcessJob {
  id: string
  taskId: string
  outputPath: string
  imageFiles: string[]
  status: PostProcessJobStatus
  progress: PostProcessJobProgress
  errors: JobError[]
  createdAt: number
  startedAt?: number
  completedAt?: number
  // Resolved AI classifier mode for this run, frozen when the job starts
  // processing. Only `'llm'` jobs are cancellable (ML inference is local and
  // fast). Undefined until the job begins.
  classifierMode?: 'llm' | 'ml'
  // Set when the user requests cancellation of the AI phase. Drives the UI's
  // "cancelling…" affordance; the pipeline aborts at the next batch boundary.
  cancelRequested?: boolean
}

export interface PostProcessingServiceState {
  jobs: PostProcessJob[]
  isProcessing: boolean
}

class PostProcessingServiceClass {
  private state: PostProcessingServiceState = reactive({
    jobs: [],
    isProcessing: false
  })

  private processingPromise: Promise<void> | null = null
  // Per-job abort controllers, live only while a job is processing. Used to
  // cancel the in-flight AI (phase 3) run in LLM mode.
  private controllers = new Map<string, AbortController>()
  // Injected once at startup by the renderer entrypoint. shared/ cannot import
  // from features/ai/, so the renderer wires the callbacks here after import.
  private classifier: ClassifierCallbacks | null = null
  // Subscribers notified on every job status transition. Lets the extraction
  // orchestrator watch a job's terminal state without polling.
  private subscribers = new Set<(job: PostProcessJob) => void>()

  setClassifier(callbacks: ClassifierCallbacks): void {
    this.classifier = callbacks
  }

  /** Subscribe to job status transitions. Returns an unsubscribe function. */
  subscribe(handler: (job: PostProcessJob) => void): () => void {
    this.subscribers.add(handler)
    return () => this.subscribers.delete(handler)
  }

  private notify(job: PostProcessJob): void {
    for (const handler of this.subscribers) {
      try {
        handler(job)
      } catch (err) {
        log.error('[PostProcessing] subscriber error:', err)
      }
    }
  }

  get jobs() { return this.state.jobs }
  get isProcessing() { return this.state.isProcessing }
  get activeJobCount() { return this.state.jobs.filter(j => j.status === 'processing').length }
  get queuedJobCount() { return this.state.jobs.filter(j => j.status === 'queued').length }
  get completedJobCount() { return this.state.jobs.filter(j => j.status === 'completed').length }
  get failedJobCount() { return this.state.jobs.filter(j => j.status === 'failed').length }

  getJobByTaskId(taskId: string): PostProcessJob | undefined {
    return this.state.jobs.find(job => job.taskId === taskId)
  }

  getJob(jobId: string): PostProcessJob | undefined {
    return this.state.jobs.find(job => job.id === jobId)
  }

  /**
   * Cancel the AI (phase 3) classification of a running job. Only valid in LLM
   * mode and while phase 3 is active — ML classification is local/fast and not
   * cancellable. Batches already classified (their API responses applied) are
   * preserved on disk; the pipeline stops at the next batch boundary and the
   * job resolves as completed.
   */
  cancelJob(jobId: string): void {
    const job = this.getJob(jobId)
    if (!job || job.status !== 'processing') return
    if (job.classifierMode !== 'llm') return
    if (job.progress.phase !== 'phase3') return
    job.cancelRequested = true
    this.controllers.get(jobId)?.abort()
  }

  addJob(taskId: string, outputPath: string, imageFiles: string[]): string {
    const existing = this.state.jobs.find(
      job => job.taskId === taskId && (job.status === 'queued' || job.status === 'processing')
    )
    if (existing) {
      log.debug(`[PostProcessing] Job already exists for task ${taskId}, skipping`)
      return existing.id
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
    log.debug(`[PostProcessing] Added job ${jobId} for task ${taskId} with ${imageFiles.length} images`)
    this.startProcessing()
    return jobId
  }

  removeJob(jobId: string): void {
    const index = this.state.jobs.findIndex(job => job.id === jobId)
    if (index !== -1) {
      const [removed] = this.state.jobs.splice(index, 1)
      // Wake any watcher so it stops waiting on a job that no longer exists.
      if (removed) this.notify(removed)
    }
  }

  clearCompleted(): void {
    this.state.jobs = this.state.jobs.filter(
      job => job.status !== 'completed' && job.status !== 'failed'
    )
  }

  private startProcessing(): void {
    if (this.processingPromise) return
    this.state.isProcessing = true
    this.processingPromise = this.processQueue().finally(() => {
      this.processingPromise = null
      this.state.isProcessing = false
    })
  }

  private async processQueue(): Promise<void> {
    let next = this.state.jobs.find(job => job.status === 'queued')
    while (next) {
      await this.processJob(next)
      next = this.state.jobs.find(job => job.status === 'queued')
    }
  }

  private async processJob(job: PostProcessJob): Promise<void> {
    log.debug(`[PostProcessing] Starting job ${job.id}`)
    job.status = 'processing'
    job.startedAt = Date.now()
    const controller = new AbortController()
    this.controllers.set(job.id, controller)
    this.notify(job)

    try {
      const { config, classifierMode } = await this.loadConfig()
      job.classifierMode = classifierMode
      const dataSource = createSlideExtractionDataSource(job.outputPath)
      const token = tokenManager.getToken() || undefined

      const result = await PostProcessingPipeline.run(
        {
          outputPath: job.outputPath,
          imageFiles: job.imageFiles,
          config,
          promptType: 'recorded',
          token
        },
        dataSource,
        {
          signal: controller.signal,
          onProgress: (snap) => this.mirrorProgress(job, snap),
          classifier: this.classifier ?? undefined
        }
      )

      for (const f of result.failed) {
        job.errors.push({
          filename: f.filename,
          errorType: f.errorType as JobError['errorType'],
          errorKind: f.errorKind,
          message: f.message,
          retryCount: f.retryCount
        })
      }

      job.progress.duplicatesRemoved = result.duplicatesRemoved.length
      job.progress.excludedRemoved = result.excludedRemoved.length
      job.progress.aiFiltered = result.aiNotSlide.length + result.aiMaybeSlideEdit.length
      job.progress.failed = result.failed.length
      job.progress.phase = 'completed'
      job.completedAt = Date.now()

      // A 'cancelled' pipeline result is a SUCCESS, not a failure. This covers
      // both the (legacy) extraction-abort path and a user-initiated AI cancel
      // (cancelJob): the pipeline already applied every trash move it completed
      // before the abort, and the un-classified remainder is correctly kept as
      // slides. Only a genuinely thrown pipeline error ('failed') is an error.
      // The orchestrator's watchPostProcessingJob branches solely on
      // 'completed' vs 'failed', so mapping cancel→completed makes the download
      // item finish as 'completed' (POSTPROCESS_DONE) rather than 'error'.
      job.status = result.status === 'failed' ? 'failed' : 'completed'

      log.debug(`[PostProcessing] Job ${job.id} ${job.status}:`, {
        duplicatesRemoved: job.progress.duplicatesRemoved,
        excludedRemoved: job.progress.excludedRemoved,
        aiFiltered: job.progress.aiFiltered,
        failed: job.progress.failed
      })
      this.notify(job)
    } catch (error) {
      log.error(`[PostProcessing] Job ${job.id} failed:`, error)
      job.status = 'failed'
      job.completedAt = Date.now()
      job.errors.push({
        filename: '*',
        errorType: 'unknown',
        message: error instanceof Error ? error.message : String(error),
        retryCount: 0
      })
      this.notify(job)
    } finally {
      this.controllers.delete(job.id)
    }
  }

  private mirrorProgress(job: PostProcessJob, snap: PostProcessingProgress): void {
    const p = job.progress
    switch (snap.phase) {
      case 'phase1':
        p.phase = 'phase1'
        p.currentIndex = snap.phase1.processed
        p.total = snap.phase1.total
        p.duplicatesRemoved = snap.phase1.duplicatesRemoved
        break
      case 'phase2':
        p.phase = 'phase2'
        p.currentIndex = snap.phase2.processed
        p.total = snap.phase2.total
        p.excludedRemoved = snap.phase2.excludedRemoved
        break
      case 'phase3':
        p.phase = 'phase3'
        p.currentIndex = snap.phase3.processed
        p.total = snap.phase3.total
        p.aiFiltered = snap.phase3.aiFiltered + snap.phase3.aiFilteredEdit
        p.retrying = snap.phase3.retrying
        p.failed = snap.phase3.failed
        break
      case 'completed':
      case 'cancelled':
      case 'failed':
        p.phase = 'completed'
        break
      case 'idle':
      default:
        break
    }
  }

  private async loadConfig(): Promise<{ config: PostProcessingConfig; classifierMode: 'llm' | 'ml' }> {
    const slideConfig = await window.electronAPI.config?.getSlideExtractionConfig?.()
    const enableAIFiltering = await window.electronAPI.config?.getEnableAIFiltering?.() ?? true
    const aiConfig = await window.electronAPI.config?.getAIFilteringConfig?.()

    const exclusionList = (slideConfig?.pHashExclusionList || []).filter(
      (item: { isPreset?: boolean; isEnabled?: boolean }) =>
        !item.isPreset || item.isEnabled !== false
    )

    return {
      config: {
        pHashThreshold: slideConfig?.pHashThreshold || 10,
        enableDuplicateRemoval: slideConfig?.enableDuplicateRemoval !== false,
        enableExclusionList: slideConfig?.enableExclusionList !== false,
        enableAIFiltering,
        exclusionList,
        aiBatchSize: aiConfig?.batchSize || 5,
        aiImageResizeWidth: aiConfig?.imageResizeWidth || 768,
        aiImageResizeHeight: aiConfig?.imageResizeHeight || 432
      },
      classifierMode: aiConfig?.classifierMode === 'ml' ? 'ml' : 'llm'
    }
  }

  private generateJobId(): string {
    return `pp_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`
  }
}

export const PostProcessingService = new PostProcessingServiceClass()

export const postProcessingState = computed(() => ({
  jobs: PostProcessingService.jobs,
  isProcessing: PostProcessingService.isProcessing,
  activeJobCount: PostProcessingService.activeJobCount,
  queuedJobCount: PostProcessingService.queuedJobCount,
  completedJobCount: PostProcessingService.completedJobCount,
  failedJobCount: PostProcessingService.failedJobCount
}))
