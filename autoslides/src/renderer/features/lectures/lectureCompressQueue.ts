// Sequential compress queue for the Lectures workspace.
// Module singleton (like DownloadService): survives navigating away from Lectures
// while the main-process ffmpeg job continues. Concurrency is hard-capped at 1.
//
// After a successful replace-in-place encode, the basename gains
// `[ascomp={preset}]` so the list can badge "compressed" and skip re-encode
// when the same preset is requested again.

import { reactive, computed } from 'vue'
import type { LectureCompressDefaults } from '@common/types'
import {
  withAscompTag,
  type LectureCompressPresetTag,
} from '@common/lectureVideoNaming'
import { createLogger } from '@shared/utils/logger'

const log = createLogger('LectureCompressQueue')

export type CompressJobStatus =
  | 'queued'
  | 'preparing'
  | 'encoding'
  | 'validating'
  | 'completed'
  | 'error'
  | 'cancelled'
  | 'skipped'

export interface CompressJob {
  id: string
  inputPath: string
  displayName: string
  /** Current on-disk basename (updated after ascomp rename). */
  fileName: string
  /** Existing [ascomp=…] if any — used to skip when it matches the job preset. */
  compressPreset?: LectureCompressPresetTag
  options: LectureCompressDefaults
  status: CompressJobStatus
  progress: number
  message?: string
  error?: string
  addedAt: number
  startedAt?: number
  completedAt?: number
}

export interface CompressEnqueueFile {
  path: string
  displayName: string
  fileName: string
  compressPreset?: LectureCompressPresetTag
}

export interface CompressEnqueueResult {
  added: number
  skipped: number
}

type ProgressPayload = {
  phase: 'preparing' | 'cropdetect' | 'encoding' | 'validating' | 'completed'
  current: number
  total: number
  message?: string
}

class LectureCompressQueueClass {
  private items = reactive<CompressJob[]>([])
  private running = false
  private activeJobId: string | null = null
  private unsubProgress: (() => void) | null = null
  private unsubCompleted: (() => void) | null = null
  private unsubError: (() => void) | null = null
  private listenersAttached = false

  get state() {
    return this.items
  }

  readonly activeJob = computed(() =>
    this.items.find((j) => j.id === this.activeJobId) ?? null,
  )

  readonly queuedCount = computed(
    () => this.items.filter((j) => j.status === 'queued').length,
  )

  readonly hasWork = computed(
    () =>
      this.items.some(
        (j) =>
          j.status === 'queued' ||
          j.status === 'preparing' ||
          j.status === 'encoding' ||
          j.status === 'validating',
      ),
  )

  private ensureListeners(): void {
    if (this.listenersAttached) return
    const api = window.electronAPI?.compressLecture
    if (!api) return

    this.unsubProgress = api.onProgress((progress: ProgressPayload) => {
      const job = this.activeJobId
        ? this.items.find((j) => j.id === this.activeJobId)
        : null
      if (!job) return
      if (progress.phase === 'preparing' || progress.phase === 'cropdetect') {
        job.status = 'preparing'
      } else if (progress.phase === 'validating') {
        job.status = 'validating'
      } else if (progress.phase === 'encoding') {
        job.status = 'encoding'
      }
      job.progress = Math.min(100, Math.max(0, progress.current))
      job.message = progress.message
    })

    // completed/error events also fire around the start() promise; we still
    // drive the queue off the await below. Listeners keep UI snappy.
    this.unsubCompleted = api.onCompleted(() => {
      /* handled in run loop */
    })
    this.unsubError = api.onError(() => {
      /* handled in run loop */
    })

    this.listenersAttached = true
  }

  enqueue(
    files: CompressEnqueueFile[],
    options: LectureCompressDefaults,
  ): CompressEnqueueResult {
    this.ensureListeners()
    let added = 0
    let skipped = 0
    const preset = options.preset as LectureCompressPresetTag

    for (const file of files) {
      // Already compressed with this same preset — do not re-encode.
      if (file.compressPreset && file.compressPreset === preset) {
        skipped += 1
        continue
      }

      const duplicate = this.items.find(
        (j) =>
          j.inputPath === file.path &&
          (j.status === 'queued' ||
            j.status === 'preparing' ||
            j.status === 'encoding' ||
            j.status === 'validating'),
      )
      if (duplicate) {
        skipped += 1
        continue
      }

      this.items.push({
        id: `compress_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        inputPath: file.path,
        displayName: file.displayName,
        fileName: file.fileName,
        compressPreset: file.compressPreset,
        options: { ...options },
        status: 'queued',
        progress: 0,
        addedAt: Date.now(),
      })
      added += 1
    }
    void this.processQueue()
    return { added, skipped }
  }

  async cancelCurrent(): Promise<void> {
    try {
      await window.electronAPI.compressLecture.cancel()
    } catch (error) {
      log.warn('cancel failed', error)
    }
    const job = this.activeJobId
      ? this.items.find((j) => j.id === this.activeJobId)
      : null
    if (job && (job.status === 'preparing' || job.status === 'encoding' || job.status === 'validating')) {
      job.status = 'cancelled'
      job.completedAt = Date.now()
      job.message = 'Cancelled'
    }
  }

  removeQueued(id: string): void {
    const idx = this.items.findIndex((j) => j.id === id && j.status === 'queued')
    if (idx >= 0) this.items.splice(idx, 1)
  }

  clearFinished(): void {
    for (let i = this.items.length - 1; i >= 0; i--) {
      const s = this.items[i].status
      if (s === 'completed' || s === 'error' || s === 'cancelled' || s === 'skipped') {
        this.items.splice(i, 1)
      }
    }
  }

  retry(id: string): void {
    const job = this.items.find((j) => j.id === id)
    if (!job || (job.status !== 'error' && job.status !== 'cancelled')) return
    job.status = 'queued'
    job.progress = 0
    job.error = undefined
    job.message = undefined
    job.startedAt = undefined
    job.completedAt = undefined
    // Move to end
    const idx = this.items.indexOf(job)
    if (idx >= 0) {
      this.items.splice(idx, 1)
      this.items.push(job)
    }
    void this.processQueue()
  }

  private async processQueue(): Promise<void> {
    if (this.running) return
    this.running = true
    try {
      while (true) {
        const next = this.items.find((j) => j.status === 'queued')
        if (!next) break
        await this.runJob(next)
      }
    } finally {
      this.running = false
      this.activeJobId = null
      // Batch finished (or cancelled through) — drop completed/error/cancelled
      // rows so the Lectures progress strip unmounts without a Clear button.
      this.clearFinished()
    }
  }

  private async runJob(job: CompressJob): Promise<void> {
    this.activeJobId = job.id
    job.status = 'preparing'
    job.progress = 0
    job.startedAt = Date.now()
    job.error = undefined

    try {
      await window.electronAPI.compressLecture.start({
        inputPath: job.inputPath,
        replaceSource: true,
        preset: job.options.preset,
        audioPreset: job.options.audioPreset,
        audioFilterPreset: job.options.audioFilterPreset,
        cropMode: job.options.cropMode,
        filterMode: job.options.filterMode,
        scaler: job.options.scaler,
        container: job.options.container,
        opusVbr: job.options.opusVbr,
        opusFrameDuration: job.options.opusFrameDuration,
        keepAac: job.options.keepAac,
        x265Params: job.options.x265Params,
      })
      // cancelCurrent may flip status while start() is awaiting (TS can't see that).
      if ((job.status as CompressJobStatus) === 'cancelled') return

      // Stamp [ascomp={preset}] on the basename (after replace kept the same path).
      const preset = job.options.preset as LectureCompressPresetTag
      const taggedName = withAscompTag(job.fileName, preset)
      if (taggedName !== job.fileName) {
        try {
          const renamed = await window.electronAPI.lectures.rename(
            job.inputPath,
            taggedName,
          )
          job.inputPath = renamed.path
          job.fileName = renamed.name
          job.compressPreset = preset
        } catch (renameError) {
          // Encode succeeded; tagging is best-effort so the user still has a
          // smaller file even if the rename collides or fails.
          log.warn('Failed to apply ascomp tag after compress', job.fileName, renameError)
        }
      } else {
        job.compressPreset = preset
      }

      job.status = 'completed'
      job.progress = 100
      job.completedAt = Date.now()
      job.message = 'Completed'
    } catch (error) {
      if ((job.status as CompressJobStatus) === 'cancelled') return
      const message = error instanceof Error ? error.message : String(error)
      if (/cancell?ed/i.test(message)) {
        job.status = 'cancelled'
        job.message = 'Cancelled'
      } else {
        job.status = 'error'
        job.error = message
        job.message = message
        log.error('Compress job failed', job.displayName, error)
      }
      job.completedAt = Date.now()
    } finally {
      if (this.activeJobId === job.id) this.activeJobId = null
    }
  }
}

export const LectureCompressQueue = new LectureCompressQueueClass()
