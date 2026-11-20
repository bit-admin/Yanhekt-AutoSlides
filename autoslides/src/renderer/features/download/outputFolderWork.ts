import type { OutputFolderWork } from '@common/outputFolderWork'
import type { DownloadItem } from '@shared/services/downloadService'
import { DownloadService } from '@shared/services/downloadService'
import { PostProcessingService } from '@shared/services/postProcessingService'
import { TaskQueue } from '@shared/services/taskQueueService'
import { SlideVideoQueue } from '@shared/services/slideVideoQueue'
import { DriveUploads } from '@shared/services/driveUploadQueue'
import { slideExtractionManager } from '@shared/processing/manager'

const UNFINISHED_EXTRACTION = new Set<DownloadItem['extractionStatus']>(['pending', 'extracting', 'normalizing', 'post_processing'])

/** A Download panel row that will still write: the download itself, or the Extractor run queued after it. */
export const downloadRowIsUnfinished = (item: Pick<DownloadItem, 'status' | 'extractionStatus'>): boolean =>
  item.status === 'queued' ||
  item.status === 'downloading' ||
  item.status === 'processing' ||
  (item.status === 'completed' && UNFINISHED_EXTRACTION.has(item.extractionStatus))

/**
 * What is still writing into the output folder (`@common/outputFolderWork`),
 * for main to ask before the folder changes. A running task also has an
 * extraction (and later a post-processing job); each is counted.
 */
export function countOutputFolderWork(): OutputFolderWork {
  return {
    downloads: DownloadService.downloadItems.filter(downloadRowIsUnfinished).length,
    extractions: slideExtractionManager.getAll().filter((pipeline) => pipeline.isActive).length,
    tasks: TaskQueue.tasks.filter((task) => task.status === 'queued' || task.status === 'in_progress').length,
    postProcessing: PostProcessingService.jobs.filter((job) => job.status === 'queued' || job.status === 'processing').length,
    slideVideos: SlideVideoQueue.pendingCount.value,
    driveUploads: DriveUploads.pendingCount.value,
  }
}
