<template>
  <!-- Layout mirrors ResultsWindow (Slides): toolbar / list / optional progress / footer. -->
  <div class="lectures-page">
    <div class="toolbar">
      <div class="toolbar-left">
        <button class="btn refresh-btn" @click="loadVideos" :disabled="isLoading">
          <svg width="16" height="16" viewBox="0 0 16 16" :class="{ spinning: isLoading }" aria-hidden="true">
            <path d="M13.65 2.35A7.958 7.958 0 008 0a8 8 0 108 8h-2a6 6 0 11-1.76-4.24l-2.12 2.12H16V0l-2.35 2.35z" fill="currentColor"/>
          </svg>
          {{ $t('lectures.refresh') }}
        </button>

        <button class="btn" @click="openOutputDirectory">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
          </svg>
          {{ $t('settings.openFolder') }}
        </button>

        <button
          class="edit-btn"
          :class="{ 'edit-btn-active': isSelectMode }"
          :disabled="videos.length === 0 || isLoading"
          @click="toggleSelectMode"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
            <rect x="1.5" y="1.5" width="13" height="13" rx="2" ry="2" fill="none" stroke="currentColor" stroke-width="1.4"/>
            <path d="M4.5 8.2l2.4 2.4 4.6-5.2" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          {{ isSelectMode ? $t('lectures.doneSelecting') : $t('lectures.select') }}
          <span v-if="isSelectMode && selectedPaths.length > 0" class="edit-count">
            {{ selectedPaths.length }}
          </span>
        </button>
      </div>

      <div class="actions">
        <button
          class="action-btn action-btn--primary"
          :disabled="!canCompress"
          :title="compressDisabledReason"
          @click="openCompress"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
            <path d="M3 2h10a1 1 0 011 1v10a1 1 0 01-1 1H3a1 1 0 01-1-1V3a1 1 0 011-1zm3 2H4v8h8V6h-2V4H6zm1 0v1h2V4H7zm-2 5h6v1H5V9z" fill="currentColor"/>
          </svg>
          {{ $t('lectures.compress') }}
        </button>
        <button
          class="action-btn action-btn--secondary"
          :disabled="!canRename"
          @click="openRename"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
            <path d="M11.5 1.5l3 3L5 14H2v-3L11.5 1.5z" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/>
          </svg>
          {{ $t('lectures.rename') }}
        </button>
      </div>
    </div>

    <div class="content-area custom-scrollbar">
      <div v-if="errorMessage" class="error-banner">{{ errorMessage }}</div>
      <div v-if="isLoading && videos.length === 0" class="loading-state">
        <div class="spinner"></div>
        <p>{{ $t('lectures.loading') }}</p>
      </div>
      <LectureListView
        v-else
        :groups="groups"
        :group-by-course="groupByCourse"
        :is-select-mode="isSelectMode"
        :selected-paths="selectedPaths"
        :is-loading="isLoading"
        :format-bytes="formatBytes"
        :active-path="activeJob?.inputPath"
        :active-progress="activeJob?.progress"
        @toggle-selection="toggleSelection"
        @select-group="selectGroup"
        @reveal="reveal"
      />
    </div>

    <!-- Queue status + full-width progress sit above the footer (Slides progress strip). -->
    <div v-if="queue.hasWork.value" class="queue-status">
      <div class="queue-status-main">
        <template v-if="activeJob">
          <span class="queue-label">{{ $t('lectures.compressing') }}</span>
          <span class="queue-name" :title="activeJob.displayName">{{ activeJob.displayName }}</span>
          <span class="queue-pct">{{ activeJob.progress }}%</span>
        </template>
        <template v-else>
          <span class="queue-label">{{ $t('lectures.queueIdle') }}</span>
        </template>
        <span v-if="queue.queuedCount.value > 0" class="queue-pending">
          {{ $t('lectures.queuedCount', { count: queue.queuedCount.value }) }}
        </span>
      </div>
      <div class="queue-status-actions">
        <button
          v-if="activeJob"
          type="button"
          class="btn"
          @click="() => queue.cancelCurrent()"
        >
          {{ $t('lectures.cancelCompress') }}
        </button>
      </div>
    </div>
    <div
      v-if="activeJob"
      class="progress-bar-container"
      :title="`${activeJob.displayName} — ${activeJob.progress}%`"
    >
      <div class="progress-bar" :style="{ width: `${activeJob.progress}%` }"></div>
    </div>

    <div class="footer">
      <div class="footer-left">
        <template v-if="isSelectMode">
          <button
            type="button"
            class="select-all-btn"
            :disabled="videos.length === 0"
            @click="selectedPaths.length === videos.length ? clearSelection() : selectAll()"
          >
            {{ selectedPaths.length === videos.length ? $t('trash.clearSelection') : $t('trash.selectAll') }}
          </button>
          <span>{{ $t('trash.selected') }}: {{ selectedPaths.length }} / {{ $t('trash.total') }}: {{ videos.length }}</span>
        </template>
        <template v-else>
          <span>{{ $t('trash.total') }}: {{ videos.length }}</span>
        </template>
      </div>
      <label class="group-toggle">
        <input type="checkbox" v-model="groupByCourse" />
        <span>{{ $t('trash.groupByCourse') }}</span>
      </label>
    </div>

    <LectureCompressModal
      v-if="showCompressModal"
      :file-count="selectedScreenRecognised.length"
      @close="showCompressModal = false"
      @start="onCompressStart"
    />

    <LectureRenameModal
      v-if="showRenameModal"
      :items="selectedRecognised"
      :existing-names="videos.map((v) => v.name)"
      @close="showRenameModal = false"
      @done="onRenameDone"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import type { LectureCompressDefaults } from '@common/types'
import { useLecturesPage } from '@features/lectures/useLecturesPage'
import LectureListView from './LectureListView.vue'
import LectureCompressModal from './LectureCompressModal.vue'
import LectureRenameModal from './LectureRenameModal.vue'

const { t } = useI18n()

const {
  videos,
  isLoading,
  errorMessage,
  isSelectMode,
  selectedPaths,
  groupByCourse,
  showCompressModal,
  showRenameModal,
  groups,
  selectedScreenRecognised,
  selectedRecognised,
  queue,
  loadVideos,
  toggleSelectMode,
  toggleSelection,
  selectGroup,
  selectAll,
  clearSelection,
  openOutputDirectory,
  reveal,
  formatBytes,
} = useLecturesPage()

const activeJob = computed(() => queue.activeJob.value)

watch(
  () => queue.hasWork.value,
  (busy, wasBusy) => {
    if (wasBusy && !busy) void loadVideos()
  },
)

const canCompress = computed(
  () => isSelectMode.value && selectedScreenRecognised.value.length > 0,
)

const canRename = computed(
  () => isSelectMode.value && selectedRecognised.value.length > 0,
)

const compressDisabledReason = computed(() => {
  if (!isSelectMode.value) return t('lectures.selectFirst')
  if (selectedScreenRecognised.value.length === 0) return t('lectures.compressScreenOnly')
  return ''
})

const openCompress = () => {
  if (!canCompress.value) return
  showCompressModal.value = true
}

const openRename = () => {
  if (!canRename.value) return
  showRenameModal.value = true
}

const onCompressStart = (options: LectureCompressDefaults) => {
  const { added, skipped } = queue.enqueue(
    selectedScreenRecognised.value.map((v) => ({
      path: v.path,
      displayName: v.displayName,
      fileName: v.name,
      compressPreset: v.compressPreset,
    })),
    options,
  )
  showCompressModal.value = false
  if (added === 0) {
    void window.electronAPI.dialog?.showMessageBox?.({
      type: 'info',
      message:
        skipped > 0
          ? t('lectures.alreadyCompressedOrQueued', { count: skipped })
          : t('lectures.alreadyQueued'),
    })
  } else if (skipped > 0) {
    void window.electronAPI.dialog?.showMessageBox?.({
      type: 'info',
      message: t('lectures.compressSkippedSome', { added, skipped }),
    })
  }
}

const onRenameDone = async () => {
  showRenameModal.value = false
  clearSelection()
  await loadVideos()
}

onMounted(() => {
  void loadVideos()
})
</script>

<style scoped>
/* Match ResultsWindow shell tokens/spacing so Workspace pages feel identical. */
.lectures-page {
  display: flex;
  flex-direction: column;
  height: 100%;
  background-color: var(--bg-surface);
  color: var(--text-primary);
}

.toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 12px;
  background-color: var(--bg-elevated);
  border-bottom: 1px solid var(--border-color);
  gap: 10px;
  flex-wrap: wrap;
  row-gap: 8px;
  flex-shrink: 0;
}

.toolbar-left,
.actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  row-gap: 6px;
}

/* Identical to ResultsWindow Select-mode edit button. */
.edit-btn {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 6px 12px;
  border: 1px solid var(--border-input);
  border-radius: 4px;
  background-color: var(--bg-input);
  color: var(--text-primary);
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  white-space: nowrap;
}

.edit-btn:hover:not(:disabled) {
  background-color: var(--bg-hover);
  border-color: var(--border-strong);
}

.edit-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.edit-btn-active {
  background-color: var(--accent);
  border-color: var(--accent);
  color: var(--text-on-accent);
}

.edit-btn-active:hover:not(:disabled) {
  background-color: var(--accent-hover);
  border-color: var(--accent-hover);
}

.edit-count {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 18px;
  height: 18px;
  padding: 0 5px;
  margin-left: 4px;
  border-radius: 999px;
  background-color: rgba(255, 255, 255, 0.25);
  color: var(--text-on-accent);
  font-size: 11px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

/* Mirrors ResultsWindow notes-btn / restore-btn solid action style. */
.action-btn {
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 6px 10px;
  border: none;
  border-radius: 4px;
  color: var(--text-on-accent);
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  white-space: nowrap;
}

.action-btn--primary {
  background-color: var(--accent);
}

.action-btn--primary:hover:not(:disabled) {
  background-color: var(--accent-hover);
}

.action-btn--secondary {
  background-color: var(--neutral-strong, var(--bg-input));
  color: var(--text-on-accent, var(--text-primary));
  border: 1px solid transparent;
}

.action-btn--secondary:hover:not(:disabled) {
  background-color: var(--neutral-strong-hover, var(--bg-hover));
}

.action-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.content-area {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
  min-height: 0;
}

.error-banner {
  margin-bottom: 12px;
  padding: 8px 12px;
  border-radius: 6px;
  background: var(--danger-bg, var(--bg-subtle));
  color: var(--danger);
  font-size: 12px;
}

.loading-state {
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  color: var(--text-muted);
  font-size: 13px;
}

.queue-status {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 8px 16px;
  border-top: 1px solid var(--border-color);
  background: var(--bg-elevated);
  flex-shrink: 0;
}

.queue-status-main {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
  flex: 1;
  font-size: 12px;
}

.queue-label {
  font-weight: 600;
  color: var(--text-secondary);
  flex-shrink: 0;
}

.queue-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  min-width: 0;
  color: var(--text-primary);
}

.queue-pct,
.queue-pending {
  color: var(--text-muted);
  font-variant-numeric: tabular-nums;
  flex-shrink: 0;
}

.queue-status-actions {
  display: flex;
  gap: 6px;
  flex-shrink: 0;
}

.progress-bar-container {
  height: 3px;
  background-color: var(--border-color);
  width: 100%;
  overflow: hidden;
  flex-shrink: 0;
}

.progress-bar {
  height: 100%;
  background-color: var(--accent);
  transition: width 0.15s ease-out;
}

.footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 16px;
  background-color: var(--bg-elevated);
  border-top: 1px solid var(--border-color);
  font-size: 12px;
  color: var(--text-secondary);
  flex-shrink: 0;
}

.footer-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.select-all-btn {
  padding: 4px 8px;
  border: 1px solid var(--border-input);
  border-radius: 4px;
  background: var(--bg-input);
  color: var(--text-primary);
  font-size: 12px;
  cursor: pointer;
}

.select-all-btn:hover:not(:disabled) {
  background: var(--bg-hover);
}

.select-all-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* Same pill as ResultsWindow footer "Group by Course". */
.group-toggle {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 3px 8px;
  border: 1px solid var(--border-color);
  border-radius: 4px;
  background-color: var(--bg-elevated);
  font-size: 12px;
  color: var(--text-secondary);
  cursor: pointer;
  white-space: nowrap;
  transition: background-color 0.15s, border-color 0.15s;
  user-select: none;
}

.group-toggle:hover {
  background-color: var(--bg-hover);
  border-color: var(--border-strong);
}

.group-toggle input {
  width: 11px;
  height: 11px;
  margin: 0;
  accent-color: var(--accent);
  cursor: pointer;
}
</style>
