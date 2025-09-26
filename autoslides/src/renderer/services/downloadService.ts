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
    const index = this.items.findIndex(item => item.id === id)
    if (index !== -1) {
      const item = this.items[index]

      // Cancel if downloading/processing
      if (item.status === 'downloading' || item.status === 'processing') {
        this.activeDownloads.delete(id)
        // TODO: Cancel the actual download/processing
        console.log(`Cancelling download: ${id}`)
      }

      this.items.splice(index, 1)
      this.processQueue()
    }
  }

  cancelAll(): void {
    this.items.forEach(item => {
      if (item.status === 'downloading' || item.status === 'processing') {
        item.status = 'error'
        item.error = 'Cancelled by user'
        this.activeDownloads.delete(item.id)
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
      // TODO: Implement actual download logic
      console.log(`Starting download: ${item.name}`)

      // Simulate download progress
      await this.simulateDownload(item)

      item.status = 'processing'
      console.log(`Processing: ${item.name}`)

      // Simulate processing
      await this.simulateProcessing(item)

      item.status = 'completed'
      item.progress = 100
      item.completedAt = Date.now()
      console.log(`Completed: ${item.name}`)

    } catch (error) {
      item.status = 'error'
      item.error = error instanceof Error ? error.message : 'Unknown error'
      console.error(`Download failed: ${item.name}`, error)
    } finally {
      this.activeDownloads.delete(item.id)
      this.processQueue() // Start next item in queue
    }
  }

  private async simulateDownload(item: DownloadItem): Promise<void> {
    return new Promise((resolve) => {
      let progress = 0
      const interval = setInterval(() => {
        progress += Math.random() * 10
        item.progress = Math.min(progress, 90)

        if (progress >= 90) {
          clearInterval(interval)
          resolve()
        }
      }, 200)
    })
  }

  private async simulateProcessing(item: DownloadItem): Promise<void> {
    return new Promise((resolve) => {
      let progress = 90
      const interval = setInterval(() => {
        progress += Math.random() * 2
        item.progress = Math.min(progress, 99)

        if (progress >= 99) {
          clearInterval(interval)
          resolve()
        }
      }, 300)
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