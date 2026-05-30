<template>
  <div class="flex flex-col h-full bg-surface text-text">
    <!-- Toolbar -->
    <div class="flex justify-between items-center py-2 px-4 bg-subtle border-b border-border gap-3">
      <div class="flex items-center gap-2">
        <!-- Nav Buttons -->
        <button class="flex items-center justify-center w-8 h-8 border border-border-input rounded bg-surface cursor-pointer transition-all text-text-secondary hover:bg-page hover:border-border" @click="goBack" :title="$t('pdfmaker.back')">
          <svg width="16" height="16" viewBox="0 0 16 16">
            <path d="M10 3L5 8l5 5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
          </svg>
        </button>
        <button class="flex items-center justify-center w-8 h-8 border border-border-input rounded bg-surface cursor-pointer transition-all text-text-secondary hover:bg-page hover:border-border" @click="goHome" title="Home">
          <svg width="16" height="16" viewBox="0 0 16 16">
            <path d="M2.5 8L8 2.5 13.5 8M4 7v5.5a1 1 0 001 1h2v-3h2v3h2a1 1 0 001-1V7" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
          </svg>
        </button>

        <!-- Lesson ID -->
        <div class="flex items-center gap-1.5">
          <label class="text-xs text-text-secondary whitespace-nowrap">{{ $t('yuketang.lessonId') }}</label>
          <input
            class="w-[120px] py-[5px] px-2 border border-border-input rounded text-xs bg-elevated text-text-secondary"
            :value="lessonId"
            :placeholder="$t('yuketang.lessonIdPlaceholder')"
            readonly
          />
        </div>
      </div>

      <div class="flex items-center gap-2">
        <!-- Format -->
        <div class="flex items-center gap-1.5">
          <label class="text-xs text-text-secondary whitespace-nowrap">{{ $t('yuketang.format') }}</label>
          <select v-model="exportFormat" class="py-[5px] px-2 border border-border-input rounded bg-surface text-xs cursor-pointer focus:outline-none focus:border-accent">
            <option value="pdf">{{ $t('yuketang.formatPdf') }}</option>
            <option value="images">{{ $t('yuketang.formatImages') }}</option>
          </select>
        </div>

        <!-- Export Button -->
        <button
          class="flex items-center gap-1 py-1.5 px-3.5 border-none rounded bg-accent text-white text-xs font-medium cursor-pointer transition-all whitespace-nowrap hover:bg-accent-strong disabled:bg-border disabled:cursor-not-allowed"
          @click="startExport"
          :disabled="!canExport"
        >
          <svg v-if="!isExporting" width="16" height="16" viewBox="0 0 16 16">
            <path d="M8 1v10M4 7l4 4 4-4M2 13h12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
          </svg>
          <span v-if="isExporting" class="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
          <span>{{ isExporting ? $t('yuketang.exporting') : $t('yuketang.export') }}</span>
        </button>
      </div>
    </div>

    <!-- Status Bar -->
    <div class="flex items-center justify-between py-1.5 px-4 bg-page border-b border-border min-h-[28px]">
      <span class="text-[11px] text-text-secondary flex-1 overflow-hidden text-ellipsis whitespace-nowrap">{{ displayStatus }}</span>
      <button
        v-if="latestExportDir || latestPdfPath"
        class="flex items-center gap-1 border-none bg-transparent text-accent text-[11px] cursor-pointer py-0.5 px-1.5 rounded transition-colors hover:bg-accent/10 whitespace-nowrap"
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
        class="w-full h-full border-none"
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
