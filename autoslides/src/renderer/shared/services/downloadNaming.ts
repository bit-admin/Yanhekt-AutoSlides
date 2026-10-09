// The naming rules live in `@common/downloadNaming` so the main process (the
// command line downloader) builds byte-identical file names. Renderer code
// keeps importing from here.
export { sanitizeDownloadName, buildDownloadFileName } from '@common/downloadNaming'
