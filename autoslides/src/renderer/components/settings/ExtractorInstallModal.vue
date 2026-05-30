<template>
  <div v-if="visible" class="modal-overlay" @click="onClose">
    <div class="modal-content w-[640px] max-w-[90vw] max-h-[85vh]" @click.stop>
      <div class="modal-header">
        <h3 class="m-0 text-base font-semibold text-text">{{ $t('extractorInstall.title') }}</h3>
        <button @click="onClose" class="close-btn bg-transparent border-none cursor-pointer p-1 rounded text-text-secondary transition-colors duration-200 hover:bg-elevated">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"/>
            <line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>

      <div class="modal-body flex-col text-text">
        <div v-if="loading" class="py-4 text-[13px] text-text-secondary">
          {{ $t('extractorInstall.loadingRelease') }}
        </div>

        <div v-else-if="loadError" class="py-4 text-[13px] text-danger">
          <p class="m-0 mb-2">{{ $t('extractorInstall.loadError') }}: {{ loadError }}</p>
          <button class="action-btn flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 border border-border-input bg-surface rounded text-xs cursor-pointer transition-all duration-200 hover:bg-elevated hover:border-border-strong" @click="loadRelease">{{ $t('extractorInstall.retry') }}</button>
        </div>

        <template v-else-if="release">
          <!-- Version Info -->
          <div class="flex items-center gap-3 mb-4">
            <div class="bg-accent text-white py-1.5 px-3 rounded-2xl text-sm font-semibold">{{ release.tagName }}</div>
            <div class="flex flex-col gap-0.5">
              <span v-if="release.publishedAt" class="text-[11px] text-text-muted">{{ formatDate(release.publishedAt) }}</span>
            </div>
          </div>

          <!-- Release Notes -->
          <div v-if="release.bodyHtml || release.body" class="mb-4 flex-1 min-h-0 flex flex-col">
            <h4 class="m-0 mb-2 text-[13px] font-semibold text-text shrink-0">{{ $t('extractorInstall.releaseNotes') }}</h4>
            <div class="release-notes-scroll flex-1 min-h-[120px] max-h-[300px] overflow-y-auto p-3 bg-elevated rounded-md text-[13px]" @click="handleReleaseNotesClick">
              <div v-if="release.bodyHtml" class="markdown-body" v-html="release.bodyHtml"></div>
              <pre v-else class="m-0 whitespace-pre-wrap font-mono text-xs text-text">{{ release.body }}</pre>
            </div>
          </div>

          <div class="shrink-0">
            <!-- Linux: Build from Source notice -->
            <div v-if="isLinux" class="p-3 bg-elevated rounded-md text-[13px] text-text">
              <p class="m-0 mb-2.5">{{ $t('extractorInstall.linuxBuildNotice') }}</p>
              <button class="action-btn primary flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 border border-accent bg-accent text-white rounded text-xs cursor-pointer transition-all duration-200 hover:bg-accent-hover hover:border-accent-hover" @click="openRepo">
                {{ $t('extractorInstall.openRepo') }}
              </button>
            </div>

            <!-- No matching asset for current platform -->
            <div v-else-if="!release.assets || release.assets.length === 0" class="p-3 bg-elevated rounded-md text-[13px] text-text">
              <p class="m-0 mb-2.5">{{ $t('extractorInstall.noPlatformAsset') }}</p>
              <button class="action-btn flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 border border-border-input bg-surface rounded text-xs cursor-pointer transition-all duration-200 hover:bg-elevated hover:border-border-strong" @click="openRepo">{{ $t('extractorInstall.openRepo') }}</button>
            </div>

            <!-- Asset list (idle) -->
            <div v-else-if="!isDownloading && !downloadedFile" class="flex flex-col gap-2.5">
              <div v-for="asset in release.assets" :key="asset.name" class="p-2.5 px-3 bg-elevated rounded-md">
                <div class="flex justify-between items-center mb-2">
                  <span class="text-xs text-text font-medium overflow-hidden text-ellipsis whitespace-nowrap">{{ asset.name }}</span>
                  <span class="text-[11px] text-text-secondary shrink-0 ml-2">{{ asset.formattedSize }}</span>
                </div>
                <div class="flex gap-2">
                  <button class="download-btn flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 border-none rounded text-xs font-medium cursor-pointer transition-all duration-200 bg-bg-surface text-white hover:bg-[#1a1e22]" @click="startDownload(asset.url, asset.name)">
                    <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/>
                    </svg>
                    {{ $t('extractorInstall.downloadFromGitHub') }}
                  </button>
                  <button class="download-btn secondary flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 border-none rounded text-xs font-medium cursor-pointer transition-all duration-200 bg-accent text-white hover:bg-accent-hover" @click="startDownload(asset.proxyUrl, asset.name)">
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
            <div v-if="isDownloading" class="p-3 bg-elevated rounded-md">
              <div class="flex justify-between items-center mb-2">
                <span class="text-xs text-text font-medium">{{ $t('extractorInstall.downloading') }}</span>
                <span class="text-xs text-accent font-semibold">{{ downloadProgress.percent }}%</span>
              </div>
              <div class="w-full h-1 bg-hover rounded-sm overflow-hidden mb-2">
                <div class="h-full bg-accent rounded-sm transition-[width] duration-300" :style="{ width: downloadProgress.percent + '%' }"></div>
              </div>
              <div class="flex justify-between items-center">
                <span class="text-[11px] text-text-secondary">{{ formatBytes(downloadProgress.downloaded) }} / {{ formatBytes(downloadProgress.total) }}</span>
                <button class="flex items-center gap-1 py-1 px-2 bg-transparent border border-border-input rounded text-[11px] text-text-secondary cursor-pointer transition-all duration-200 hover:bg-elevated hover:border-border-strong" @click="cancelDownload">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <line x1="18" y1="6" x2="6" y2="18"/>
                    <line x1="6" y1="6" x2="18" y2="18"/>
                  </svg>
                  {{ $t('extractorInstall.cancelDownload') }}
                </button>
              </div>
            </div>

            <!-- Download complete -->
            <div v-if="downloadedFile && !isDownloading" class="p-3 bg-success-bg border border-success-border rounded-md">
              <div class="flex items-center gap-1.5 mb-2.5 text-[13px] font-medium text-success">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="20,6 9,17 4,12"/>
                </svg>
                <span>{{ $t('extractorInstall.downloadComplete') }}</span>
              </div>
              <div class="flex gap-2">
                <button class="action-btn flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 border border-border-input bg-surface rounded text-xs cursor-pointer transition-all duration-200 hover:bg-elevated hover:border-border-strong" @click="openDownloadFolder">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
                  </svg>
                  {{ $t('extractorInstall.openDownloadFolder') }}
                </button>
                <button class="action-btn primary flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 border border-accent bg-accent text-white rounded text-xs cursor-pointer transition-all duration-200 hover:bg-accent-hover hover:border-accent-hover" @click="installInstaller">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                    <polyline points="7,10 12,15 17,10"/>
                    <line x1="12" y1="15" x2="12" y2="3"/>
                  </svg>
                  {{ $t('extractorInstall.install') }}
                </button>
              </div>

              <div v-if="isMacOS" class="flex gap-2.5 py-2.5 px-3 bg-warning-bg border border-warning-border rounded-md mt-3">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="text-warning shrink-0 mt-px">
                  <circle cx="12" cy="12" r="10"/>
                  <line x1="12" y1="16" x2="12" y2="12"/>
                  <line x1="12" y1="8" x2="12.01" y2="8"/>
                </svg>
                <div class="flex-1 text-[11px] text-warning leading-[1.4]">
                  <span>{{ $t('extractorInstall.macInstallNotice') }}</span>
                </div>
              </div>
            </div>
          </div>
        </template>
      </div>

      <div class="modal-actions">
        <button class="py-2 px-4 border border-accent bg-accent text-white rounded text-xs cursor-pointer transition-all duration-200 hover:bg-accent-hover hover:border-accent-hover" @click="onClose">{{ $t('extractorInstall.close') }}</button>
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
/* Override global modal-header padding (16px 20px → 16px) for this component. */
.modal-header {
  padding: 16px;
}
</style>
