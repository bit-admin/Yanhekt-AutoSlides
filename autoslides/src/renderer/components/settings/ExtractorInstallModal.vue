<template>
  <div v-if="visible" class="modal-overlay" @click="onClose">
    <div class="modal-content extractor-install-modal" @click.stop>
      <div class="modal-header">
        <h3>{{ $t('extractorInstall.title') }}</h3>
        <button @click="onClose" class="btn--icon">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"/>
            <line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>

      <div class="modal-body">
        <div v-if="loading" class="loading-section">
          {{ $t('extractorInstall.loadingRelease') }}
        </div>

        <div v-else-if="loadError" class="error-section">
          <p>{{ $t('extractorInstall.loadError') }}: {{ loadError }}</p>
          <button class="btn action-btn" @click="loadRelease">{{ $t('extractorInstall.retry') }}</button>
        </div>

        <template v-else-if="release">
          <!-- Version Info -->
          <div class="version-header">
            <div class="badge badge--version">{{ release.tagName }}</div>
            <div class="version-meta">
              <span v-if="release.publishedAt" class="publish-date">{{ formatDate(release.publishedAt) }}</span>
            </div>
          </div>

          <!-- Release Notes -->
          <div v-if="release.bodyHtml || release.body" class="release-notes-section">
            <h4>{{ $t('extractorInstall.releaseNotes') }}</h4>
            <div class="release-notes-scroll" @click="handleReleaseNotesClick">
              <div v-if="release.bodyHtml" class="markdown-body" v-html="release.bodyHtml"></div>
              <pre v-else class="release-body-plain">{{ release.body }}</pre>
            </div>
          </div>

          <div class="download-section">
            <!-- Linux: Build from Source notice -->
            <div v-if="isLinux" class="build-from-source-section">
              <p>{{ $t('extractorInstall.linuxBuildNotice') }}</p>
              <button class="btn btn--primary action-btn" @click="openRepo">
                {{ $t('extractorInstall.openRepo') }}
              </button>
            </div>

            <!-- No matching asset for current platform -->
            <div v-else-if="!release.assets || release.assets.length === 0" class="build-from-source-section">
              <p>{{ $t('extractorInstall.noPlatformAsset') }}</p>
              <button class="btn action-btn" @click="openRepo">{{ $t('extractorInstall.openRepo') }}</button>
            </div>

            <!-- Asset list (idle) -->
            <div v-else-if="!isDownloading && !downloadedFile" class="download-assets">
              <div v-for="asset in release.assets" :key="asset.name" class="asset-item">
                <div class="asset-info">
                  <span class="asset-name">{{ asset.name }}</span>
                  <span class="asset-size">{{ asset.formattedSize }}</span>
                </div>
                <div class="asset-actions">
                  <button class="download-btn" @click="startDownload(asset.url, asset.name)">
                    <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/>
                    </svg>
                    {{ $t('extractorInstall.downloadFromGitHub') }}
                  </button>
                  <button class="download-btn secondary" @click="startDownload(asset.proxyUrl, asset.name)">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                      <polyline points="7,10 12,15 17,10"/>
                      <line x1="12" y1="15" x2="12" y2="3"/>
                    </svg>
                    {{ $t('extractorInstall.downloadWithProxy') }}
                  </button>
                </div>
              </div>
            </div>

            <!-- Download progress -->
            <div v-if="isDownloading" class="download-progress-section">
              <div class="progress-header">
                <span class="progress-label">{{ $t('extractorInstall.downloading') }}</span>
                <span class="progress-percent">{{ downloadProgress.percent }}%</span>
              </div>
              <div class="progress-bar">
                <div class="progress-fill" :style="{ width: downloadProgress.percent + '%' }"></div>
              </div>
              <div class="progress-footer">
                <span class="progress-bytes">{{ formatBytes(downloadProgress.downloaded) }} / {{ formatBytes(downloadProgress.total) }}</span>
                <button class="btn btn--sm" @click="cancelDownload">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <line x1="18" y1="6" x2="6" y2="18"/>
                    <line x1="6" y1="6" x2="18" y2="18"/>
                  </svg>
                  {{ $t('extractorInstall.cancelDownload') }}
                </button>
              </div>
            </div>

            <!-- Download complete -->
            <div v-if="downloadedFile && !isDownloading" class="download-complete-section">
              <div class="complete-badge">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="20,6 9,17 4,12"/>
                </svg>
                <span>{{ $t('extractorInstall.downloadComplete') }}</span>
              </div>
              <div class="complete-actions">
                <button class="btn action-btn" @click="openDownloadFolder">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
                  </svg>
                  {{ $t('extractorInstall.openDownloadFolder') }}
                </button>
                <button class="btn btn--primary action-btn" @click="installInstaller">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                    <polyline points="7,10 12,15 17,10"/>
                    <line x1="12" y1="15" x2="12" y2="3"/>
                  </svg>
                  {{ $t('extractorInstall.install') }}
                </button>
              </div>

              <div v-if="isMacOS" class="quarantine-notice">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <circle cx="12" cy="12" r="10"/>
                  <line x1="12" y1="16" x2="12" y2="12"/>
                  <line x1="12" y1="8" x2="12.01" y2="8"/>
                </svg>
                <div class="notice-text">
                  <span>{{ $t('extractorInstall.macInstallNotice') }}</span>
                </div>
              </div>
            </div>
          </div>
        </template>
      </div>

      <div class="modal-actions">
        <button class="btn btn--primary" @click="onClose">{{ $t('extractorInstall.close') }}</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted, onBeforeUnmount } from 'vue'
import '../../assets/github-markdown.css'

interface ReleaseAsset {
  name: string
  url: string
  size: number
  formattedSize: string
  proxyUrl: string
}

interface ReleaseInfo {
  tagName: string
  name?: string
  body?: string
  bodyHtml?: string
  htmlUrl?: string
  publishedAt?: string
  assets: ReleaseAsset[]
  repoUrl?: string
}

const props = defineProps<{ visible: boolean }>()
const emit = defineEmits<{ (e: 'close'): void }>()

const isLinux = navigator.userAgent.toLowerCase().includes('linux') && !navigator.userAgent.toLowerCase().includes('android')
const isMacOS = navigator.userAgent.toLowerCase().includes('mac')

const loading = ref(false)
const loadError = ref<string | null>(null)
const release = ref<ReleaseInfo | null>(null)
const isDownloading = ref(false)
const downloadProgress = ref({ downloaded: 0, total: 0, percent: 0 })
const downloadedFile = ref<string | null>(null)

let cleanupProgress: (() => void) | null = null
let cleanupComplete: (() => void) | null = null
let cleanupError: (() => void) | null = null

function formatBytes(bytes: number): string {
  if (!bytes || bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString()
  } catch {
    return iso
  }
}

async function loadRelease() {
  loading.value = true
  loadError.value = null
  try {
    const res = await window.electronAPI.extractorInstaller.checkLatest()
    if (!res.success) {
      loadError.value = res.error || 'Unknown error'
      return
    }
    release.value = {
      tagName: res.tagName || '',
      name: res.name,
      body: res.body || '',
      bodyHtml: res.bodyHtml || '',
      htmlUrl: res.htmlUrl,
      publishedAt: res.publishedAt,
      assets: res.assets || [],
      repoUrl: res.repoUrl
    }
  } catch (err) {
    loadError.value = err instanceof Error ? err.message : String(err)
  } finally {
    loading.value = false
  }
}

async function startDownload(url: string, filename: string) {
  isDownloading.value = true
  downloadProgress.value = { downloaded: 0, total: 0, percent: 0 }
  downloadedFile.value = null
  try {
    const result = await window.electronAPI.extractorInstaller.download(url, filename)
    isDownloading.value = false
    if (result.success && result.filePath) {
      downloadedFile.value = filename
    } else if (result.error && !/cancel/i.test(result.error)) {
      loadError.value = result.error
    }
  } catch (err) {
    isDownloading.value = false
    loadError.value = err instanceof Error ? err.message : String(err)
  }
}

async function cancelDownload() {
  try {
    await window.electronAPI.extractorInstaller.cancel()
  } catch (err) {
    console.warn('[ExtractorInstall] cancelDownload failed:', err)
  }
}

async function installInstaller() {
  if (!downloadedFile.value) return
  try {
    await window.electronAPI.extractorInstaller.install(downloadedFile.value)
  } catch (err) {
    console.error('[ExtractorInstall] install failed:', err)
  }
}

async function openDownloadFolder() {
  try {
    await window.electronAPI.extractorInstaller.openDownloadFolder()
  } catch (err) {
    console.error('[ExtractorInstall] openDownloadFolder failed:', err)
  }
}

async function openRepo() {
  try {
    await window.electronAPI.extractorInstaller.openRepo()
  } catch (err) {
    console.error('[ExtractorInstall] openRepo failed:', err)
  }
}

function handleReleaseNotesClick(event: MouseEvent) {
  // Intercept link clicks inside the rendered markdown so they open externally
  const target = event.target as HTMLElement | null
  if (!target) return
  const anchor = target.closest('a')
  if (!anchor) return
  const href = anchor.getAttribute('href')
  if (!href) return
  event.preventDefault()
  void window.electronAPI.shell.openExternal(href)
}

function onClose() {
  emit('close')
}

watch(
  () => props.visible,
  (visible) => {
    if (visible) {
      // Reset transient state and (re)load the release on open
      downloadedFile.value = null
      isDownloading.value = false
      downloadProgress.value = { downloaded: 0, total: 0, percent: 0 }
      void loadRelease()
    }
  }
)

onMounted(() => {
  cleanupProgress = window.electronAPI.extractorInstaller.onProgress((progress) => {
    isDownloading.value = true
    downloadProgress.value = progress
  })
  cleanupComplete = window.electronAPI.extractorInstaller.onComplete((filename) => {
    isDownloading.value = false
    downloadedFile.value = filename
  })
  cleanupError = window.electronAPI.extractorInstaller.onError((message) => {
    isDownloading.value = false
    if (!/cancel/i.test(message)) {
      loadError.value = message
    }
  })
})

onBeforeUnmount(() => {
  cleanupProgress?.()
  cleanupComplete?.()
  cleanupError?.()
})
</script>

<style scoped>
/* Mirrors the update modal in TitleBar.vue (lines 1378+) so the two modals
   feel like one product. Kept scoped per Vue convention; Vue doesn't share
   scoped styles across components so we duplicate. */
/* Backdrop is shared (.modal-overlay in modal.css); only the z-index differs
   so this installer sits above the main app modals. */
.modal-overlay {
  z-index: var(--z-super-modal);
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

.loading-section,
.error-section {
  padding: 16px 0;
  font-size: 13px;
  color: var(--text-secondary);
}

.error-section { color: var(--danger); }
.error-section p { margin: 0 0 8px 0; }

/* Version header */
.version-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
}

.version-meta {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.publish-date {
  font-size: 11px;
  color: var(--text-muted);
}

/* Release notes section */
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
  background: var(--bg-page);
  border-radius: 6px;
  font-size: 13px;
}

.release-body-plain {
  margin: 0;
  white-space: pre-wrap;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 12px;
  color: var(--text-primary);
}

/* Download section */
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
  background: var(--bg-page);
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
  background: var(--brand-github);
  color: var(--text-on-accent);
}

.download-btn:hover {
  background: var(--brand-github-hover);
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

/* Build-from-source / no-asset notice */
.build-from-source-section {
  padding: 12px;
  background: var(--bg-page);
  border-radius: 6px;
  font-size: 13px;
  color: var(--text-primary);
}
.build-from-source-section p {
  margin: 0 0 10px 0;
}

/* Download progress */
.download-progress-section {
  padding: 12px;
  background: var(--bg-page);
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
  margin-bottom: 8px;
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

/* Download complete */
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
}

/* Quarantine notice */
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
  color: var(--warning);
  line-height: 1.4;
}
</style>
