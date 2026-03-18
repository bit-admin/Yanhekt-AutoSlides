<template>
  <div class="yuketang-tab">
    <!-- Toolbar -->
    <div class="toolbar">
      <div class="toolbar-left">
        <!-- Nav Buttons -->
        <button class="nav-btn" @click="goBack" :title="$t('pdfmaker.back')">
          <svg width="16" height="16" viewBox="0 0 16 16">
            <path d="M10 3L5 8l5 5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
          </svg>
        </button>
        <button class="nav-btn" @click="goHome" title="Home">
          <svg width="16" height="16" viewBox="0 0 16 16">
            <path d="M2.5 8L8 2.5 13.5 8M4 7v5.5a1 1 0 001 1h2v-3h2v3h2a1 1 0 001-1V7" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
          </svg>
        </button>

        <!-- Lesson ID -->
        <div class="lesson-id-group">
          <label class="field-label">{{ $t('yuketang.lessonId') }}</label>
          <input
            class="lesson-id-input"
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
          <select v-model="exportFormat" class="format-select">
            <option value="pdf">{{ $t('yuketang.formatPdf') }}</option>
            <option value="images">{{ $t('yuketang.formatImages') }}</option>
          </select>
        </div>

        <!-- Export Button -->
        <button
          class="export-btn"
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
        class="yuketang-webview"
      ></webview>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useYuketang } from '../composables/useYuketang'

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

    // Redirect window.open to same webview
    const handleNewWindow = (event: Event) => {
      const url = (event as Event & { url: string }).url
      webview.loadURL(url)
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
  background-color: #ffffff;
  color: #333;
}

/* Toolbar */
.toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 16px;
  background-color: #fafafa;
  border-bottom: 1px solid #e0e0e0;
  gap: 12px;
}

.toolbar-left, .toolbar-right {
  display: flex;
  align-items: center;
  gap: 8px;
}

.nav-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border: 1px solid #ddd;
  border-radius: 4px;
  background-color: white;
  cursor: pointer;
  transition: all 0.2s;
  color: #555;
}

.nav-btn:hover {
  background-color: #f0f0f0;
  border-color: #ccc;
}

.lesson-id-group {
  display: flex;
  align-items: center;
  gap: 6px;
}

.field-label {
  font-size: 12px;
  color: #666;
  white-space: nowrap;
}

.lesson-id-input {
  width: 120px;
  padding: 5px 8px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 12px;
  background-color: #f8f8f8;
  color: #666;
}

.format-group {
  display: flex;
  align-items: center;
  gap: 6px;
}

.format-select {
  padding: 5px 8px;
  border: 1px solid #ddd;
  border-radius: 4px;
  background-color: white;
  font-size: 12px;
  cursor: pointer;
}

.format-select:focus {
  outline: none;
  border-color: #007acc;
}

.export-btn {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 6px 14px;
  border: none;
  border-radius: 4px;
  background-color: #007acc;
  color: white;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  white-space: nowrap;
}

.export-btn:hover:not(:disabled) {
  background-color: #005a9e;
}

.export-btn:disabled {
  background-color: #ccc;
  cursor: not-allowed;
}

.spinner-small {
  width: 12px;
  height: 12px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top-color: white;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

/* Status Bar */
.status-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 16px;
  background-color: #f5f5f5;
  border-bottom: 1px solid #e0e0e0;
  min-height: 28px;
}

.status-message {
  font-size: 11px;
  color: #666;
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
  color: #007acc;
  font-size: 11px;
  cursor: pointer;
  padding: 2px 6px;
  border-radius: 3px;
  transition: background-color 0.15s;
  white-space: nowrap;
}

.open-folder-btn:hover {
  background-color: rgba(0, 122, 204, 0.1);
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

/* Dark Mode */
@media (prefers-color-scheme: dark) {
  .yuketang-tab {
    background-color: #1e1e1e;
    color: #e0e0e0;
  }

  .toolbar {
    background-color: #252525;
    border-bottom-color: #3d3d3d;
  }

  .nav-btn {
    background-color: #333;
    border-color: #555;
    color: #ccc;
  }

  .nav-btn:hover {
    background-color: #404040;
    border-color: #666;
  }

  .field-label {
    color: #aaa;
  }

  .lesson-id-input {
    background-color: #2d2d2d;
    border-color: #555;
    color: #aaa;
  }

  .format-select {
    background-color: #333;
    border-color: #555;
    color: #e0e0e0;
  }

  .format-select:focus {
    border-color: #007acc;
  }

  .status-bar {
    background-color: #252525;
    border-bottom-color: #3d3d3d;
  }

  .status-message {
    color: #aaa;
  }

  .open-folder-btn {
    color: #4a9eff;
  }

  .open-folder-btn:hover {
    background-color: rgba(74, 158, 255, 0.1);
  }
}
</style>
