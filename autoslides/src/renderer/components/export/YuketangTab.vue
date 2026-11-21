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
        <button class="btn nav-btn" @click="goHome" :title="$t('navigation.home')">
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

    <!-- Embedded site -->
    <div class="guest-container">
      <GuestSurface kind="yuketang" :url="YUKETANG_HOME" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount } from 'vue'
import { useI18n } from 'vue-i18n'
import { useYuketang } from '@features/export/useYuketang'
import { createGuestClient } from '@shared/services/guestView'
import GuestSurface from '@renderer/components/shell/GuestSurface.vue'

const { t } = useI18n()

const {
  lessonId,
  isExporting,
  exportFormat,
  statusMessage,
  latestExportDir,
  latestPdfPath,
  exportedPresentationCount,
  canExport,
  scheduleNavigationEvaluation,
  startExport,
  openExportResult,
} = useYuketang()

const YUKETANG_HOME = 'https://www.yuketang.cn/web'
const guest = createGuestClient('yuketang')

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
      return t('yuketang.exported', { count: exportedPresentationCount.value, format: exportFormat.value.toUpperCase() })
    default:
      // Raw progress message or error from main process
      return msg
  }
})

// Navigation
const goBack = () => { void guest.goBack() }
const goHome = () => { void guest.loadURL(YUKETANG_HOME) }

guest.on('did-navigate', (event) => scheduleNavigationEvaluation(event.url))
guest.on('did-navigate-in-page', (event) => scheduleNavigationEvaluation(event.url))
guest.on('did-stop-loading', async () => {
  const url = await guest.getURL()
  if (url) scheduleNavigationEvaluation(url, 0)
})
onBeforeUnmount(() => guest.dispose())
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
  background-color: var(--bg-subtle);
  border-bottom: 1px solid var(--border-color);
  gap: 8px 12px;
  flex-wrap: wrap;
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

/* Embedded site */
.guest-container {
  flex: 1;
  overflow: hidden;
}

</style>
