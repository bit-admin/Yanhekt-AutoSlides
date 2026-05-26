import { reactive, computed } from 'vue'
import { tokenManager } from './authService'
import { PostProcessingPipeline } from '../postProcessing/pipeline'
import { createSlideExtractionDataSource } from '../postProcessing/imageSources'
import type {
  AIErrorKind,
  PostProcessingConfig,
  PostProcessingProgress
} from '../postProcessing/types'

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

  addJob(taskId: string, outputPath: string, imageFiles: string[]): string {
    const existing = this.state.jobs.find(
      job => job.taskId === taskId && (job.status === 'queued' || job.status === 'processing')
    )
    if (existing) {
      console.log(`[PostProcessing] Job already exists for task ${taskId}, skipping`)
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
    console.log(`[PostProcessing] Added job ${jobId} for task ${taskId} with ${imageFiles.length} images`)
    this.startProcessing()
    return jobId
  }

  removeJob(jobId: string): void {
    const index = this.state.jobs.findIndex(job => job.id === jobId)
    if (index !== -1) this.state.jobs.splice(index, 1)
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
    console.log(`[PostProcessing] Starting job ${job.id}`)
    job.status = 'processing'
    job.startedAt = Date.now()

    try {
      const config = await this.loadConfig()
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
          onProgress: (snap) => this.mirrorProgress(job, snap)
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

      // 'cancelled' is treated like 'completed' for queue progression — the pipeline
      // already applied whatever trash moves it managed before abort. The queue
      // watcher in extractionQueueService only branches on 'completed' vs 'failed'.
      job.status = result.status === 'failed' ? 'failed' : 'completed'

      console.log(`[PostProcessing] Job ${job.id} ${job.status}:`, {
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

  private async loadConfig(): Promise<PostProcessingConfig> {
    const slideConfig = await window.electronAPI.config?.getSlideExtractionConfig?.()
    const enableAIFiltering = await window.electronAPI.config?.getEnableAIFiltering?.() ?? true
    const aiConfig = await window.electronAPI.config?.getAIFilteringConfig?.()

    const exclusionList = (slideConfig?.pHashExclusionList || []).filter(
      (item: { isPreset?: boolean; isEnabled?: boolean }) =>
        !item.isPreset || item.isEnabled !== false
    )

    return {
      pHashThreshold: slideConfig?.pHashThreshold || 10,
      enableDuplicateRemoval: slideConfig?.enableDuplicateRemoval !== false,
      enableExclusionList: slideConfig?.enableExclusionList !== false,
      enableAIFiltering,
      exclusionList,
      aiBatchSize: aiConfig?.batchSize || 5,
      aiImageResizeWidth: aiConfig?.imageResizeWidth || 768,
      aiImageResizeHeight: aiConfig?.imageResizeHeight || 432
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
