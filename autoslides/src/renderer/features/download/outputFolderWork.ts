import type { OutputFolderWork } from '@common/outputFolderWork'
import { DownloadService } from '@shared/services/downloadService'
import { downloadRowIsUnfinished } from '@shared/services/downloadRowState'
import { PostProcessingService } from '@shared/services/postProcessingService'
import { TaskQueue } from '@shared/services/taskQueueService'
import { SlideVideoQueue } from '@shared/services/slideVideoQueue'
import { DriveUploads } from '@shared/services/driveUploadQueue'
import { activeClones } from '@shared/services/cloneActivity'
import { slideExtractionManager } from '@shared/processing/manager'

export { downloadRowIsUnfinished }

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
    clones: activeClones.value,
  }
}
