<template>
  <!-- Update Modal — z above the titlebar (z-modal=1000) so it stacks on top -->
  <div v-if="showUpdateModal" class="fixed inset-0 z-[10000] flex items-center justify-center bg-black/50 dark:bg-black/70" @click="closeUpdateModal">
    <div class="flex max-h-[85vh] w-[640px] max-w-[90vw] flex-col overflow-hidden rounded-lg bg-modal" @click.stop>
      <div class="flex items-center justify-between border-b border-line p-4">
        <h3 class="m-0 text-base font-semibold text-fg">{{ $t('titlebar.updateModal.title') }}</h3>
        <button @click="closeUpdateModal" class="btn-icon">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"/>
            <line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>

      <div class="flex flex-1 flex-col overflow-y-auto p-4 text-fg">
        <!-- Version Info -->
        <div class="mb-4 flex items-center gap-3">
          <div class="rounded-2xl bg-accent px-3 py-1.5 text-sm font-semibold text-white">v{{ releaseInfo?.latestVersion }}</div>
          <div class="flex flex-col gap-0.5">
            <span class="text-xs text-fg-secondary">{{ $t('titlebar.updateModal.currentVersion') }}: v{{ releaseInfo?.currentVersion }}</span>
            <span v-if="releaseInfo?.publishedAt" class="text-[11px] text-fg-muted">{{ formatDate(releaseInfo.publishedAt) }}</span>
          </div>
        </div>

        <!-- Release Notes -->
        <div class="mb-4 flex min-h-0 flex-1 flex-col">
          <h4 class="m-0 mb-2 flex-shrink-0 text-[13px] font-semibold text-fg">{{ $t('titlebar.updateModal.releaseNotes') }}</h4>
          <div class="min-h-[120px] max-h-[300px] flex-1 overflow-y-auto rounded-md bg-[#f6f8fa] p-3 text-[13px] dark:bg-[#1e1e1e]" @click="handleReleaseNotesClick">
            <div class="markdown-body" v-html="releaseInfo?.releaseBody || $t('titlebar.updateModal.noReleaseNotes')"></div>
          </div>
        </div>

        <!-- Download Section -->
        <div class="flex-shrink-0">
          <!-- Download Buttons -->
          <div v-if="!isDownloading && !downloadedFile" class="flex flex-col gap-2.5">
            <div v-for="asset in releaseInfo?.assets" :key="asset.name" class="rounded-md bg-[#f6f8fa] px-3 py-2.5 dark:bg-[#1e1e1e]">
              <div class="mb-2 flex items-center justify-between">
                <span class="truncate text-xs font-medium text-fg">{{ asset.name }}</span>
                <span class="ml-2 flex-shrink-0 text-[11px] text-fg-secondary">{{ asset.formattedSize }}</span>
              </div>
              <div class="flex gap-2">
                <button :class="[downloadBtnBase, downloadBtnGithub]" @click="startDownload(asset.url, asset.name)">
                  <svg class="shrink-0" width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                    <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/>
                  </svg>
                  {{ $t('titlebar.updateModal.downloadFromGitHub') }}
                </button>
                <button :class="[downloadBtnBase, downloadBtnProxy]" @click="startDownload(asset.proxyUrl, asset.name)">
                  <svg class="shrink-0" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                    <polyline points="7,10 12,15 17,10"/>
                    <line x1="12" y1="15" x2="12" y2="3"/>
                  </svg>
                  {{ $t('titlebar.updateModal.downloadWithProxy') }}
                </button>
              </div>
            </div>
          </div>

          <!-- Download Progress -->
          <div v-if="isDownloading" class="rounded-md bg-[#f6f8fa] p-3 dark:bg-[#1e1e1e]">
            <div class="mb-2 flex items-center justify-between">
              <span class="text-xs font-medium text-fg">{{ $t('titlebar.updateModal.downloading') }}</span>
              <span class="text-xs font-semibold text-accent dark:text-[#4fc3f7]">{{ downloadProgress.percent }}%</span>
            </div>
            <div class="mb-2 h-1 w-full overflow-hidden rounded-[2px] bg-[#e9ecef] dark:bg-[#404040]">
              <div class="h-full rounded-[2px] bg-accent transition-[width] duration-300 dark:bg-[#4fc3f7]" :style="{ width: downloadProgress.percent + '%' }"></div>
            </div>
            <div class="flex items-center justify-between">
              <span class="text-[11px] text-fg-secondary">{{ formatBytes(downloadProgress.downloaded) }} / {{ formatBytes(downloadProgress.total) }}</span>
              <button class="flex cursor-pointer items-center gap-1 rounded border border-line bg-transparent px-2 py-1 text-[11px] text-fg-secondary transition-colors hover:border-[#ccc] hover:bg-[#f0f0f0] dark:hover:border-[#666] dark:hover:bg-[#404040]" @click="cancelDownload">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <line x1="18" y1="6" x2="6" y2="18"/>
                  <line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
                {{ $t('titlebar.updateModal.cancelDownload') }}
              </button>
            </div>
          </div>

          <!-- Download Complete -->
          <div v-if="downloadedFile && !isDownloading" class="rounded-md border border-[#86efac] bg-[#f0fff4] p-3 dark:border-[#2d8a56] dark:bg-[#1a3a2a]">
            <div class="mb-2.5 flex items-center gap-1.5 text-[13px] font-medium text-[#16a34a] dark:text-[#4ade80]">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="20,6 9,17 4,12"/>
              </svg>
              <span>{{ $t('titlebar.updateModal.downloadComplete') }}</span>
            </div>
            <div class="flex gap-2">
              <button :class="[actionBtnBase, actionBtnDefault]" @click="openDownloadFolder">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
                </svg>
                {{ $t('titlebar.updateModal.openDownloadFolder') }}
              </button>
              <button :class="[actionBtnBase, actionBtnPrimary]" @click="installUpdate">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                  <polyline points="7,10 12,15 17,10"/>
                  <line x1="12" y1="15" x2="12" y2="3"/>
                </svg>
                {{ $t('titlebar.updateModal.installUpdate') }}
              </button>
            </div>

            <!-- macOS Quarantine Notice -->
            <div v-if="isMacOS" class="mt-3 flex gap-2.5 rounded-md border border-[#fcd34d] bg-[#fef9e7] px-3 py-2.5 dark:border-[#d97706] dark:bg-[#3d2f0d]">
              <svg class="mt-px shrink-0 text-[#ca8a04] dark:text-[#fbbf24]" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10"/>
                <line x1="12" y1="16" x2="12" y2="12"/>
                <line x1="12" y1="8" x2="12.01" y2="8"/>
              </svg>
              <div class="flex-1 text-[11px] leading-[1.4] text-[#854d0e] dark:text-[#fcd34d]">
                <span>{{ $t('titlebar.updateModal.macQuarantineNotice') }}</span>
                <div class="mt-1.5 flex items-center gap-1.5">
                  <code class="flex-1 break-all rounded bg-white/60 px-2 py-1.5 font-mono text-[10px] text-[#713f12] dark:bg-black/30 dark:text-[#fde68a]">sudo xattr -d com.apple.quarantine /Applications/AutoSlides.app</code>
                  <button class="shrink-0 cursor-pointer rounded border-none bg-transparent p-1 text-[#854d0e] transition-all hover:bg-white/50 hover:text-[#713f12] active:scale-95 dark:text-[#fcd34d] dark:hover:bg-black/30 dark:hover:text-[#fde68a]" @click="copyQuarantineCommand" :title="$t('titlebar.copy')">
                    <svg v-if="!commandCopied" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                    </svg>
                    <svg v-else width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <polyline points="20 6 9 17 4 12"/>
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="flex flex-shrink-0 justify-end gap-2 border-t border-line bg-elevated p-4">
        <button v-if="isAutoCheck" :class="footerCancelCls" @click="skipFor7Days">{{ $t('titlebar.skipFor7Days') }}</button>
        <button :class="footerSaveCls" @click="closeUpdateModal">
          {{ isAutoCheck ? $t('titlebar.remindMeLater') : $t('titlebar.updateModal.close') }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import '../../assets/github-markdown.css'

interface ReleaseAsset {
  name: string
  url: string
  size: number
  formattedSize: string
  proxyUrl: string
}

interface ReleaseInfo {
  success: boolean
  hasUpdate: boolean
  currentVersion: string
  latestVersion: string
  releaseUrl: string
  releaseBody: string
  publishedAt: string
  assets: ReleaseAsset[]
}

interface DownloadProgress {
  downloaded: number
  total: number
  percent: number
}

const { t: $t } = useI18n()

// Button class strings (download asset / complete actions / footer).
const downloadBtnBase =
  'flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded border-none px-3 py-1.5 text-xs font-medium text-white transition-colors'
const downloadBtnGithub = 'bg-[#24292e] hover:bg-[#1a1e22] dark:bg-[#3d3d3d] dark:hover:bg-[#4d4d4d]'
const downloadBtnProxy = 'bg-accent hover:bg-[#0068b3] dark:hover:bg-[#3a8eef]'
const actionBtnBase =
  'flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded border px-3 py-1.5 text-xs transition-colors'
const actionBtnDefault =
  'border-line bg-white text-fg hover:border-[#ccc] hover:bg-[#f6f8fa] dark:border-[#555] dark:bg-[#3d3d3d] dark:hover:border-[#666] dark:hover:bg-[#4d4d4d]'
const actionBtnPrimary = 'border-accent bg-accent text-white hover:border-[#0068b3] hover:bg-[#0068b3] dark:hover:bg-[#3a8eef]'
const footerCancelCls =
  'rounded border border-line bg-elevated px-4 py-2 text-xs text-fg-secondary cursor-pointer transition-colors hover:border-line-strong hover:bg-hover'
const footerSaveCls =
  'rounded border border-accent bg-accent px-4 py-2 text-xs text-white cursor-pointer transition-colors hover:border-accent-hover hover:bg-accent-hover'

const isMacOS = ref(false)

const showUpdateModal = ref(false)
const releaseInfo = ref<ReleaseInfo | null>(null)
const isDownloading = ref(false)
const downloadedFile = ref<string | null>(null)
const downloadProgress = ref<DownloadProgress>({ downloaded: 0, total: 0, percent: 0 })
const isAutoCheck = ref(false)
const commandCopied = ref(false)

let cleanupDownloadProgress: (() => void) | null = null
let cleanupDownloadComplete: (() => void) | null = null
let cleanupDownloadError: (() => void) | null = null
let cleanupPromptQuit: (() => void) | null = null
let cleanupCheckForUpdates: (() => void) | null = null
let cleanupAutoCheck: (() => void) | null = null

onMounted(() => {
  isMacOS.value = navigator.userAgent.toLowerCase().includes('mac')

  cleanupCheckForUpdates = (window as any).electronAPI.update.onCheckForUpdates(() => {
    checkForUpdates()
  })

  cleanupAutoCheck = (window as any).electronAPI.update.onAutoCheckForUpdates(() => {
    autoCheckForUpdates()
  })

  cleanupDownloadProgress = (window as any).electronAPI.update.onDownloadProgress((progress: DownloadProgress) => {
    downloadProgress.value = progress
  })

  cleanupDownloadComplete = (window as any).electronAPI.update.onDownloadComplete((filename: string) => {
    downloadedFile.value = filename
    isDownloading.value = false
  })

  cleanupDownloadError = (window as any).electronAPI.update.onDownloadError((error: string) => {
    isDownloading.value = false
    console.error('Download error:', error)
    ;(window as any).electronAPI.dialog.showMessageBox({
      type: 'error',
      title: $t('titlebar.updateModal.downloadFailed'),
      message: error,
      buttons: [$t('titlebar.ok')]
    })
  })

  cleanupPromptQuit = (window as any).electronAPI.update.onPromptQuit(() => {
    promptQuitAndInstall()
  })
})

onUnmounted(() => {
  if (cleanupCheckForUpdates) cleanupCheckForUpdates()
  if (cleanupAutoCheck) cleanupAutoCheck()
  if (cleanupDownloadProgress) cleanupDownloadProgress()
  if (cleanupDownloadComplete) cleanupDownloadComplete()
  if (cleanupDownloadError) cleanupDownloadError()
  if (cleanupPromptQuit) cleanupPromptQuit()
})

const formatDate = (dateString: string): string => {
  const date = new Date(dateString)
  return date.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })
}

const formatBytes = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
}

const openUpdateModal = (fromAutoCheck = false) => {
  isAutoCheck.value = fromAutoCheck
  showUpdateModal.value = true
}

const closeUpdateModal = () => {
  showUpdateModal.value = false
  isAutoCheck.value = false
  commandCopied.value = false
  if (!isDownloading.value) {
    downloadedFile.value = null
    downloadProgress.value = { downloaded: 0, total: 0, percent: 0 }
  }
}

const skipFor7Days = async () => {
  const skipUntilTimestamp = Date.now() + 7 * 24 * 60 * 60 * 1000
  await (window as any).electronAPI.config.setSkipUpdateCheckUntil(skipUntilTimestamp)
  closeUpdateModal()
}

const handleReleaseNotesClick = (event: MouseEvent) => {
  const target = event.target as HTMLElement
  const link = target.closest('a')
  if (link) {
    event.preventDefault()
    event.stopPropagation()
    const href = link.getAttribute('href')
    if (href) {
      (window as any).electronAPI.shell.openExternal(href)
    }
  }
}

const copyQuarantineCommand = () => {
  navigator.clipboard.writeText('sudo xattr -d com.apple.quarantine /Applications/AutoSlides.app')
  commandCopied.value = true
  setTimeout(() => {
    commandCopied.value = false
  }, 2000)
}

const startDownload = async (url: string, filename: string) => {
  isDownloading.value = true
  downloadedFile.value = null
  downloadProgress.value = { downloaded: 0, total: 0, percent: 0 }

  try {
    await (window as any).electronAPI.update.downloadUpdate(url, filename)
  } catch (error) {
    console.error('Failed to start download:', error)
    isDownloading.value = false
  }
}

const cancelDownload = async () => {
  try {
    await (window as any).electronAPI.update.cancelDownload()
    isDownloading.value = false
    downloadProgress.value = { downloaded: 0, total: 0, percent: 0 }
  } catch (error) {
    console.error('Failed to cancel download:', error)
  }
}

const openDownloadFolder = async () => {
  try {
    await (window as any).electronAPI.update.openDownloadFolder()
  } catch (error) {
    console.error('Failed to open download folder:', error)
  }
}

const installUpdate = async () => {
  if (!downloadedFile.value) return

  try {
    await (window as any).electronAPI.update.installUpdate(downloadedFile.value)
  } catch (error) {
    console.error('Failed to install update:', error)
  }
}

const promptQuitAndInstall = async () => {
  const response = await (window as any).electronAPI.dialog.showMessageBox({
    type: 'question',
    title: $t('titlebar.updateModal.confirmQuit'),
    message: $t('titlebar.updateModal.confirmQuitMessage'),
    buttons: [$t('titlebar.updateModal.quit'), $t('titlebar.updateModal.later')],
    defaultId: 0,
    cancelId: 1
  })

  if (response.response === 0) {
    await (window as any).electronAPI.window.close()
  }
}

const checkForUpdates = async () => {
  try {
    const result = await (window as any).electronAPI.update.checkForUpdates()

    if (!result.success) {
      await (window as any).electronAPI.dialog.showMessageBox({
        type: 'error',
        title: $t('titlebar.updateCheckFailed'),
        message: $t('titlebar.updateCheckFailedMessage'),
        detail: $t('titlebar.updateCheckFailedDetail', { error: result.error }),
        buttons: [$t('titlebar.ok')],
        defaultId: 0,
        cancelId: 0
      })
      return
    }

    if (result.hasUpdate) {
      releaseInfo.value = result
      downloadedFile.value = null
      downloadProgress.value = { downloaded: 0, total: 0, percent: 0 }
      isDownloading.value = false
      openUpdateModal()
    } else {
      await (window as any).electronAPI.dialog.showMessageBox({
        type: 'info',
        title: $t('titlebar.noUpdateAvailable'),
        message: $t('titlebar.noUpdateMessage'),
        detail: $t('titlebar.noUpdateDetail', { currentVersion: result.currentVersion }),
        buttons: [$t('titlebar.ok')],
        defaultId: 0,
        cancelId: 0
      })
    }
  } catch (error) {
    console.error('Failed to check for updates:', error)
  }
}

const autoCheckForUpdates = async () => {
  try {
    const skipUntil = await (window as any).electronAPI.config.getSkipUpdateCheckUntil()
    if (Date.now() < skipUntil) {
      return
    }

    const oldFilesResult = await (window as any).electronAPI.update.findOldUpdates()
    if (oldFilesResult.success && oldFilesResult.files && oldFilesResult.files.length > 0) {
      const response = await (window as any).electronAPI.dialog.showMessageBox({
        type: 'question',
        title: $t('titlebar.updateModal.oldFilesFound'),
        message: $t('titlebar.updateModal.oldFilesMessage', { count: oldFilesResult.files.length }),
        buttons: [$t('titlebar.updateModal.deleteOldFiles'), $t('titlebar.updateModal.keepOldFiles')],
        defaultId: 0,
        cancelId: 1
      })

      if (response.response === 0) {
        await (window as any).electronAPI.update.deleteOldUpdates(oldFilesResult.files)
      }
    }

    const result = await (window as any).electronAPI.update.checkForUpdates()

    if (!result.success || !result.hasUpdate) {
      return
    }

    releaseInfo.value = result
    downloadedFile.value = null
    downloadProgress.value = { downloaded: 0, total: 0, percent: 0 }
    isDownloading.value = false
    openUpdateModal(true)
  } catch {
    // Silently ignore all errors
  }
}

// Expose the public entry points so the parent (TitleBar) can trigger from menus.
defineExpose({
  checkForUpdates,
  autoCheckForUpdates,
  getCurrentVersion: () => releaseInfo.value?.currentVersion ?? ''
})
</script>

