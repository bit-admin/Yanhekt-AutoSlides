import { DownloadService, type DownloadItem, type ExtractionStatus } from './downloadService'
import { PostProcessingService } from './postProcessingService'
import { SSIM_PRESET_VALUES } from './ssimThresholdService'
import { sanitizeDownloadName } from './downloadNaming'
import { configStore } from '@shared/services/configStore'

export type { ExtractionStatus }

interface ExtractorStatusSnapshot {
  ok: boolean
  path: string
  resolvedPath: string
  version?: string
  error?: string
}

class ExtractionQueueServiceClass {
  private extractorReady = false
  private extractorStatus: ExtractorStatusSnapshot | null = null
  private statusInitialized = false
  private statusInitPromise: Promise<ExtractorStatusSnapshot> | null = null
  private workerRunning = false
  private wakeUp: (() => void) | null = null
  private listenersAttached = false

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
   * Resolve the SSIM threshold to pass to the CLI given the current preset mode.
   * Adaptive mode uses the static normal default (0.9987) per user direction —
   * the CLI receives a fixed numeric threshold, no per-session classroom lookup.
   */
  private resolveSsimThreshold(
    presetMode: 'adaptive' | 'strict' | 'normal' | 'loose' | 'custom' | undefined,
    customValue: number
  ): number {
    switch (presetMode) {
      case 'custom':
        return customValue
      case 'strict':
        return SSIM_PRESET_VALUES.strict
      case 'loose':
        return SSIM_PRESET_VALUES.loose
      case 'normal':
        return SSIM_PRESET_VALUES.normal
      case 'adaptive':
      default:
        return SSIM_PRESET_VALUES.normal
    }
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
      const cfg = configStore
      const qtCfg = cfg.qtExtractor
      const slideCfg = cfg.slideExtraction
      if (!qtCfg?.autoRunAfterDownload) return
      if (!slideCfg) return
      const ssimThreshold = this.resolveSsimThreshold(slideCfg.ssimPresetMode, slideCfg.ssimThreshold)
      item.extractionStatus = 'pending'
      item.extractionProgress = 0
      item.ssimThreshold = ssimThreshold
      item.extractionEnableDownsampling = slideCfg.enableDownsampling
      item.extractionDownsampleWidth = slideCfg.downsampleWidth
      item.extractionDownsampleHeight = slideCfg.downsampleHeight
      item.autoPostProcessAfter = !!qtCfg.autoPostProcessAfter
      item.extractorOutputDir = cfg.outputDirectory
      this.notifyChange()
    } catch (err) {
      console.error('[ExtractionQueue] Failed to mark item pending:', err)
    }
  }

  /**
   * Subscribe to global IPC events. Called once on first activation.
   */
  private attachListeners(): void {
    if (this.listenersAttached) return
    this.listenersAttached = true

    window.electronAPI.qtExtractor.onProgress((extractionId, percent) => {
      const item = DownloadService.downloadItems.find((i) => i.id === extractionId)
      if (!item) return
      if (item.extractionStatus === 'extracting') {
        item.extractionProgress = Math.max(0, Math.min(100, Math.round(percent)))
      }
    })

    window.electronAPI.qtExtractor.onSlidesExtracted((extractionId, slidesDir) => {
      const item = DownloadService.downloadItems.find((i) => i.id === extractionId)
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
      const items = DownloadService.downloadItems
      // Find the FIRST pending extraction in download-list order.
      const earliest = items.find((i) => i.extractionStatus === 'pending')
      if (!earliest) {
        await this.waitForChange()
        continue
      }

      // If the download was cancelled or errored, skip this slot.
      if (earliest.status === 'error') {
        earliest.extractionStatus = 'cancelled'
        earliest.extractionError = earliest.error || 'Download cancelled'
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
    if (
      item.ssimThreshold == null ||
      item.extractionEnableDownsampling == null ||
      item.extractionDownsampleWidth == null ||
      item.extractionDownsampleHeight == null ||
      !item.extractorOutputDir
    ) {
      item.extractionStatus = 'error'
      item.extractionError = 'Missing extraction parameters'
      return
    }

    item.extractionStatus = 'extracting'
    item.extractionProgress = 0
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
      const currentStatus: ExtractionStatus = item.extractionStatus as ExtractionStatus
      if (currentStatus === 'cancelled' || message === 'cancelled') {
        item.extractionStatus = 'cancelled'
        return
      }
      item.extractionStatus = 'error'
      item.extractionError = message
      return
    }

    if (!slidesDir) {
      item.extractionStatus = 'error'
      item.extractionError = 'Extractor did not report a slides directory'
      return
    }

    // Optional PNG-8 palette quantization (only when the user enabled it).
    // Qt extractor `--compatible` mode produces lossless 8-bit RGB PNG; this
    // pass shrinks files dramatically when color reduction is desired.
    const cfg = configStore
    const reduceColors = !!cfg.slideExtraction?.enablePngColorReduction
    if (reduceColors) {
      item.extractionStatus = 'normalizing'
      try {
        await window.electronAPI.qtExtractor.applyColorReduction(slidesDir)
      } catch (err) {
        console.error('[ExtractionQueue] Color reduction step failed:', err)
        item.extractionStatus = 'error'
        item.extractionError = err instanceof Error ? err.message : String(err)
        return
      }
    }

    if (!item.autoPostProcessAfter) {
      item.extractionStatus = 'completed'
      item.extractionProgress = 100
      return
    }

    // Chain into existing Electron post-processing. Fire-and-forget the
    // post-processing job so extraction can immediately advance to the next
    // queued item while post-processing runs in PostProcessingService's own
    // serial queue. We watch the job and update the item status when it
    // reaches a terminal state.
    let imageFiles: string[] = []
    try {
      imageFiles = await window.electronAPI.slideExtraction.listSlides(slidesDir)
    } catch (err) {
      console.error('[ExtractionQueue] listSlides failed:', err)
      item.extractionStatus = 'error'
      item.extractionError = err instanceof Error ? err.message : String(err)
      return
    }

    if (imageFiles.length === 0) {
      // No slides to post-process — treat as completed
      item.extractionStatus = 'completed'
      item.extractionProgress = 100
      return
    }

    item.extractionStatus = 'post_processing'
    item.postProcessJobId = PostProcessingService.addJob(item.id, slidesDir, imageFiles)
    void this.watchPostProcessingJob(item)
  }

  private async watchPostProcessingJob(item: DownloadItem): Promise<void> {
    const jobId = item.postProcessJobId
    if (!jobId) return
    const start = Date.now()
    while (Date.now() - start < 1000 * 60 * 60) {
      const job = PostProcessingService.getJob(jobId)
      if (!job) {
        // Job was removed unexpectedly
        item.extractionStatus = 'error'
        item.extractionError = 'Post-processing job vanished'
        return
      }
      if (job.status === 'completed') {
        item.extractionStatus = 'completed'
        item.extractionProgress = 100
        return
      }
      if (job.status === 'failed') {
        item.extractionStatus = 'error'
        item.extractionError = job.errors?.[0]?.message || 'Post-processing failed'
        return
      }
      await new Promise((r) => setTimeout(r, 500))
    }
    // Timed out
    item.extractionStatus = 'error'
    item.extractionError = 'Post-processing watcher timed out'
  }

  /**
   * Cancel an in-flight or pending extraction. Returns true if an action was taken.
   */
  async cancelExtraction(itemId: string): Promise<boolean> {
    const item = DownloadService.downloadItems.find((i) => i.id === itemId)
    if (!item) return false
    if (item.extractionStatus === 'pending') {
      item.extractionStatus = 'cancelled'
      this.notifyChange()
      return true
    }
    if (item.extractionStatus === 'extracting' || item.extractionStatus === 'normalizing' || item.extractionStatus === 'post_processing') {
      // For running extractions, send SIGTERM to the child process. Normalizing
      // and post-processing run in our own JS — just flip the flag; they will
      // finish or error out shortly.
      item.extractionStatus = 'cancelled'
      try {
        await window.electronAPI.qtExtractor.cancelExtraction(itemId)
      } catch (err) {
        console.warn('[ExtractionQueue] cancelExtraction failed (process may already be gone):', err)
      }
      this.notifyChange()
      return true
    }
    return false
  }
}

export const ExtractionQueue = new ExtractionQueueServiceClass()
