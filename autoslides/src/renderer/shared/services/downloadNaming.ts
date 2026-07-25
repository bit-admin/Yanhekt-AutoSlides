// Canonical naming for download output filenames. The M3U8 downloader writes
// `<outputDir>/<buildDownloadFileName(item)>.mp4`, and the extraction queue
// reconstructs that exact path to locate the file. Both MUST go through
// buildDownloadFileName — diverging would make extraction look for the wrong
// file, silently.
//
// NOTE: the sanitizer here is deliberately NOT @common/sanitizeFileName, which
// strips path separators rather than replacing them with underscores and would
// produce a different on-disk name.
import { buildLectureIdSuffix, type LectureIdentity } from '@common/lectureNaming'

export function sanitizeDownloadName(fileName: string): string {
  return fileName
    .replace(/[:"*?<>|]/g, '') // Remove Windows/macOS problematic characters
    .replace(/\s+/g, '_') // Replace spaces with underscores
    .replace(/[/\\]/g, '_') // Replace path separators with underscores
    .replace(/_{2,}/g, '_') // Replace multiple underscores with single underscore
    .trim() // Remove leading/trailing whitespace
}

/**
 * The on-disk stem for a download: sanitized label + the course/session id
 * block. THE single place this name is produced — the writer, the temp-file
 * cleanup and the extraction queue's path reconstruction all call this, so the
 * suffix cannot appear on one side and not the other.
 *
 * Two lectures can share a title (a re-offered course, parallel sections);
 * without the id block they resolved to one `.mp4` path and the second download
 * overwrote the first, after which auto-extraction ran against the wrong video.
 *
 * The suffix is appended AFTER sanitizing because `sanitizeDownloadName`
 * collapses `_{2,}` and would eat the `__` delimiter.
 */
export function buildDownloadFileName(item: LectureIdentity & { name?: string }): string {
  return `${sanitizeDownloadName(item.name || '')}${buildLectureIdSuffix(item)}`
}
