<template>
  <div class="yuketang-tab">
    <!-- Toolbar -->
    <div class="toolbar">
      <div class="toolbar-left">
        <!-- Nav Buttons -->
        <button class="btn nav-btn" @click="goBack" :title="$t('pdfmaker.back')">
          <svg width="16" height="16" viewBox="0 0 16 16">
            <path d="M10 3L5 8l5 5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
          </svg>
        </button>
        <button class="btn nav-btn" @click="goHome" title="Home">
          <svg width="16" height="16" viewBox="0 0 16 16">
            <path d="M2.5 8L8 2.5 13.5 8M4 7v5.5a1 1 0 001 1h2v-3h2v3h2a1 1 0 001-1V7" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
          </svg>
        </button>

        <!-- Lesson ID -->
        <div class="lesson-id-group">
          <label class="field-label">{{ $t('yuketang.lessonId') }}</label>
          <input
            class="text-input lesson-id-input"
            :value="lessonId"
            :placeholder="$t('yuketang.lessonIdPlaceholder')"
            readonly
          />
        </div>
      </div>

      <div class="toolbar-right">
        <!-- Format -->
        <div class="format-group">
          <label class="field-label">{{ $t('yuketang.format') }}</label>
          <select v-model="exportFormat" class="select-field">
            <option value="pdf">{{ $t('yuketang.formatPdf') }}</option>
            <option value="images">{{ $t('yuketang.formatImages') }}</option>
          </select>
        </div>

        <!-- Export Button -->
        <button
          class="btn btn--primary"
          @click="startExport"
          :disabled="!canExport"
        >
          <svg v-if="!isExporting" width="16" height="16" viewBox="0 0 16 16">
            <path d="M8 1v10M4 7l4 4 4-4M2 13h12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
          </svg>
          <span v-if="isExporting" class="spinner-small"></span>
          <span>{{ isExporting ? $t('yuketang.exporting') : $t('yuketang.export') }}</span>
        </button>
      </div>
    </div>

    <!-- Status Bar -->
    <div class="status-bar">
      <span class="status-message">{{ displayStatus }}</span>
      <button
        v-if="latestExportDir || latestPdfPath"
        class="open-folder-btn"
        @click="openExportResult"
      >
        <span>{{ latestPdfPath ? $t('yuketang.openPdf') : $t('yuketang.openFolder') }}</span>
        <svg width="12" height="12" viewBox="0 0 16 16">
          <path d="M3 8h9M9 4l4 4-4 4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
        </svg>
      </button>
    </div>

    <!-- Webview -->
    <div class="webview-container">
      <webview
        ref="webviewRef"
        src="https://www.yuketang.cn/web"
        partition="persist:yuketang"
        allowpopups
        class="yuketang-webview"
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

<style scoped>
.yuketang-tab {
  display: flex;
  flex-direction: column;
  height: 100%;
  background-color: var(--bg-surface);
  color: var(--text-primary);
}

/* Toolbar */
.toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 16px;
  background-color: var(--bg-elevated);
  border-bottom: 1px solid var(--border-color);
  gap: 12px;
}

.toolbar-left, .toolbar-right {
  display: flex;
  align-items: center;
  gap: 8px;
}

.nav-btn {
  width: 32px;
  height: 32px;
  padding: 0;
  flex-shrink: 0;
}

.nav-btn svg {
  flex-shrink: 0;
}

.lesson-id-group {
  display: flex;
  align-items: center;
  gap: 6px;
}

.lesson-id-input {
  width: 120px;
}

.format-group {
  display: flex;
  align-items: center;
  gap: 6px;
}

.spinner-small {
  width: 12px;
  height: 12px;
  border: 2px solid var(--overlay-light);
  border-top-color: var(--text-on-accent);
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

/* Status Bar */
.status-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 16px;
  background-color: var(--bg-subtle);
  border-bottom: 1px solid var(--border-color);
  min-height: 28px;
}

.status-message {
  font-size: 11px;
  color: var(--text-secondary);
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.open-folder-btn {
  display: flex;
  align-items: center;
  gap: 4px;
  border: none;
  background: transparent;
  color: var(--link-color);
  font-size: 11px;
  cursor: pointer;
  padding: 2px 6px;
  border-radius: 3px;
  transition: background-color 0.15s;
  white-space: nowrap;
}

.open-folder-btn:hover {
  background-color: var(--focus-ring);
}

/* Webview Container */
.webview-container {
  flex: 1;
  overflow: hidden;
}

.yuketang-webview {
  width: 100%;
  height: 100%;
  border: none;
}
</style>
