import { reactive, ref } from 'vue'

export type DownloadStatus = 'queued' | 'downloading' | 'processing' | 'completed' | 'error'

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
}

class DownloadServiceClass {
  private items = reactive<DownloadItem[]>([])
  private activeDownloads = new Set<string>()
  private maxConcurrent = ref(5)

  // Helper function to sanitize file names
  private sanitizeFileName(fileName: string): string {
    // Remove or replace problematic characters
    return fileName
      .replace(/[:"*?<>|]/g, '') // Remove Windows/macOS problematic characters
      .replace(/\s+/g, '_') // Replace spaces with underscores
      .replace(/[/\\]/g, '_') // Replace path separators with underscores
      .replace(/_{2,}/g, '_') // Replace multiple underscores with single underscore
      .trim() // Remove leading/trailing whitespace
  }

  // Queue management
  addToQueue(item: Omit<DownloadItem, 'id' | 'status' | 'progress' | 'addedAt'>): boolean {
    // Check for duplicates
    const duplicate = this.items.find(existing =>
      existing.sessionId === item.sessionId &&
      existing.videoType === item.videoType &&
      existing.status !== 'error'
    )

    if (duplicate) {
      return false // Already exists
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
    return true
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
          }
        }
      }

      const completedListener = (downloadId: string) => {
        if (downloadId === item.id && !completed) {
          completed = true

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
          resolve()
        }
      }

      const errorListener = (downloadId: string, error: string) => {
        if (downloadId === item.id && !completed) {
          completed = true
          item.status = 'error'
          item.error = error
          console.error(`Download failed: ${item.name}`, error)

          // Clean up by removing this specific item from active downloads
          this.activeDownloads.delete(item.id)
          this.processQueue()
          reject(new Error(error))
        }
      }

      // Register listeners - these are global listeners that handle all downloads
      // The IPC events are broadcast to all listeners, so we filter by downloadId
      window.electronAPI.download.onProgress(progressListener)
      window.electronAPI.download.onCompleted(completedListener)
      window.electronAPI.download.onError(errorListener)

      // Start the download with sanitized file name
      const sanitizedName = this.sanitizeFileName(item.name)
      window.electronAPI.download.start(item.id, m3u8Url, sanitizedName)
        .catch((error: Error) => {
          if (!completed) {
            completed = true
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

  // Statistics
  getCurrentSpeed(): string {
    const activeItems = this.items.filter(item => item.status === 'downloading')
    if (activeItems.length === 0) return '0 KB/s'

    // TODO: Calculate actual speed based on real downloads
    return `${(Math.random() * 5000 + 1000).toFixed(0)} KB/s`
  }
}

export const DownloadService = new DownloadServiceClass()