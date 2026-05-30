<template>
  <!-- Update Modal -->
  <div v-if="showUpdateModal" class="modal-overlay" @click="closeUpdateModal">
    <div class="modal-content update-modal" @click.stop>
      <div class="modal-header">
        <h3>{{ $t('titlebar.updateModal.title') }}</h3>
        <button @click="closeUpdateModal" class="close-btn">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"/>
            <line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>

      <div class="modal-body">
        <!-- Version Info -->
        <div class="version-header">
          <div class="version-badge">v{{ releaseInfo?.latestVersion }}</div>
          <div class="version-meta">
            <span class="current-version">{{ $t('titlebar.updateModal.currentVersion') }}: v{{ releaseInfo?.currentVersion }}</span>
            <span v-if="releaseInfo?.publishedAt" class="publish-date">{{ formatDate(releaseInfo.publishedAt) }}</span>
          </div>
        </div>

        <!-- Release Notes -->
        <div class="release-notes-section">
          <h4>{{ $t('titlebar.updateModal.releaseNotes') }}</h4>
          <div class="release-notes-scroll" @click="handleReleaseNotesClick">
            <div class="markdown-body" v-html="releaseInfo?.releaseBody || $t('titlebar.updateModal.noReleaseNotes')"></div>
          </div>
        </div>

        <!-- Download Section -->
        <div class="download-section">
          <!-- Download Buttons -->
          <div v-if="!isDownloading && !downloadedFile" class="download-assets">
            <div v-for="asset in releaseInfo?.assets" :key="asset.name" class="asset-item">
              <div class="asset-info">
                <span class="asset-name">{{ asset.name }}</span>
                <span class="asset-size">{{ asset.formattedSize }}</span>
              </div>
              <div class="asset-actions">
                <button class="download-btn" @click="startDownload(asset.url, asset.name)">
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                    <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/>
                  </svg>
                  {{ $t('titlebar.updateModal.downloadFromGitHub') }}
                </button>
                <button class="download-btn secondary" @click="startDownload(asset.proxyUrl, asset.name)">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
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
          <div v-if="isDownloading" class="download-progress-section">
            <div class="progress-header">
              <span class="progress-label">{{ $t('titlebar.updateModal.downloading') }}</span>
              <span class="progress-percent">{{ downloadProgress.percent }}%</span>
            </div>
            <div class="progress-bar">
              <div class="progress-fill" :style="{ width: downloadProgress.percent + '%' }"></div>
            </div>
            <div class="progress-footer">
              <span class="progress-bytes">{{ formatBytes(downloadProgress.downloaded) }} / {{ formatBytes(downloadProgress.total) }}</span>
              <button class="cancel-download-btn" @click="cancelDownload">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <line x1="18" y1="6" x2="6" y2="18"/>
                  <line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
                {{ $t('titlebar.updateModal.cancelDownload') }}
              </button>
            </div>
          </div>

          <!-- Download Complete -->
          <div v-if="downloadedFile && !isDownloading" class="download-complete-section">
            <div class="complete-badge">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="20,6 9,17 4,12"/>
              </svg>
              <span>{{ $t('titlebar.updateModal.downloadComplete') }}</span>
            </div>
            <div class="complete-actions">
              <button class="action-btn" @click="openDownloadFolder">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
                </svg>
                {{ $t('titlebar.updateModal.openDownloadFolder') }}
              </button>
              <button class="action-btn primary" @click="installUpdate">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                  <polyline points="7,10 12,15 17,10"/>
                  <line x1="12" y1="15" x2="12" y2="3"/>
                </svg>
                {{ $t('titlebar.updateModal.installUpdate') }}
              </button>
            </div>

            <!-- macOS Quarantine Notice -->
            <div v-if="isMacOS" class="quarantine-notice">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10"/>
                <line x1="12" y1="16" x2="12" y2="12"/>
                <line x1="12" y1="8" x2="12.01" y2="8"/>
              </svg>
              <div class="notice-text">
                <span>{{ $t('titlebar.updateModal.macQuarantineNotice') }}</span>
                <div class="code-with-copy">
                  <code>sudo xattr -d com.apple.quarantine /Applications/AutoSlides.app</code>
                  <button class="copy-btn" @click="copyQuarantineCommand" :title="$t('titlebar.copy')">
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

      <div class="modal-actions">
        <button v-if="isAutoCheck" class="cancel-btn" @click="skipFor7Days">{{ $t('titlebar.skipFor7Days') }}</button>
        <button class="save-btn" @click="closeUpdateModal">
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

<style scoped>
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10000;
}

.modal-content {
  background-color: var(--bg-modal);
  border-radius: 8px;
  width: 640px;
  max-width: 90vw;
  max-height: 85vh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px;
  border-bottom: 1px solid var(--border-color);
}

.modal-header h3 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
}

.close-btn {
  background: none;
  border: none;
  cursor: pointer;
  padding: 4px;
  border-radius: 4px;
  color: var(--text-secondary);
  transition: background-color 0.2s;
}

.close-btn:hover {
  background-color: var(--bg-elevated);
}

.modal-body {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow-y: auto;
  padding: 16px;
  color: var(--text-primary);
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 16px;
  border-top: 1px solid var(--border-color);
  background-color: var(--bg-elevated);
  flex-shrink: 0;
}

.cancel-btn, .save-btn {
  padding: 8px 16px;
  border: 1px solid var(--border-input);
  border-radius: 4px;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s;
}

.cancel-btn {
  background-color: var(--bg-elevated);
  color: var(--text-secondary);
}

.cancel-btn:hover {
  background-color: var(--bg-hover);
  border-color: var(--border-strong);
}

.save-btn {
  background-color: var(--accent);
  color: var(--text-on-accent);
  border-color: var(--accent);
}

.save-btn:hover {
  background-color: var(--accent-hover);
  border-color: var(--accent-hover);
}

.version-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
}

.version-badge {
  background: var(--accent);
  color: var(--text-on-accent);
  padding: 6px 12px;
  border-radius: 16px;
  font-size: 14px;
  font-weight: 600;
}

.version-meta {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.current-version {
  font-size: 12px;
  color: var(--text-secondary);
}

.publish-date {
  font-size: 11px;
  color: var(--text-muted);
}

.release-notes-section {
  margin-bottom: 16px;
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.release-notes-section h4 {
  margin: 0 0 8px 0;
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
  flex-shrink: 0;
}

.release-notes-scroll {
  flex: 1;
  min-height: 120px;
  max-height: 300px;
  overflow-y: auto;
  padding: 12px;
  background: var(--bg-elevated);
  border-radius: 6px;
  font-size: 13px;
}

.download-section {
  flex-shrink: 0;
}

.download-assets {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.asset-item {
  padding: 10px 12px;
  background: var(--bg-elevated);
  border-radius: 6px;
}

.asset-info {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.asset-name {
  font-size: 12px;
  color: var(--text-primary);
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.asset-size {
  font-size: 11px;
  color: var(--text-secondary);
  flex-shrink: 0;
  margin-left: 8px;
}

.asset-actions {
  display: flex;
  gap: 8px;
}

.download-btn {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 6px 12px;
  border: none;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  background: #24292e;
  color: white;
}

.download-btn:hover {
  background: #1a1e22;
}

.download-btn.secondary {
  background: var(--accent);
}

.download-btn.secondary:hover {
  background: var(--accent-hover);
}

.download-btn svg {
  flex-shrink: 0;
}

.download-progress-section {
  padding: 12px;
  background: var(--bg-elevated);
  border-radius: 6px;
}

.progress-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.progress-label {
  font-size: 12px;
  color: var(--text-primary);
  font-weight: 500;
}

.progress-percent {
  font-size: 12px;
  color: var(--accent);
  font-weight: 600;
}

.progress-bar {
  width: 100%;
  height: 4px;
  background-color: var(--bg-hover);
  border-radius: 2px;
  overflow: hidden;
  margin-bottom: 8px;
}

.progress-fill {
  height: 100%;
  background-color: var(--accent);
  border-radius: 2px;
  transition: width 0.3s ease;
}

.progress-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.progress-bytes {
  font-size: 11px;
  color: var(--text-secondary);
}

.cancel-download-btn {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  background: transparent;
  border: 1px solid var(--border-input);
  border-radius: 4px;
  font-size: 11px;
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.2s;
}

.cancel-download-btn:hover {
  background: var(--bg-hover);
  border-color: var(--border-input);
}

.download-complete-section {
  padding: 12px;
  background: var(--success-bg);
  border: 1px solid var(--success-border);
  border-radius: 6px;
}

.complete-badge {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 10px;
  font-size: 13px;
  font-weight: 500;
  color: var(--success);
}

.complete-badge svg {
  color: var(--success);
}

.complete-actions {
  display: flex;
  gap: 8px;
}

.action-btn {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 6px 12px;
  border: 1px solid var(--border-input);
  background: var(--bg-surface);
  border-radius: 4px;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s;
}

.action-btn:hover {
  background: var(--bg-elevated);
  border-color: var(--border-input);
}

.action-btn.primary {
  background: var(--accent);
  border-color: var(--accent);
  color: var(--text-on-accent);
}

.action-btn.primary:hover {
  background: var(--accent-hover);
  border-color: var(--accent-hover);
}

.quarantine-notice {
  display: flex;
  gap: 10px;
  padding: 10px 12px;
  background: var(--warning-bg);
  border: 1px solid var(--warning-border);
  border-radius: 6px;
  margin-top: 12px;
}

.quarantine-notice > svg {
  color: var(--warning);
  flex-shrink: 0;
  margin-top: 1px;
}

.notice-text {
  flex: 1;
  font-size: 11px;
  color: var(--text-warning);
  line-height: 1.4;
}

.code-with-copy {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 6px;
}

.notice-text code {
  flex: 1;
  padding: 6px 8px;
  background: rgba(255, 255, 255, 0.6);
  border-radius: 4px;
  font-size: 10px;
  font-family: ui-monospace, SFMono-Regular, SF Mono, Menlo, Consolas, monospace;
  color: #713f12;
  word-break: break-all;
}

.copy-btn {
  flex-shrink: 0;
  padding: 4px;
  background: transparent;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  color: #854d0e;
  transition: all 0.2s;
}

.copy-btn:hover {
  background: rgba(255, 255, 255, 0.5);
  color: #713f12;
}

.copy-btn:active {
  transform: scale(0.95);
}


</style>
