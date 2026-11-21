import type { DownloadItem } from './downloadService'

const UNFINISHED_EXTRACTION = new Set<DownloadItem['extractionStatus']>(['pending', 'extracting', 'normalizing', 'post_processing'])

/**
 * A Download panel row that will still write: the download itself, or the
 * Extractor run queued after it. Clear, redo and the output-folder guard all
 * use this one definition, so a finished video is not a finished row.
 */
export const downloadRowIsUnfinished = (item: Pick<DownloadItem, 'status' | 'extractionStatus'>): boolean =>
  item.status === 'queued' ||
  item.status === 'downloading' ||
  item.status === 'processing' ||
  (item.status === 'completed' && UNFINISHED_EXTRACTION.has(item.extractionStatus))
