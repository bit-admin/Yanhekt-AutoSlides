// Drive uploads, one folder at a time (main uploads three slides at once
// inside a folder). In memory like the other queues: a reload clears it, and
// an upload in flight then finishes in main without anyone listening.
import { computed, reactive } from 'vue'
import type { DriveUploadProgress } from '@common/driveStatus'
import { createLogger } from '@shared/utils/logger'
const log = createLogger('DriveUploads')

export type DriveUploadRowStatus = 'queued' | DriveUploadProgress['phase']

export interface DriveUploadRow {
  folderPath: string
  jobId: string
  status: DriveUploadRowStatus
  total: number
  done: number
  failed: number
  skipped: number
  error?: string
}

type Listener = (row: DriveUploadRow) => void

function newJobId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

const isActive = (row: DriveUploadRow): boolean =>
  row.status === 'queued' || row.status === 'checking' || row.status === 'uploading'

class DriveUploadQueue {
  /** Keyed by folder path; finished rows stay until the folder is queued again. */
  readonly rows = reactive<Record<string, DriveUploadRow>>({})
  readonly pendingCount = computed(() => Object.values(this.rows).filter(isActive).length)
  private running = false
  private listening = false
  private finishedListeners = new Set<Listener>()

  private listen(): void {
    if (this.listening) return
    this.listening = true
    window.electronAPI.drive.onProgress((progress) => {
      const row = Object.values(this.rows).find((r) => r.jobId === progress.jobId)
      if (!row) return
      row.status = progress.phase
      row.total = progress.total
      row.done = progress.done
      row.failed = progress.failed
      row.skipped = progress.skipped
      row.error = progress.error
    })
  }

  rowOf(folderPath: string): DriveUploadRow | undefined {
    return this.rows[folderPath]
  }

  isBusy(folderPath: string): boolean {
    const row = this.rows[folderPath]
    return !!row && isActive(row)
  }

  /** Called with each row when its upload ends (done, cancelled or failed). */
  onFinished(listener: Listener): () => void {
    this.finishedListeners.add(listener)
    return () => this.finishedListeners.delete(listener)
  }

  /** Queue folders (paths as plain strings). A folder already queued or uploading is left as it is. */
  add(folderPaths: string[]): number {
    this.listen()
    let added = 0
    for (const raw of folderPaths) {
      const folderPath = String(raw)
      if (this.isBusy(folderPath)) continue
      this.rows[folderPath] = { folderPath, jobId: newJobId(), status: 'queued', total: 0, done: 0, failed: 0, skipped: 0 }
      added++
    }
    void this.drain()
    return added
  }

  /** Stop every queued or running upload (Stop Sharing). */
  cancelAll(): void {
    for (const row of Object.values(this.rows)) if (isActive(row)) this.cancel(row.folderPath)
  }

  cancel(folderPath: string): void {
    const row = this.rows[folderPath]
    if (!row) return
    if (row.status === 'queued') {
      row.status = 'cancelled'
      return
    }
    if (isActive(row)) void window.electronAPI.drive.cancel(row.jobId)
  }

  private async drain(): Promise<void> {
    if (this.running) return
    this.running = true
    try {
      for (;;) {
        const row = Object.values(this.rows).find((r) => r.status === 'queued')
        if (!row) break
        row.status = 'checking'
        try {
          const result = await window.electronAPI.drive.upload(String(row.folderPath), String(row.jobId))
          if (result.ok) {
            const { phase, total, done, failed, skipped, error } = result.data
            Object.assign(row, { status: phase, total, done, failed, skipped, error })
          } else {
            row.status = 'error'
            row.error = result.error
          }
        } catch (error) {
          row.status = 'error'
          row.error = error instanceof Error ? error.message : String(error)
          log.error('Drive upload failed', row.folderPath, error)
        }
        for (const listener of this.finishedListeners) listener(row)
      }
    } finally {
      this.running = false
    }
  }
}

export const DriveUploads = new DriveUploadQueue()
