import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import type { DriveFolderStatus, DriveFolderSummary } from '@common/driveStatus'
import type { SlideShareRecord } from '@common/sidecars/metadata'
import { formatLectureDisplayName } from '@common/lectureNaming'
import { configStore } from '@shared/services/configStore'
import { DriveUploads } from '@shared/services/driveUploadQueue'
import { startDriveUploads } from '@shared/services/driveUploadStart'
import { createLatest } from '@shared/utils/latest'
import { createLogger } from '@shared/utils/logger'
const log = createLogger('DrivePage')

export type DriveFolderFilter = 'all' | DriveFolderStatus

/** A share record with the folder it belongs to, for the Shares list. */
export interface DriveShareRow {
  share: SlideShareRecord
  folder: DriveFolderSummary
}

/** The lecture's name: titles from metadata.json, else the folder name. */
export function driveFolderTitle(folder: Pick<DriveFolderSummary, 'name' | 'courseTitle' | 'sessionTitle'>): string {
  const titled = [folder.courseTitle, folder.sessionTitle].filter(Boolean).join(' · ')
  return titled || formatLectureDisplayName(folder.name)
}

/**
 * Drive page state: the folder list (recognised folders first), its filter,
 * and the share records of every folder. Uploads go through the shared
 * queue, so the Slides page sees them too.
 */
export function useDrivePage() {
  const { t } = useI18n()
  const folders = ref<DriveFolderSummary[]>([])
  const loading = ref(false)
  const loadError = ref('')
  const filter = ref<DriveFolderFilter>('all')
  const latest = createLatest()

  async function load(): Promise<void> {
    const current = latest.begin()
    loading.value = true
    try {
      const result = await window.electronAPI.drive.folders()
      if (!current()) return
      if (result.ok) {
        folders.value = result.data
        loadError.value = ''
      } else {
        loadError.value = result.message || result.error
      }
    } catch (error) {
      if (current()) loadError.value = error instanceof Error ? error.message : String(error)
    } finally {
      if (current()) loading.value = false
    }
  }

  async function refreshFolder(folderPath: string): Promise<void> {
    const result = await window.electronAPI.drive.folder(String(folderPath))
    if (!result.ok) return
    const index = folders.value.findIndex((f) => f.path === folderPath)
    if (index >= 0) folders.value.splice(index, 1, result.data)
  }

  const stopFinished = DriveUploads.onFinished((row) => { void refreshFolder(row.folderPath) })
  onBeforeUnmount(stopFinished)

  // A new output folder lists other folders.
  watch(() => configStore.outputDirectory, () => { void load() })

  const recognised = computed(() => folders.value.filter((f) => f.recognised))
  const unrecognisedCount = computed(() => folders.value.length - recognised.value.length)

  const counts = computed(() => {
    const byStatus: Record<DriveFolderFilter, number> = { all: 0, none: 0, partial: 0, uploaded: 0, changed: 0 }
    for (const folder of recognised.value) {
      byStatus.all++
      byStatus[folder.counts.status]++
    }
    return byStatus
  })

  const visibleFolders = computed(() =>
    filter.value === 'all' ? recognised.value : recognised.value.filter((f) => f.counts.status === filter.value))

  const shares = computed<DriveShareRow[]>(() =>
    folders.value
      .flatMap((folder) => folder.shares.map((share) => ({ share, folder })))
      .sort((a, b) => b.share.createdAt.localeCompare(a.share.createdAt)))

  async function upload(folder: DriveFolderSummary): Promise<void> {
    await startDriveUploads(t, [{ path: folder.path, recognised: folder.recognised }])
  }

  function cancelUpload(folder: DriveFolderSummary): void {
    DriveUploads.cancel(folder.path)
  }

  async function shorten(row: DriveShareRow): Promise<string | null> {
    const result = await window.electronAPI.drive.shortenShare(String(row.folder.path), String(row.share.id))
    if (!result.ok) {
      log.warn('Shorten failed', result.error, result.message)
      return result.message || result.error
    }
    await refreshFolder(row.folder.path)
    return null
  }

  async function removeShare(row: DriveShareRow): Promise<void> {
    const answer = await window.electronAPI.dialog.showMessageBox({
      type: 'question',
      title: t('drive.removeShareTitle'),
      message: t('drive.removeShareMessage'),
      detail: t('drive.removeShareDetail'),
      buttons: [t('trash.cancel'), t('drive.removeShare')],
      defaultId: 1,
      cancelId: 0,
      noLink: true,
    })
    if (answer.response !== 1) return
    await window.electronAPI.drive.removeShare(String(row.folder.path), String(row.share.id))
    await refreshFolder(row.folder.path)
  }

  return {
    folders,
    loading,
    loadError,
    filter,
    counts,
    visibleFolders,
    unrecognisedCount,
    shares,
    load,
    refreshFolder,
    upload,
    cancelUpload,
    shorten,
    removeShare,
  }
}
