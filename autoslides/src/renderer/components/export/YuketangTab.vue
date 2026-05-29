<template>
  <div class="flex h-full flex-col bg-surface text-fg">
    <!-- Toolbar -->
    <div class="flex items-center justify-between gap-3 border-b border-line bg-subtle px-4 py-2">
      <div class="flex items-center gap-2">
        <!-- Nav Buttons -->
        <button :class="navBtn" @click="goBack" :title="$t('pdfmaker.back')">
          <svg width="16" height="16" viewBox="0 0 16 16">
            <path d="M10 3L5 8l5 5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
          </svg>
        </button>
        <button :class="navBtn" @click="goHome" title="Home">
          <svg width="16" height="16" viewBox="0 0 16 16">
            <path d="M2.5 8L8 2.5 13.5 8M4 7v5.5a1 1 0 001 1h2v-3h2v3h2a1 1 0 001-1V7" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
          </svg>
        </button>

        <!-- Lesson ID -->
        <div class="flex items-center gap-1.5">
          <label class="whitespace-nowrap text-xs text-fg-secondary">{{ $t('yuketang.lessonId') }}</label>
          <input
            class="w-[120px] rounded border border-line-input bg-[#f8f8f8] px-2 py-[5px] text-xs text-fg-secondary dark:bg-[#2d2d2d]"
            :value="lessonId"
            :placeholder="$t('yuketang.lessonIdPlaceholder')"
            readonly
          />
        </div>
      </div>

      <div class="flex items-center gap-2">
        <!-- Format -->
        <div class="flex items-center gap-1.5">
          <label class="whitespace-nowrap text-xs text-fg-secondary">{{ $t('yuketang.format') }}</label>
          <select v-model="exportFormat" class="cursor-pointer rounded border border-line-input bg-surface px-2 py-[5px] text-xs text-fg focus:border-accent focus:outline-none dark:bg-[#333]">
            <option value="pdf">{{ $t('yuketang.formatPdf') }}</option>
            <option value="images">{{ $t('yuketang.formatImages') }}</option>
          </select>
        </div>

        <!-- Export Button -->
        <button
          class="flex cursor-pointer items-center gap-1 whitespace-nowrap rounded border-none bg-accent px-3.5 py-1.5 text-xs font-medium text-white transition-colors enabled:hover:bg-accent-strong disabled:cursor-not-allowed disabled:bg-[#ccc]"
          @click="startExport"
          :disabled="!canExport"
        >
          <svg v-if="!isExporting" width="16" height="16" viewBox="0 0 16 16">
            <path d="M8 1v10M4 7l4 4 4-4M2 13h12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
          </svg>
          <span v-if="isExporting" class="h-3 w-3 animate-spin rounded-full border-2 border-white/30 border-t-white"></span>
          <span>{{ isExporting ? $t('yuketang.exporting') : $t('yuketang.export') }}</span>
        </button>
      </div>
    </div>

    <!-- Status Bar -->
    <div class="flex min-h-[28px] items-center justify-between border-b border-line bg-[#f5f5f5] px-4 py-1.5 dark:bg-[#252525]">
      <span class="flex-1 truncate text-[11px] text-fg-secondary">{{ displayStatus }}</span>
      <button
        v-if="latestExportDir || latestPdfPath"
        class="flex cursor-pointer items-center gap-1 whitespace-nowrap rounded-[3px] border-none bg-transparent px-1.5 py-0.5 text-[11px] text-accent transition-colors hover:bg-accent/10"
        @click="openExportResult"
      >
        <span>{{ latestPdfPath ? $t('yuketang.openPdf') : $t('yuketang.openFolder') }}</span>
        <svg width="12" height="12" viewBox="0 0 16 16">
          <path d="M3 8h9M9 4l4 4-4 4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
        </svg>
      </button>
    </div>

    <!-- Webview -->
    <div class="flex-1 overflow-hidden">
      <webview
        ref="webviewRef"
        src="https://www.yuketang.cn/web"
        partition="persist:yuketang"
        allowpopups
        class="h-full w-full border-none"
      ></webview>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useYuketang } from '@features/export/useYuketang'

const { t } = useI18n()

const {
  lessonId,
  isExporting,
  exportFormat,
  statusMessage,
  latestExportDir,
  latestPdfPath,
  canExport,
  scheduleNavigationEvaluation,
  startExport,
  openExportResult,
} = useYuketang()

const navBtn = 'flex h-8 w-8 items-center justify-center rounded border border-line-input bg-surface text-fg-secondary cursor-pointer transition-colors hover:border-[#ccc] hover:bg-[#f0f0f0] dark:bg-[#333] dark:hover:border-[#666] dark:hover:bg-[#404040]'

const webviewRef = ref<HTMLElement | null>(null)

// Map status message keys to i18n translations
const displayStatus = computed(() => {
  const msg = statusMessage.value
  // Check if it's an i18n key
  switch (msg) {
    case 'defaultStatus':
      return t('yuketang.defaultStatus')
    case 'lessonReady':
      return t('yuketang.lessonReady')
    case 'classReady':
      return t('yuketang.classReady')
    case 'classWaiting':
      return t('yuketang.classWaiting')
    case 'exporting':
      return t('yuketang.exporting')
    case 'exported':
      return t('yuketang.exported', { count: 1, format: exportFormat.value.toUpperCase() })
    default:
      // Raw progress message or error from main process
      return msg
  }
})

// Navigation
const goBack = () => {
  const webview = webviewRef.value as unknown as Electron.WebviewTag
  if (webview?.canGoBack?.()) {
    webview.goBack()
  }
}

const goHome = () => {
  const webview = webviewRef.value as unknown as Electron.WebviewTag
  webview?.loadURL?.('https://www.yuketang.cn/web')
}

onMounted(() => {
  // Wait for webview to be available in DOM
  const setupWebview = () => {
    const webview = webviewRef.value as unknown as Electron.WebviewTag
    if (!webview) return

    // Handle webview navigation events
    const handleDidNavigate = (event: Event) => {
      const url = (event as Event & { url: string }).url
      scheduleNavigationEvaluation(url, 180)
    }

    const handleDidNavigateInPage = (event: Event) => {
      const url = (event as Event & { url: string }).url
      scheduleNavigationEvaluation(url, 180)
    }

    const handleDidStopLoading = () => {
      const url = webview.getURL?.()
      if (url) {
        scheduleNavigationEvaluation(url, 0)
      }
    }

    // Redirect window.open to same webview (backup for main process handler)
    const handleNewWindow = (event: Event) => {
      event.preventDefault()
      const url = (event as Event & { url: string }).url
      if (url) {
        webview.loadURL(url)
      }
    }

    webview.addEventListener('did-navigate', handleDidNavigate as EventListener)
    webview.addEventListener('did-navigate-in-page', handleDidNavigateInPage as EventListener)
    webview.addEventListener('did-stop-loading', handleDidStopLoading as EventListener)
    webview.addEventListener('new-window', handleNewWindow as EventListener)
  }

  // Give DOM time to mount the webview
  setTimeout(setupWebview, 100)
})
</script>

