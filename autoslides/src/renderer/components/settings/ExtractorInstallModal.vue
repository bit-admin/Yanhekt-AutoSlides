<template>
  <div v-if="visible" class="fixed inset-0 z-[10000] flex items-center justify-center bg-black/50 dark:bg-black/70" @click="onClose">
    <div class="flex max-h-[85vh] w-[640px] max-w-[90vw] flex-col overflow-hidden rounded-lg bg-modal" @click.stop>
      <div class="flex items-center justify-between border-b border-line p-4">
        <h3 class="m-0 text-base font-semibold text-fg">{{ $t('extractorInstall.title') }}</h3>
        <button @click="onClose" class="btn-icon">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"/>
            <line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>

      <div class="flex flex-1 flex-col overflow-y-auto p-4 text-fg">
        <div v-if="loading" class="py-4 text-[13px] text-fg-secondary">
          {{ $t('extractorInstall.loadingRelease') }}
        </div>

        <div v-else-if="loadError" class="py-4 text-[13px] text-[#b1361e]">
          <p class="m-0 mb-2">{{ $t('extractorInstall.loadError') }}: {{ loadError }}</p>
          <button :class="[actionBtnBase, actionBtnDefault]" @click="loadRelease">{{ $t('extractorInstall.retry') }}</button>
        </div>

        <template v-else-if="release">
          <!-- Version Info -->
          <div class="mb-4 flex items-center gap-3">
            <div class="rounded-2xl bg-accent px-3 py-1.5 text-sm font-semibold text-white">{{ release.tagName }}</div>
            <div class="flex flex-col gap-0.5">
              <span v-if="release.publishedAt" class="text-[11px] text-fg-muted">{{ formatDate(release.publishedAt) }}</span>
            </div>
          </div>

          <!-- Release Notes -->
          <div v-if="release.bodyHtml || release.body" class="mb-4 flex min-h-0 flex-1 flex-col">
            <h4 class="m-0 mb-2 flex-shrink-0 text-[13px] font-semibold text-fg">{{ $t('extractorInstall.releaseNotes') }}</h4>
            <div class="min-h-[120px] max-h-[300px] flex-1 overflow-y-auto rounded-md bg-[#f6f8fa] p-3 text-[13px] dark:bg-[#1e1e1e]" @click="handleReleaseNotesClick">
              <div v-if="release.bodyHtml" class="markdown-body" v-html="release.bodyHtml"></div>
              <pre v-else class="m-0 whitespace-pre-wrap font-mono text-xs text-fg">{{ release.body }}</pre>
            </div>
          </div>

          <div class="flex-shrink-0">
            <!-- Linux: Build from Source notice -->
            <div v-if="isLinux" class="rounded-md bg-[#f6f8fa] p-3 text-[13px] text-fg dark:bg-[#1e1e1e]">
              <p class="m-0 mb-2.5">{{ $t('extractorInstall.linuxBuildNotice') }}</p>
              <button :class="[actionBtnBase, actionBtnPrimary]" @click="openRepo">
                {{ $t('extractorInstall.openRepo') }}
              </button>
            </div>

            <!-- No matching asset for current platform -->
            <div v-else-if="!release.assets || release.assets.length === 0" class="rounded-md bg-[#f6f8fa] p-3 text-[13px] text-fg dark:bg-[#1e1e1e]">
              <p class="m-0 mb-2.5">{{ $t('extractorInstall.noPlatformAsset') }}</p>
              <button :class="[actionBtnBase, actionBtnDefault]" @click="openRepo">{{ $t('extractorInstall.openRepo') }}</button>
            </div>

            <!-- Asset list (idle) -->
            <div v-else-if="!isDownloading && !downloadedFile" class="flex flex-col gap-2.5">
              <div v-for="asset in release.assets" :key="asset.name" class="rounded-md bg-[#f6f8fa] px-3 py-2.5 dark:bg-[#1e1e1e]">
                <div class="mb-2 flex items-center justify-between">
                  <span class="truncate text-xs font-medium text-fg">{{ asset.name }}</span>
                  <span class="ml-2 flex-shrink-0 text-[11px] text-fg-secondary">{{ asset.formattedSize }}</span>
                </div>
                <div class="flex gap-2">
                  <button :class="[downloadBtnBase, downloadBtnGithub]" @click="startDownload(asset.url, asset.name)">
                    <svg class="shrink-0" width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/>
                    </svg>
                    {{ $t('extractorInstall.downloadFromGitHub') }}
                  </button>
                  <button :class="[downloadBtnBase, downloadBtnProxy]" @click="startDownload(asset.proxyUrl, asset.name)">
                    <svg class="shrink-0" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
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
            <div v-if="isDownloading" class="rounded-md bg-[#f6f8fa] p-3 dark:bg-[#1e1e1e]">
              <div class="mb-2 flex items-center justify-between">
                <span class="text-xs font-medium text-fg">{{ $t('extractorInstall.downloading') }}</span>
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
                  {{ $t('extractorInstall.cancelDownload') }}
                </button>
              </div>
            </div>

            <!-- Download complete -->
            <div v-if="downloadedFile && !isDownloading" class="rounded-md border border-[#86efac] bg-[#f0fff4] p-3 dark:border-[#2d8a56] dark:bg-[#1a3a2a]">
              <div class="mb-2.5 flex items-center gap-1.5 text-[13px] font-medium text-[#16a34a] dark:text-[#4ade80]">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="20,6 9,17 4,12"/>
                </svg>
                <span>{{ $t('extractorInstall.downloadComplete') }}</span>
              </div>
              <div class="flex gap-2">
                <button :class="[actionBtnBase, actionBtnDefault]" @click="openDownloadFolder">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
                  </svg>
                  {{ $t('extractorInstall.openDownloadFolder') }}
                </button>
                <button :class="[actionBtnBase, actionBtnPrimary]" @click="installInstaller">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                    <polyline points="7,10 12,15 17,10"/>
                    <line x1="12" y1="15" x2="12" y2="3"/>
                  </svg>
                  {{ $t('extractorInstall.install') }}
                </button>
              </div>

              <div v-if="isMacOS" class="mt-3 flex gap-2.5 rounded-md border border-[#fcd34d] bg-[#fef9e7] px-3 py-2.5 dark:border-[#d97706] dark:bg-[#3d2f0d]">
                <svg class="mt-px shrink-0 text-[#ca8a04] dark:text-[#fbbf24]" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <circle cx="12" cy="12" r="10"/>
                  <line x1="12" y1="16" x2="12" y2="12"/>
                  <line x1="12" y1="8" x2="12.01" y2="8"/>
                </svg>
                <div class="flex-1 text-[11px] leading-[1.4] text-[#854d0e] dark:text-[#fcd34d]">
                  <span>{{ $t('extractorInstall.macInstallNotice') }}</span>
                </div>
              </div>
            </div>
          </div>
        </template>
      </div>

      <div class="flex flex-shrink-0 justify-end gap-2 border-t border-line bg-elevated p-4">
        <button :class="footerSaveCls" @click="onClose">{{ $t('extractorInstall.close') }}</button>
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

// Button class strings (mirror UpdateManager so the two release modals match).
const downloadBtnBase =
  'flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded border-none px-3 py-1.5 text-xs font-medium text-white transition-colors'
const downloadBtnGithub = 'bg-[#24292e] hover:bg-[#1a1e22] dark:bg-[#3d3d3d] dark:hover:bg-[#4d4d4d]'
const downloadBtnProxy = 'bg-accent hover:bg-[#0068b3] dark:hover:bg-[#3a8eef]'
const actionBtnBase =
  'flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded border px-3 py-1.5 text-xs transition-colors'
const actionBtnDefault =
  'border-line bg-white text-fg hover:border-[#ccc] hover:bg-[#f6f8fa] dark:border-[#555] dark:bg-[#3d3d3d] dark:hover:border-[#666] dark:hover:bg-[#4d4d4d]'
const actionBtnPrimary = 'border-accent bg-accent text-white hover:border-[#0068b3] hover:bg-[#0068b3] dark:hover:bg-[#3a8eef]'
const footerSaveCls =
  'rounded border border-accent bg-accent px-4 py-2 text-xs text-white cursor-pointer transition-colors hover:border-accent-hover hover:bg-accent-hover'

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

