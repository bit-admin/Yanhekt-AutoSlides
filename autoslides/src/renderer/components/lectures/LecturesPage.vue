<template>
  <!-- Layout mirrors ResultsWindow (Slides): toolbar / list / optional progress / footer. -->
  <div class="lectures-page">
    <!-- Player takes over the whole page chrome (still not a Playback tab). -->
    <LecturePlayerView
      v-if="playerBundle"
      :course="playerBundle.course"
      :session="playerBundle.session"
      :initial-mode="playerTarget!.streamMode"
      @back="onPlayerBack"
    />

    <template v-else>
      <div class="toolbar">
        <div class="toolbar-left">
          <!-- Same macOS segmented control as Search Live|Recorded (Library first). -->
          <div class="mode-switch" role="tablist">
            <button
              type="button"
              class="mode-pill"
              :class="{ active: viewMode === 'library' }"
              @click="setViewMode('library')"
            >
              {{ $t('lectures.viewLibrary') }}
            </button>
            <button
              type="button"
              class="mode-pill"
              :class="{ active: viewMode === 'list' }"
              @click="setViewMode('list')"
            >
              {{ $t('lectures.viewList') }}
            </button>
          </div>

          <button class="btn refresh-btn" @click="onRefresh" :disabled="isLoading">
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
            v-if="viewMode === 'list'"
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
          </button>
        </div>

        <div v-if="viewMode === 'list'" class="actions">
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

      <div
        class="content-area custom-scrollbar"
        :class="{ 'content-area--library': viewMode === 'library' }"
      >
        <div v-if="errorMessage" class="error-banner">{{ errorMessage }}</div>
        <div v-if="showLibraryLoading" class="loading-state">
          <div class="spinner"></div>
          <p>{{ $t('lectures.loading') }}</p>
        </div>

        <LectureListView
          v-else-if="viewMode === 'list'"
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
          @open="openExternally"
        />

        <LectureLibraryView
          v-else
          :browse-level="browseLevel"
          :courses="libraryCourses"
          :active-course="activeCourse"
          :is-hydrating="isHydrating"
          :posters="posters"
          @open-course="openCourse"
          @back-courses="openCourses"
          @play-session="onPlaySession"
          @need-poster="loadPoster"
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

      <div v-if="viewMode === 'list'" class="footer">
        <div class="footer-left">
          <span v-if="isSelectMode">{{ $t('trash.selected') }}: {{ selectedPaths.length }} / {{ $t('trash.total') }}: {{ videos.length }}</span>
          <span v-else>{{ $t('trash.total') }}: {{ videos.length }}</span>
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
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import type { LectureCompressDefaults } from '@common/types'
import { useLecturesPage } from '@features/lectures/useLecturesPage'
import { useLectureLibrary } from '@features/lectures/useLectureLibrary'
import type { LibrarySession } from '@features/lectures/libraryModel'
import LectureListView from './LectureListView.vue'
import LectureLibraryView from './LectureLibraryView.vue'
import LecturePlayerView from './LecturePlayerView.vue'
import LectureCompressModal from './LectureCompressModal.vue'
import LectureRenameModal from './LectureRenameModal.vue'

export type LecturesViewMode = 'list' | 'library'

const { t } = useI18n()

/** Session-only Library|List toggle (not AppConfig). Opens on Library. */
const viewMode = ref<LecturesViewMode>('library')

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
  clearSelection,
  openOutputDirectory,
  reveal,
  openExternally,
  formatBytes,
} = useLecturesPage()

const {
  browseLevel,
  playerTarget,
  courses: libraryCourses,
  activeCourse,
  activePlayerSession,
  isHydrating,
  isDiscoveringSlides,
  posters,
  openCourses,
  openCourse,
  openPlayer,
  closePlayer,
  loadPoster,
  hydrate,
} = useLectureLibrary(videos)

const activeJob = computed(() => queue.activeJob.value)

const showLibraryLoading = computed(() => {
  if (isLoading.value && videos.value.length === 0) return true
  return (
    viewMode.value === 'library'
    && isDiscoveringSlides.value
    && libraryCourses.value.length === 0
    && videos.value.length === 0
  )
})

const playerBundle = computed(() => {
  if (!playerTarget.value) return null
  return activePlayerSession.value
})

watch(
  () => queue.hasWork.value,
  (busy, wasBusy) => {
    if (wasBusy && !busy) void loadVideos()
  },
)

const canCompress = computed(
  () => viewMode.value === 'list' && isSelectMode.value && selectedScreenRecognised.value.length > 0,
)

const canRename = computed(
  () => viewMode.value === 'list' && isSelectMode.value && selectedRecognised.value.length > 0,
)

const compressDisabledReason = computed(() => {
  if (!isSelectMode.value) return t('lectures.selectFirst')
  if (selectedScreenRecognised.value.length === 0) return t('lectures.compressScreenOnly')
  return ''
})

const setViewMode = (mode: LecturesViewMode) => {
  if (viewMode.value === mode) return
  // Leaving library / player tears down player state.
  closePlayer()
  if (mode === 'library' && isSelectMode.value) {
    toggleSelectMode()
  }
  viewMode.value = mode
  if (mode === 'library') {
    openCourses()
    void hydrate()
  }
}

const onRefresh = async () => {
  await loadVideos()
  if (viewMode.value === 'library') void hydrate()
}

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

const onPlaySession = (courseId: string, session: LibrarySession) => {
  openPlayer(courseId, session)
}

const onPlayerBack = () => {
  closePlayer()
}

onMounted(async () => {
  await loadVideos()
  if (viewMode.value === 'library') void hydrate()
})
</script>

<style scoped>
/* Match ResultsWindow shell tokens/spacing so Workspace pages feel identical. */
.lectures-page {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
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

/* macOS-style segmented control — matches SearchPage Live|Recorded
   (gray grouped track, white outlined active pill; visible in light mode). */
.mode-switch {
  display: flex;
  align-items: center;
  padding: 2px;
  border-radius: 8px;
  background: var(--bg-page-alt);
  border: 1px solid var(--border-color);
}

.mode-pill {
  display: inline-flex;
  align-items: center;
  padding: 4px 12px;
  border: 1px solid transparent;
  border-radius: 6px;
  background: transparent;
  color: var(--text-secondary);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s;
  line-height: 1.2;
}

.mode-pill:hover {
  color: var(--text-primary);
}

.mode-pill.active {
  background: var(--bg-surface);
  border-color: var(--border-strong);
  color: var(--text-primary);
  box-shadow: 0 1px 2px var(--shadow-sm);
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
  background-color: var(--bg-input);
  color: var(--text-primary);
  border: 1px solid var(--border-input);
}

.action-btn--secondary:hover:not(:disabled) {
  background-color: var(--bg-hover);
}

.action-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* List mode matches ResultsWindow/Slides: padded scroll surface. */
.content-area {
  flex: 1;
  min-width: 0;
  min-height: 0;
  overflow-x: hidden;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  padding: 16px;
  background-color: var(--bg-surface);
}

/* Library paints edge-to-edge and owns its own vertical scroll. */
.content-area--library {
  padding: 0;
  overflow: hidden;
  background: transparent;
}

.error-banner {
  margin: 12px;
  padding: 10px 12px;
  border-radius: 8px;
  background: color-mix(in srgb, var(--danger) 12%, transparent);
  color: var(--danger);
  font-size: 12px;
}

.loading-state {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  color: var(--text-muted);
  font-size: 13px;
}

.spinner {
  width: 28px;
  height: 28px;
  border: 2px solid var(--border-color);
  border-top-color: var(--accent);
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.refresh-btn .spinning {
  animation: spin 0.8s linear infinite;
}

.queue-status {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 8px 12px;
  background: var(--bg-elevated);
  border-top: 1px solid var(--border-color);
  font-size: 12px;
  flex-shrink: 0;
}

.queue-status-main {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  flex-wrap: wrap;
}

.queue-label {
  color: var(--text-secondary);
  font-weight: 550;
}

.queue-name {
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 40vw;
}

.queue-pct,
.queue-pending {
  color: var(--text-muted);
  font-variant-numeric: tabular-nums;
}

.progress-bar-container {
  height: 3px;
  width: 100%;
  background: var(--bg-subtle);
  flex-shrink: 0;
}

.progress-bar {
  height: 100%;
  background: var(--accent);
  transition: width 0.2s ease;
}

.footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 8px 12px;
  border-top: 1px solid var(--border-color);
  background: var(--bg-elevated);
  font-size: 12px;
  color: var(--text-secondary);
  flex-shrink: 0;
}

.footer-left {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
  font-variant-numeric: tabular-nums;
}
</style>
