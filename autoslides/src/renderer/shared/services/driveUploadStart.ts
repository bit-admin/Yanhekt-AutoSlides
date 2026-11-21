// Start sharing the folders the workspace selected after checking sign-in and
// showing the public, permanent upload warning (every time, nothing remembered).
import { tokenManager } from './authService'
import { DriveUploads, type DriveUploadRow } from './driveUploadQueue'

type Translate = (key: string, params?: Record<string, unknown>) => string

const folderNameOf = (folderPath: string): string => folderPath.split(/[\\/]/).filter(Boolean).pop() ?? folderPath

/** What went wrong in a batch of uploads, one line per folder; null when nothing did. */
export function describeShareFailures(t: Translate, rows: DriveUploadRow[]): { message: string; detail: string } | null {
  const failed = rows.filter((row) => row.status === 'error' || row.failed > 0 || row.error === 'sign-in')
  if (failed.length === 0) return null
  if (failed.some((row) => row.error === 'sign-in')) {
    return { message: t('drive.shareStoppedSignIn'), detail: t('drive.shareFailedRetry') }
  }
  const lines = failed.map((row) => row.status === 'error'
    ? t('drive.shareFailedFolderError', { name: folderNameOf(row.folderPath) })
    : t('drive.shareFailedFolder', { name: folderNameOf(row.folderPath), failed: row.failed, total: row.total }))
  return { message: t('drive.shareFailedMessage', { count: failed.length }), detail: [...lines, '', t('drive.shareFailedRetry')].join('\n') }
}

// Uploads end one folder at a time; failures are kept until the queue is
// empty, then told once, whichever page is open.
let reporting = false
const finished: DriveUploadRow[] = []
function reportFailures(t: Translate): void {
  if (reporting) return
  reporting = true
  DriveUploads.onFinished((row) => {
    finished.push({ ...row })
    if (DriveUploads.pendingCount.value > 0) return
    const summary = describeShareFailures(t, finished.splice(0))
    if (!summary) return
    void window.electronAPI.dialog.showMessageBox({
      type: 'warning',
      message: summary.message,
      detail: summary.detail,
      buttons: [t('lectureOutputs.ok')],
    })
  })
}

/** Queue folders already checked for eligibility by the workspace. */
export async function startDriveUploads(t: Translate, folderPaths: string[]): Promise<number> {
  if (folderPaths.length === 0) return 0
  if (!tokenManager.getToken()) {
    await window.electronAPI.dialog.showMessageBox({
      type: 'info', message: t('drive.signInRequired'), buttons: [t('lectureOutputs.ok')],
    })
    return 0
  }
  const answer = await window.electronAPI.dialog.showMessageBox({
    type: 'warning',
    title: t('drive.publicNoticeTitle'),
    message: t('drive.publicNoticeMessage'),
    detail: t('drive.publicNoticeDetail'),
    buttons: [t('trash.cancel'), t('drive.upload')],
    defaultId: 1,
    cancelId: 0,
    noLink: true,
  })
  if (answer.response !== 1) return 0
  reportFailures(t)
  return DriveUploads.add(folderPaths)
}
