// Starting Drive uploads from any page: sign-in check, the notice that uploads
// are public and permanent (shown every time, nothing remembered), and leaving
// out folders Drive does not recognise (no metadata.json).
import { tokenManager } from './authService'
import { DriveUploads } from './driveUploadQueue'

type Translate = (key: string, params?: Record<string, unknown>) => string

export interface DriveUploadCandidate {
  path?: string
  /** Whether the folder has metadata.json. */
  recognised: boolean
}

/** Queue the folders; resolves with how many were queued (0 when the student declined or nothing qualified). */
export async function startDriveUploads(t: Translate, folders: DriveUploadCandidate[]): Promise<number> {
  const notify = (message: string) =>
    window.electronAPI.dialog.showMessageBox({ type: 'info', message, buttons: [t('lectureOutputs.ok')] })
  if (!tokenManager.getToken()) {
    await notify(t('drive.signInRequired'))
    return 0
  }
  const usable = folders.filter((f): f is DriveUploadCandidate & { path: string } => f.recognised && !!f.path)
  const unrecognised = folders.length - usable.length
  if (usable.length === 0) {
    await notify(t('drive.noneRecognised'))
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
  const added = DriveUploads.add(usable.map((f) => String(f.path)))
  if (unrecognised > 0) await notify(t('drive.someUnrecognised', { count: unrecognised }))
  return added
}
