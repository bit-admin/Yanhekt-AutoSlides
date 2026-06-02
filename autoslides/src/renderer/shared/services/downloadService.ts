import { reactive, ref } from 'vue'
import { sanitizeDownloadName } from './downloadNaming'
import { ExtractionQueue } from './extractionQueueService'

export type DownloadStatus = 'queued' | 'downloading' | 'processing' | 'completed' | 'error'

// Extraction state added by the Qt AutoSlides Extractor integration. Canonical
// home for the union — extractionQueueService imports it from here (it already
// imports DownloadItem from this module, so there is no circular-type concern).
export type ExtractionStatus =
  | 'none'
  | 'pending'
  | 'extracting'
  | 'normalizing'
  | 'post_processing'
  | 'completed'
  | 'error'
  | 'cancelled'

export interface DownloadItem {
  id: string
  name: string
  courseTitle: string
  sessionTitle: string
  sessionId: string
  videoType: 'camera' | 'screen'
  status: DownloadStatus
  progress: number
  error?: string
  addedAt: number
  startedAt?: number
  completedAt?: number

  // Qt extractor state (populated only when auto-extract is enabled and the binary is ready)
  extractionStatus?: ExtractionStatus
  extractionProgress?: number
  extractionError?: string
  videoFilePath?: string
  slidesDir?: string
  ssimThreshold?: number
  extractionEnableDownsampling?: boolean
  extractionDownsampleWidth?: number
  extractionDownsampleHeight?: number
  autoPostProcessAfter?: boolean
  extractorOutputDir?: string
  postProcessJobId?: string
}

export type DownloadQueueAddResult =
  | { added: true; item: DownloadItem }
  | { added: false; existingItem: DownloadItem }

class DownloadServiceClass {
  private items = reactive<DownloadItem[]>([])
  private activeDownloads = new Set<string>()
  private maxConcurrent = ref(5)

  constructor() {
    // The extraction orchestrator reads the queue through this provider rather
    // than importing DownloadService as a value (breaks the import cycle).
    ExtractionQueue.setJobProvider(() => this.items)
  }

  // Queue management
  addToQueue(item: Omit<DownloadItem, 'id' | 'status' | 'progress' | 'addedAt'>): DownloadQueueAddResult {
    // Check for duplicates
    const duplicate = this.items.find(existing =>
      existing.sessionId === item.sessionId &&
      existing.videoType === item.videoType &&
      existing.status !== 'error'
    )

    if (duplicate) {
      return { added: false, existingItem: duplicate }
    }

    const downloadItem: DownloadItem = {
      ...item,
      id: `${item.sessionId}_${item.videoType}_${Date.now()}`,
      status: 'queued',
      progress: 0,
      addedAt: Date.now()
    }

    this.items.push(downloadItem)
    this.processQueue()
    // Hook into the extraction queue. The extraction queue handles its own
    // state transitions, and the download begins immediately regardless.
    this.notifyExtractionQueueAdded(downloadItem)
    return { added: true, item: downloadItem }
  }

  private notifyExtractionQueueAdded(item: DownloadItem): void {
    // markPendingIfApplicable is async (it may await the binary-status probe),
    // but we don't block the download on it — it wakes the worker itself.
    void ExtractionQueue.markPendingIfApplicable(item)
    ExtractionQueue.ensureWorker()
  }

  private notifyExtractionQueueChange(): void {
    ExtractionQueue.notifyChange()
  }

  removeFromQueue(id: string): void {
    const item = this.items.find(item => item.id === id)
    if (item) {
      if (item.status === 'downloading' || item.status === 'processing') {
        // Cancel the actual download in main process
        window.electronAPI.download.cancel(id).catch(console.error)

        // Mark as error
        item.status = 'error'
        item.error = 'Cancelled by user'
        item.progress = 0
        this.activeDownloads.delete(id)
        console.log(`Force cancelling active download: ${item.name}`)

      } else {
        // Only remove if not actively processing
        const index = this.items.findIndex(item => item.id === id)
        if (index !== -1) {
          this.items.splice(index, 1)
        }
      }
      this.processQueue()
      this.notifyExtractionQueueChange()
    }
  }

  cancelAll(): void {
    this.items.forEach(item => {
      if (item.status === 'queued' || item.status === 'downloading' || item.status === 'processing') {
        // Cancel the actual download in main process (for active downloads)
        if (item.status === 'downloading' || item.status === 'processing') {
          window.electronAPI.download.cancel(item.id).catch(console.error)
          this.activeDownloads.delete(item.id)
        }

        // Mark all non-completed/non-error items as error
        item.status = 'error'
        item.error = 'Cancelled by user'
        item.progress = 0
        console.log(`Force cancelling: ${item.name} (was ${item.status})`)
      }
    })

    this.processQueue()
    this.notifyExtractionQueueChange()
  }

  clearCompleted(): void {
    const toRemove = this.items.filter(item =>
      item.status === 'completed' || item.status === 'error'
    )
    toRemove.forEach(item => {
      const index = this.items.indexOf(item)
      if (index !== -1) {
        this.items.splice(index, 1)
      }
    })
  }

  retryDownload(id: string): boolean {
    const item = this.items.find(item => item.id === id)
    if (!item || item.status !== 'error') {
      return false // Item not found or not in error state
    }

    // Reset the item to queued state
    item.status = 'queued'
    item.progress = 0
    item.error = undefined
    item.startedAt = undefined
    item.completedAt = undefined

    // Move the item to the end of the queue by removing and re-adding it
    const index = this.items.indexOf(item)
    if (index !== -1) {
      this.items.splice(index, 1)
      this.items.push(item)
    }

    // Process the queue to start the retry if there's capacity
    this.processQueue()
    return true
  }

  private processQueue(): void {
    const queuedItems = this.items.filter(item => item.status === 'queued')
    const canStart = this.maxConcurrent.value - this.activeDownloads.size

    for (let i = 0; i < Math.min(canStart, queuedItems.length); i++) {
      const item = queuedItems[i]
      this.startDownload(item)
    }
  }

  private async startDownload(item: DownloadItem): Promise<void> {
    item.status = 'downloading'
    item.startedAt = Date.now()
    this.activeDownloads.add(item.id)

    try {
      console.log(`Starting download: ${item.name}`)

      // Get video stream URL from session data
      const sessionData = await this.getSessionVideoUrl(item.sessionId, item.videoType)
      if (!sessionData) {
        throw new Error('Video stream URL not found')
      }

      // Start actual download using IPC
      await this.startRealDownload(item, sessionData.url)

    } catch (error) {
      item.status = 'error'
      item.error = error instanceof Error ? error.message : 'Unknown error'
      console.error(`Download failed: ${item.name}`, error)
      this.activeDownloads.delete(item.id)
      this.processQueue()
    }
  }

  private async getSessionVideoUrl(sessionId: string, videoType: 'camera' | 'screen'): Promise<{ url: string } | null> {
    try {
      // Import DataStore dynamically to avoid circular dependencies
      const { DataStore } = await import('./dataStore')
      const sessionData = DataStore.getSessionData(sessionId)

      if (!sessionData) {
        console.error('Session data not found for:', sessionId)
        return null
      }

      // Get the appropriate video URL based on type
      // For downloads, we need the original URLs from the session data
      const videoUrl = videoType === 'camera' ? sessionData.main_url : sessionData.vga_url
      if (!videoUrl) {
        console.error(`${videoType} URL not found in session data`)
        return null
      }

      return { url: videoUrl }
    } catch (error) {
      console.error('Error getting session video URL:', error)
      return null
    }
  }

  private async startRealDownload(item: DownloadItem, m3u8Url: string): Promise<void> {
    return new Promise((resolve, reject) => {
      let completed = false
      let cleanupListeners = () => {}

      // Set up progress listeners
      const progressListener = (downloadId: string, progress: { current: number; total: number; phase: number }) => {
        if (downloadId === item.id && !completed) {
          // Check if the item was already cancelled - ignore progress updates
          if (item.status === 'error' && item.error === 'Cancelled by user') {
            return
          }


          // Phase 0: downloading, Phase 1: processing, Phase 2: completed
          if (progress.phase === 0) {
            item.status = 'downloading'
            item.progress = Math.floor((progress.current / progress.total) * 90)
          } else if (progress.phase === 1) {
            item.status = 'processing'
            item.progress = 90 + Math.floor((progress.current / progress.total) * 10)
          } else if (progress.phase === 2) {
            // Phase 2: Post-processing complete
            item.status = 'completed'
            item.progress = 100
          }
        }
      }

      const completedListener = (downloadId: string) => {
        if (downloadId === item.id && !completed) {
          completed = true
          cleanupListeners()

          // Check if the item was already cancelled
          if (item.status === 'error' && item.error === 'Cancelled by user') {
            console.log(`Ignoring completion signal for cancelled download: ${item.name}`)
            this.activeDownloads.delete(item.id)
            this.processQueue()
            resolve()
            return
          }

          item.status = 'completed'
          item.progress = 100
          item.completedAt = Date.now()
          console.log(`Completed: ${item.name}`)


          // Clean up by removing this specific item from active downloads
          this.activeDownloads.delete(item.id)
          this.processQueue()
          // Wake the extraction queue so it can pick up this completed item
          // (or skip past it if the next-in-line is still downloading).
          this.notifyExtractionQueueChange()
          resolve()
        }
      }

      const errorListener = (downloadId: string, error: string) => {
        if (downloadId === item.id && !completed) {
          completed = true
          cleanupListeners()
          item.status = 'error'
          item.error = error
          console.error(`Download failed: ${item.name}`, error)


          // Clean up by removing this specific item from active downloads
          this.activeDownloads.delete(item.id)
          this.processQueue()
          this.notifyExtractionQueueChange()
          reject(new Error(error))
        }
      }

      // Register listeners - these are global listeners that handle all downloads
      // The IPC events are broadcast to all listeners, so we filter by downloadId
      const removeProgressListener = window.electronAPI.download.onProgress(progressListener)
      const removeCompletedListener = window.electronAPI.download.onCompleted(completedListener)
      const removeErrorListener = window.electronAPI.download.onError(errorListener)
      cleanupListeners = () => {
        removeProgressListener()
        removeCompletedListener()
        removeErrorListener()
        cleanupListeners = () => {}
      }

      // Start the download with sanitized file name
      const sanitizedName = sanitizeDownloadName(item.name)
      window.electronAPI.download.start(item.id, m3u8Url, sanitizedName)
        .catch((error: Error) => {
          if (!completed) {
            completed = true
            cleanupListeners()
            console.error('Failed to start download:', error)
            this.activeDownloads.delete(item.id)
            this.processQueue()
            reject(error)
          }
        })
    })
  }


  // Getters
  get downloadItems(): DownloadItem[] {
    return this.items
  }

  get queuedCount(): number {
    return this.items.filter(item => item.status === 'queued').length
  }

  get activeCount(): number {
    return this.activeDownloads.size
  }

  get completedCount(): number {
    return this.items.filter(item => item.status === 'completed').length
  }

  get errorCount(): number {
    return this.items.filter(item => item.status === 'error').length
  }

  // Settings
  setMaxConcurrent(max: number): void {
    this.maxConcurrent.value = Math.max(1, Math.min(10, max))
    this.processQueue()
  }

  get maxConcurrentDownloads(): number {
    return this.maxConcurrent.value
  }

}

export const DownloadService = new DownloadServiceClass()
