// Make Video queue for the Lectures workspace: one slide video at a time
// (main runs one FFmpeg). Module singleton like DownloadService, so it keeps
// going while the user is on another page, and lives in shared/services so the
// output-folder lock and the close guard can count it. Jobs live in memory
// only; a reload drops the queue (accepted limit, same as the other renderer
// queues).

import { computed, reactive, ref } from 'vue'
import type { SlideVideoOptions } from '@common/slideVideo'
import { createLogger } from '@shared/utils/logger'

const log = createLogger('SlideVideoQueue')

/** One session's inputs (`features/lectures/slideVideoModel` picks them). */
export interface SlideVideoTarget {
  key: string
  displayName: string
  slidesFolder: string
  screenPath: string | null
  micPath: string | null
}

export type SlideVideoJobStatus = 'queued' | 'running' | 'completed' | 'error' | 'cancelled'

export interface SlideVideoJob {
  id: string
  target: SlideVideoTarget
  options: SlideVideoOptions
  status: SlideVideoJobStatus
  progress: number
  error?: string
}

const isPending = (job: SlideVideoJob) => job.status === 'queued' || job.status === 'running'

class SlideVideoQueueClass {
  private items = reactive<SlideVideoJob[]>([])
  private running = false
  private activeJobId: string | null = null
  private unsubscribe: (() => void) | null = null

  readonly activeJob = computed(() => this.items.find((job) => job.id === this.activeJobId) ?? null)
  readonly queuedCount = computed(() => this.items.filter((job) => job.status === 'queued').length)
  /** Queued or running: each will still write into the output folder. */
  readonly pendingFolders = computed(() => new Set(this.items.filter(isPending).map((job) => job.target.slidesFolder)))
  readonly pendingCount = computed(() => this.pendingFolders.value.size)
  readonly hasWork = computed(() => this.pendingCount.value > 0)
  /** Jobs that failed in the last batch, until the next one starts. */
  readonly failed = computed(() => this.items.filter((job) => job.status === 'error'))

  /** How many videos the last Cancel stopped, until the next batch. */
  readonly cancelledCount = ref(0)

  /** Queue each target once; returns how many were added (the rest were already queued). */
  enqueue(targets: SlideVideoTarget[], options: SlideVideoOptions): number {
    this.cancelledCount.value = 0
    if (!this.running) this.clearFinished()
    const pendingFolders = new Set(this.pendingFolders.value)
    let added = 0
    for (const target of targets) {
      if (pendingFolders.has(target.slidesFolder)) continue
      pendingFolders.add(target.slidesFolder)
      this.items.push({
        id: `slidevideo_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        // Plain copies: the job is sent over IPC (Recurring #1).
        target: { ...target },
        options: { ...options },
        status: 'queued',
        progress: 0,
      })
      added += 1
    }
    void this.processQueue()
    return added
  }

  async cancelCurrent(): Promise<void> {
    // Queued jobs go too: Cancel means stop making videos.
    let stopped = this.activeJob.value ? 1 : 0
    for (const job of this.items) {
      if (job.status === 'queued') {
        job.status = 'cancelled'
        stopped += 1
      }
    }
    this.cancelledCount.value = stopped
    try {
      await window.electronAPI.slideVideo.cancel()
    } catch (error) {
      log.warn('cancel failed', error)
    }
  }

  private clearFinished(): void {
    for (let i = this.items.length - 1; i >= 0; i--) if (!isPending(this.items[i])) this.items.splice(i, 1)
  }

  private async processQueue(): Promise<void> {
    if (this.running) return
    this.running = true
    this.unsubscribe ??= window.electronAPI.slideVideo.onProgress((progress) => {
      const job = this.activeJob.value
      if (job) job.progress = Math.max(0, Math.min(100, Math.round(progress.percent)))
    })
    try {
      for (let next = this.items.find((job) => job.status === 'queued'); next; next = this.items.find((job) => job.status === 'queued')) {
        await this.runJob(next)
      }
    } finally {
      this.running = false
      this.activeJobId = null
      this.unsubscribe?.()
      this.unsubscribe = null
      // Done and cancelled rows go; failed ones stay so the page can say so.
      for (let i = this.items.length - 1; i >= 0; i--) {
        if (this.items[i].status === 'completed' || this.items[i].status === 'cancelled') this.items.splice(i, 1)
      }
    }
  }

  private async runJob(job: SlideVideoJob): Promise<void> {
    this.activeJobId = job.id
    job.status = 'running'
    job.progress = 0
    try {
      await window.electronAPI.slideVideo.make({
        slidesFolder: job.target.slidesFolder,
        screenPath: job.target.screenPath,
        micPath: job.target.micPath,
        options: { ...job.options },
      })
      job.status = 'completed'
      job.progress = 100
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      if (/cancelled/i.test(message)) {
        job.status = 'cancelled'
      } else {
        job.status = 'error'
        // IPC wraps the message ("Error invoking remote method …: Error: …").
        job.error = message.replace(/^Error invoking remote method '[^']+': (?:\w*Error: )?/, '')
        log.error('Slide video failed', job.target.displayName, error)
      }
    } finally {
      if (this.activeJobId === job.id) this.activeJobId = null
    }
  }
}

export const SlideVideoQueue = new SlideVideoQueueClass()
