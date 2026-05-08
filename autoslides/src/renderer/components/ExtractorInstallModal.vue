<template>
  <div v-if="visible" class="modal-overlay" @click="onClose">
    <div class="modal-content extractor-install-modal" @click.stop>
      <div class="modal-header">
        <h3>{{ $t('extractorInstall.title') }}</h3>
        <button @click="onClose" class="close-btn">
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
          {{ $t('extractorInstall.loadError') }}: {{ loadError }}
          <div style="margin-top: 8px;">
            <button class="action-btn" @click="loadRelease">{{ $t('extractorInstall.retry') }}</button>
          </div>
        </div>

        <template v-else-if="release">
          <!-- Version Info -->
          <div class="version-header">
            <div class="version-badge">{{ release.tagName }}</div>
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

          <!-- Linux: Build from Source notice -->
          <div v-if="isLinux" class="build-from-source-section">
            <p>{{ $t('extractorInstall.linuxBuildNotice') }}</p>
            <button class="action-btn" @click="openRepo">
              {{ $t('extractorInstall.openRepo') }}
            </button>
          </div>

          <!-- Asset list / Progress / Complete -->
          <div v-else-if="!release.assets || release.assets.length === 0" class="empty-section">
            {{ $t('extractorInstall.noPlatformAsset') }}
            <div style="margin-top: 8px;">
              <button class="action-btn" @click="openRepo">{{ $t('extractorInstall.openRepo') }}</button>
            </div>
          </div>

          <div v-else class="download-section">
            <div v-if="!isDownloading && !downloadedFile" class="download-assets">
              <div v-for="asset in release.assets" :key="asset.name" class="asset-item">
                <div class="asset-info">
                  <span class="asset-name">{{ asset.name }}</span>
                  <span class="asset-size">{{ asset.formattedSize }}</span>
                </div>
                <div class="asset-actions">
                  <button class="download-btn" @click="startDownload(asset.url, asset.name)">
                    {{ $t('extractorInstall.downloadFromGitHub') }}
                  </button>
                  <button class="download-btn secondary" @click="startDownload(asset.proxyUrl, asset.name)">
                    {{ $t('extractorInstall.downloadWithProxy') }}
                  </button>
                </div>
              </div>
            </div>

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
                <button class="cancel-download-btn" @click="cancelDownload">
                  {{ $t('extractorInstall.cancelDownload') }}
                </button>
              </div>
            </div>

            <div v-if="downloadedFile && !isDownloading" class="download-complete-section">
              <div class="complete-badge">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="20,6 9,17 4,12"/>
                </svg>
                <span>{{ $t('extractorInstall.downloadComplete') }}</span>
              </div>
              <div class="complete-actions">
                <button class="action-btn" @click="openDownloadFolder">
                  {{ $t('extractorInstall.openDownloadFolder') }}
                </button>
                <button class="action-btn primary" @click="installInstaller">
                  {{ $t('extractorInstall.install') }}
                </button>
              </div>
              <div v-if="isMacOS" class="quarantine-notice">
                <span>{{ $t('extractorInstall.macInstallNotice') }}</span>
              </div>
            </div>
          </div>
        </template>
      </div>

      <div class="modal-actions">
        <button class="save-btn" @click="onClose">{{ $t('extractorInstall.close') }}</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted, onBeforeUnmount } from 'vue'
import '../assets/github-markdown.css'

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
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1100;
}
.modal-content {
  background: var(--bg-color, #fff);
  color: var(--text-color, inherit);
  border-radius: 8px;
  width: min(640px, 90vw);
  max-height: 86vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 12px 48px rgba(0,0,0,0.3);
}
.modal-header {
  padding: 14px 18px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid var(--border-color, #e0e0e0);
}
.modal-header h3 { margin: 0; font-size: 16px; }
.close-btn {
  background: transparent;
  border: none;
  cursor: pointer;
  color: inherit;
  padding: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
}
.modal-body {
  flex: 1 1 auto;
  overflow: auto;
  padding: 16px 18px;
}
.modal-actions {
  padding: 12px 18px;
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  border-top: 1px solid var(--border-color, #e0e0e0);
}
.loading-section, .error-section, .empty-section {
  padding: 16px 0;
  font-size: 13px;
  color: var(--text-color-secondary, #666);
}
.error-section { color: #d73a49; }

.version-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
}
.version-badge {
  background: #2ea44f;
  color: #fff;
  padding: 4px 10px;
  border-radius: 6px;
  font-weight: 600;
  font-size: 13px;
}
.version-meta { font-size: 12px; color: var(--text-color-secondary, #666); }

.release-notes-section h4 { margin: 8px 0 6px 0; font-size: 13px; }
.release-notes-scroll {
  max-height: 220px;
  overflow: auto;
  padding: 8px 12px;
  border: 1px solid var(--border-color, #e0e0e0);
  border-radius: 6px;
  background: var(--input-bg, transparent);
}
.release-body-plain { white-space: pre-wrap; font-family: ui-monospace, Menlo, monospace; font-size: 12px; }

.download-section { margin-top: 12px; }
.asset-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 8px 12px;
  border: 1px solid var(--border-color, #e0e0e0);
  border-radius: 6px;
  margin-bottom: 8px;
}
.asset-info { display: flex; flex-direction: column; }
.asset-name { font-size: 13px; font-weight: 500; word-break: break-all; }
.asset-size { font-size: 11px; color: var(--text-color-secondary, #666); }
.asset-actions { display: flex; gap: 6px; flex-wrap: wrap; }
.download-btn, .action-btn, .save-btn, .cancel-download-btn {
  padding: 6px 12px;
  font-size: 12px;
  border: 1px solid var(--border-color, #ccc);
  border-radius: 4px;
  background: var(--button-bg, transparent);
  color: var(--text-color, inherit);
  cursor: pointer;
}
.download-btn { background: #2ea44f; color: #fff; border-color: #2ea44f; }
.download-btn.secondary { background: transparent; color: var(--text-color, inherit); border-color: var(--border-color, #ccc); }
.action-btn.primary { background: #2ea44f; color: #fff; border-color: #2ea44f; }
.download-progress-section { padding: 8px 0; }
.progress-header, .progress-footer { display: flex; align-items: center; justify-content: space-between; margin: 4px 0; font-size: 12px; }
.progress-bar {
  background: var(--border-color, #e0e0e0);
  height: 8px;
  border-radius: 4px;
  overflow: hidden;
}
.progress-fill {
  background: #2ea44f;
  height: 100%;
  transition: width 0.2s ease;
}
.complete-badge { display: flex; align-items: center; gap: 6px; font-weight: 500; color: #2ea44f; margin-bottom: 8px; }
.complete-actions { display: flex; gap: 8px; }
.quarantine-notice {
  margin-top: 10px;
  padding: 8px;
  border: 1px solid var(--border-color, #e0e0e0);
  border-radius: 6px;
  font-size: 12px;
  color: var(--text-color-secondary, #666);
}
.build-from-source-section {
  padding: 12px;
  border: 1px dashed var(--border-color, #ccc);
  border-radius: 6px;
  font-size: 13px;
}
</style>
