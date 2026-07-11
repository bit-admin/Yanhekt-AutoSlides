// Effectful orchestrator for the download→extract→post-process chain (Chain A).
//
// This is the *single writer* of a DownloadItem's extraction state. It owns the
// serial worker loop, the qtExtractor / slideExtraction IPC, and the wake-up
// mechanism. Every status transition goes through `apply(item, event)`, which
// runs the event through the pure `reduceExtraction` machine and applies the
// returned patch — there are no ad-hoc `item.extractionStatus = …` writes.
//
// It reads the job list through an injected provider (registered by
// DownloadService) rather than importing DownloadService as a value, which
// breaks the former runtime import cycle and keeps the orchestrator decoupled
// from the queue that happens to store the items.

import type { DownloadItem } from '@shared/services/downloadService'
import { PostProcessingService } from '@shared/services/postProcessingService'
import { sanitizeDownloadName } from '@shared/services/downloadNaming'
import {
  computePendingExtractionFields,
  hasRequiredExtractionParams
} from '@shared/services/extractionQueueLogic'
import { configStore } from '@shared/services/configStore'
import { recordRecordedExtraction } from '@shared/services/slideMetadataClient'
import { reduceExtraction, type ExtractionEvent } from './extractionMachine'
import { createLogger } from '@shared/utils/logger';
const log = createLogger('ExtractionOrchestrator');

export interface ExtractorStatusSnapshot {
  ok: boolean
  path: string
  resolvedPath: string
  version?: string
  error?: string
}

export class ExtractionOrchestrator {
  private extractorReady = false
  private extractorStatus: ExtractorStatusSnapshot | null = null
  private statusInitialized = false
  private statusInitPromise: Promise<ExtractorStatusSnapshot> | null = null
  private workerRunning = false
  private wakeUp: (() => void) | null = null
  private listenersAttached = false
  private jobProvider: (() => DownloadItem[]) | null = null

  /**
   * Inject the source of download items. Called once by DownloadService so the
   * orchestrator never imports the queue module as a value (breaks the cycle).
   */
  setJobProvider(provider: () => DownloadItem[]): void {
    this.jobProvider = provider
  }

  private get items(): DownloadItem[] {
    return this.jobProvider?.() ?? []
  }

  /**
   * The ONLY place a DownloadItem's extraction status/progress/error is written.
   * Runs the event through the pure machine and applies its patch (if any).
   */
  private apply(item: DownloadItem, event: ExtractionEvent): void {
    const patch = reduceExtraction(item.extractionStatus, event)
    if (!patch) return
    if (patch.status !== undefined) item.extractionStatus = patch.status
    if (patch.progress !== undefined) item.extractionProgress = patch.progress
    if (patch.error !== undefined) item.extractionError = patch.error
  }

  /**
   * Read the cancel flag fresh. Wrapping the property access in a method call
   * defeats TS control-flow narrowing across the opaque `apply()` mutations, so
   * the re-checks after each await stay type-correct (a cancel can flip the
   * status reactively while we were suspended).
   */
  private isCancelled(item: DownloadItem): boolean {
    return item.extractionStatus === 'cancelled'
  }

  private async ensureStatusInitialized(): Promise<void> {
    if (this.statusInitialized) return
    if (!this.statusInitPromise) {
      this.statusInitPromise = this.refreshExtractorStatus()
    }
    await this.statusInitPromise
  }

  /**
   * Refresh the extractor binary status. Call after settings changes or on
   * app startup. Auto-extract is gated on `extractorReady` AND the user's
   * `qtExtractor.autoRunAfterDownload` toggle.
   */
  async refreshExtractorStatus(): Promise<ExtractorStatusSnapshot> {
    const status = await window.electronAPI.qtExtractor.getStatus()
    this.applyExtractorStatus(status)
    return status
  }

  /**
   * Update cached readiness from a status snapshot already obtained elsewhere
   * (e.g. a `qtExtractor.verify` call in settings). Avoids a redundant
   * `getStatus` IPC that would re-spawn the binary verification probe.
   */
  applyExtractorStatus(status: ExtractorStatusSnapshot): void {
    this.extractorStatus = status
    this.extractorReady = !!status.ok
    this.statusInitialized = true
  }

  isExtractorReady(): boolean {
    return this.extractorReady
  }

  getExtractorStatus(): ExtractorStatusSnapshot | null {
    return this.extractorStatus
  }

  /**
   * Mark a freshly-added screen download as `pending` for extraction (only when
   * the user has auto-extract enabled and the binary is ready). Called from
   * DownloadService.addToQueue immediately after the item is pushed.
   */
  async markPendingIfApplicable(item: DownloadItem): Promise<void> {
    if (item.videoType !== 'screen') return
    await this.ensureStatusInitialized()
    if (!this.extractorReady) return
    try {
      const fields = computePendingExtractionFields(configStore)
      if (!fields) return
      // Apply the config fields directly (data, not state), then route the
      // status/progress transition through the machine so it stays the sole
      // writer of extraction state.
      const { extractionStatus: _s, extractionProgress: _p, ...configFields } = fields
      Object.assign(item, configFields)
      this.apply(item, { type: 'MARK_PENDING' })
      this.notifyChange()
    } catch (err) {
      log.error('[ExtractionQueue] Failed to mark item pending:', err)
    }
  }

  /**
   * Subscribe to global IPC events. Called once on first activation.
   */
  private attachListeners(): void {
    if (this.listenersAttached) return
    this.listenersAttached = true

    window.electronAPI.qtExtractor.onProgress((extractionId, percent) => {
      const item = this.items.find((i) => i.id === extractionId)
      if (!item) return
      // The machine ignores progress unless the item is 'extracting'.
      this.apply(item, { type: 'EXTRACT_PROGRESS', percent })
    })

    window.electronAPI.qtExtractor.onSlidesExtracted((extractionId, slidesDir) => {
      const item = this.items.find((i) => i.id === extractionId)
      if (item) item.slidesDir = slidesDir
    })

    // We don't rely on onCompleted/onError/onCancelled here — runExtraction's
    // promise already resolves/rejects with the final state.
  }

  /**
   * Start the worker if not already running. Safe to call multiple times.
   */
  ensureWorker(): void {
    this.attachListeners()
    if (this.workerRunning) return
    this.workerRunning = true
    void this.workerLoop()
  }

  notifyChange(): void {
    this.ensureWorker()
    if (this.wakeUp) {
      const fn = this.wakeUp
      this.wakeUp = null
      fn()
    }
  }

  private async waitForChange(): Promise<void> {
    return new Promise<void>((resolve) => {
      this.wakeUp = resolve
    })
  }

  private async workerLoop(): Promise<void> {
    while (true) {
      const items = this.items
      // Find the FIRST pending extraction in download-list order.
      const earliest = items.find((i) => i.extractionStatus === 'pending')
      if (!earliest) {
        await this.waitForChange()
        continue
      }

      // If the download was cancelled or errored, skip this slot.
      if (earliest.status === 'error') {
        this.apply(earliest, {
          type: 'DOWNLOAD_FAILED',
          error: earliest.error || 'Download cancelled'
        })
        continue
      }

      // Wait for download to complete before extraction.
      if (earliest.status !== 'completed') {
        await this.waitForChange()
        continue
      }

      await this.runOne(earliest, this.resolveExtractorMp4Path(earliest))
    }
  }

  /**
   * Resolve the mp4 path the downloader produced for this item. Must match
   * DownloadService's naming exactly — both go through sanitizeDownloadName.
   */
  private resolveExtractorMp4Path(item: DownloadItem): string {
    return `${item.extractorOutputDir}/${sanitizeDownloadName(item.name || '')}.mp4`
  }

  private async runOne(item: DownloadItem, videoFilePath: string): Promise<void> {
    if (!hasRequiredExtractionParams(item)) {
      this.apply(item, { type: 'EXTRACT_FAILED', error: 'Missing extraction parameters' })
      return
    }

    this.apply(item, { type: 'EXTRACT_STARTED' })
    item.videoFilePath = videoFilePath

    let slidesDir: string | undefined
    try {
      const result = await window.electronAPI.qtExtractor.runExtraction(
        item.id,
        videoFilePath,
        item.extractorOutputDir,
        {
          ssimThreshold: item.ssimThreshold,
          enableDownsampling: item.extractionEnableDownsampling,
          downsampleWidth: item.extractionDownsampleWidth,
          downsampleHeight: item.extractionDownsampleHeight,
          chunkSize: 100
        }
      )
      slidesDir = result.slidesDir || item.slidesDir
      item.slidesDir = slidesDir
    } catch (err) {
      // The IPC handler resolves with { success: false, cancelled: true } for cancellation
      // but the renderer-side promise wrapper throws. Distinguish via item state —
      // cancelExtraction() may have flipped the status reactively while we awaited.
      const message = err instanceof Error ? err.message : String(err)
      if (this.isCancelled(item) || message === 'cancelled') {
        this.apply(item, { type: 'CANCEL' })
        return
      }
      this.apply(item, { type: 'EXTRACT_FAILED', error: message })
      return
    }

    if (!slidesDir) {
      this.apply(item, {
        type: 'EXTRACT_FAILED',
        error: 'Extractor did not report a slides directory'
      })
      return
    }

    // A cancel may have arrived while runExtraction was resolving (the SIGTERM
    // lost the race with a clean exit). The machine makes the advance events
    // below no-ops once the status is 'cancelled', but bail early so we don't
    // kick off color-reduction / post-processing the user no longer wants.
    if (this.isCancelled(item)) return

    // Record per-folder metadata for this recorded extraction (best-effort).
    void recordRecordedExtraction({
      folderPath: slidesDir,
      extractor: 'qt',
      trigger: 'auto',
      ssimThreshold: item.ssimThreshold,
      sessionId: item.sessionId,
      source: {
        sessionId: item.sessionId,
        courseTitle: item.courseTitle,
        sessionTitle: item.sessionTitle,
      },
    })

    // Optional PNG-8 palette quantization (only when the user enabled it).
    // Qt extractor `--compatible` mode produces lossless 8-bit RGB PNG; this
    // pass shrinks files dramatically when color reduction is desired.
    const reduceColors = !!configStore.slideExtraction?.enablePngColorReduction
    if (reduceColors) {
      this.apply(item, { type: 'NORMALIZE_STARTED' })
      try {
        await window.electronAPI.qtExtractor.applyColorReduction(slidesDir)
      } catch (err) {
        log.error('[ExtractionQueue] Color reduction step failed:', err)
        this.apply(item, {
          type: 'NORMALIZE_FAILED',
          error: err instanceof Error ? err.message : String(err)
        })
        return
      }
    }

    // Re-check after the (awaited) color-reduction pass — a cancel during
    // normalizing flips the status but cannot interrupt the in-JS await.
    if (this.isCancelled(item)) return

    if (!item.autoPostProcessAfter) {
      this.apply(item, { type: 'FINISH' })
      return
    }

    // Chain into existing Electron post-processing. Fire-and-forget the
    // post-processing job so extraction can immediately advance to the next
    // queued item while post-processing runs in PostProcessingService's own
    // serial queue. We watch the job (via subscription) and update the item
    // status when it reaches a terminal state.
    let imageFiles: string[] = []
    try {
      imageFiles = await window.electronAPI.slideExtraction.listSlides(slidesDir)
    } catch (err) {
      log.error('[ExtractionQueue] listSlides failed:', err)
      this.apply(item, {
        type: 'EXTRACT_FAILED',
        error: err instanceof Error ? err.message : String(err)
      })
      return
    }

    if (imageFiles.length === 0) {
      // No slides to post-process — treat as completed
      this.apply(item, { type: 'FINISH' })
      return
    }

    item.postProcessJobId = PostProcessingService.addJob(item.id, slidesDir, imageFiles)
    this.apply(item, { type: 'POSTPROCESS_STARTED' })
    this.watchPostProcessingJob(item)
  }

  /**
   * Bridge the post-processing job's terminal state back onto the download item.
   * Subscription-driven (no polling): we register for PostProcessingService
   * updates and resolve as soon as the job reaches a terminal status. An
   * immediate check covers the (rare) case where the job already finished
   * before we subscribed.
   */
  private watchPostProcessingJob(item: DownloadItem): void {
    const jobId = item.postProcessJobId
    if (!jobId) return

    const settle = (): boolean => {
      const job = PostProcessingService.getJob(jobId)
      if (!job) {
        this.apply(item, { type: 'POSTPROCESS_FAILED', error: 'Post-processing job vanished' })
        return true
      }
      if (job.status === 'completed') {
        this.apply(item, { type: 'POSTPROCESS_DONE' })
        return true
      }
      if (job.status === 'failed') {
        this.apply(item, {
          type: 'POSTPROCESS_FAILED',
          error: job.errors?.[0]?.message || 'Post-processing failed'
        })
        return true
      }
      return false
    }

    if (settle()) return
    const unsubscribe = PostProcessingService.subscribe((job) => {
      if (job.id !== jobId) return
      if (settle()) unsubscribe()
    })
  }

  /**
   * Cancel an in-flight or pending extraction. Returns true if an action was taken.
   */
  async cancelExtraction(itemId: string): Promise<boolean> {
    const item = this.items.find((i) => i.id === itemId)
    if (!item) return false
    if (item.extractionStatus === 'pending') {
      this.apply(item, { type: 'CANCEL' })
      this.notifyChange()
      return true
    }
    if (
      item.extractionStatus === 'extracting' ||
      item.extractionStatus === 'normalizing' ||
      item.extractionStatus === 'post_processing'
    ) {
      // For running extractions, send SIGTERM to the child process. Normalizing
      // and post-processing run in our own JS — just flip the flag; they will
      // finish or error out shortly.
      this.apply(item, { type: 'CANCEL' })
      try {
        await window.electronAPI.qtExtractor.cancelExtraction(itemId)
      } catch (err) {
        log.warn('[ExtractionQueue] cancelExtraction failed (process may already be gone):', err)
      }
      this.notifyChange()
      return true
    }
    return false
  }
}
