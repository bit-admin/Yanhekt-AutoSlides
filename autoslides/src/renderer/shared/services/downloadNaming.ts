// Canonical sanitizer for download output filenames. The M3U8 downloader writes
// `<outputDir>/<sanitizeDownloadName(name)>.mp4`, and the extraction queue
// reconstructs that exact path to locate the file. Both MUST use this single
// implementation — diverging would make extraction look for the wrong file.
//
// NOTE: this is deliberately NOT @common/sanitizeFileName, which strips path
// separators rather than replacing them with underscores and would produce a
// different on-disk name.
export function sanitizeDownloadName(fileName: string): string {
  return fileName
    .replace(/[:"*?<>|]/g, '') // Remove Windows/macOS problematic characters
    .replace(/\s+/g, '_') // Replace spaces with underscores
    .replace(/[/\\]/g, '_') // Replace path separators with underscores
    .replace(/_{2,}/g, '_') // Replace multiple underscores with single underscore
    .trim() // Remove leading/trailing whitespace
}
