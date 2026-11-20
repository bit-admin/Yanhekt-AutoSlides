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
      <PageErrorNotice v-if="loadError" :error="loadError" :retry="loadVideos" />
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
            :disabled="files.length === 0 || isLoading"
            @click="toggleSelectMode"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
              <rect x="1.5" y="1.5" width="13" height="13" rx="2" ry="2" fill="none" stroke="currentColor" stroke-width="1.4"/>
              <path d="M4.5 8.2l2.4 2.4 4.6-5.2" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
            {{ isSelectMode ? $t('lectures.doneSelecting') : $t('lectures.select') }}
          </button>
        </div>

        <div class="actions">

          <button
            v-if="viewMode === 'list'"
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

      <LectureMakeVideoBar
        v-show="viewMode === 'list'"
        :is-select-mode="isSelectMode"
        :can-make-video="canMakeVideo"
        :skipped="selectedSlideVideos.missingSlides + selectedSlideVideos.missingAudio"
        @start="onMakeVideoStart"
      />

      <div
        class="content-area custom-scrollbar"
        :class="{ 'content-area--library': viewMode === 'library' }"
      >
        <div v-if="showLibraryLoading" class="loading-state">
          <div class="spinner"></div>
          <p>{{ $t('lectures.loading') }}</p>
        </div>

        <LectureListView
          v-else-if="viewMode === 'list'"
          :groups="groups"
          :is-select-mode="isSelectMode"
          :selected-paths="selectedPaths"
          :is-loading="isLoading"
          :format-bytes="formatBytes"
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
            <span class="queue-label">{{ $t('lectures.makingVideo') }}</span>
            <span class="queue-name" :title="activeJob.target.displayName">{{ activeJob.target.displayName }}</span>
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
            {{ $t('lectures.cancelMakeVideo') }}
          </button>
        </div>
      </div>
      <div v-else-if="queue.failed.value.length" class="queue-status">
        <div class="queue-status-main">
          <span class="queue-label queue-label--error">
            {{ $t('lectures.makeVideoFailed', { count: queue.failed.value.length }) }}
          </span>
          <span class="queue-name" :title="queue.failed.value[0].error">
            {{ queue.failed.value[0].target.displayName }}: {{ queue.failed.value[0].error }}
          </span>
        </div>
      </div>
      <div
        v-if="activeJob"
        class="progress-bar-container"
        :title="`${activeJob.target.displayName} — ${activeJob.progress}%`"
      >
        <div class="progress-bar" :style="{ width: `${activeJob.progress}%` }"></div>
      </div>

      <div v-if="viewMode === 'list'" class="footer">
        <div class="footer-left">
          <span v-if="isSelectMode">{{ $t('trash.selected') }}: {{ selectedPaths.length }} / {{ $t('trash.total') }}: {{ files.length }}</span>
          <span v-else>{{ $t('trash.total') }}: {{ files.length }}</span>
        </div>
        <label class="group-toggle">
          <input type="checkbox" v-model="groupByCourse" />
          <span>{{ $t('trash.groupByCourse') }}</span>
        </label>
      </div>

      <LectureRenameModal
        v-if="showRenameModal"
        :items="selectedRecognised"
        :subtitles="subtitles"
        :existing-names="[...videos, ...subtitles].map((v) => v.name)"
        @close="showRenameModal = false"
        @done="onRenameDone"
      />

    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import type { SlideVideoOptions } from '@common/slideVideo'
import { useLecturesPage } from '@features/lectures/useLecturesPage'
import { useLectureLibrary } from '@features/lectures/useLectureLibrary'
import type { LibrarySession } from '@features/lectures/libraryModel'
import LectureListView from './LectureListView.vue'
import LectureLibraryView from './LectureLibraryView.vue'
import LecturePlayerView from './LecturePlayerView.vue'
import LectureMakeVideoBar from './LectureMakeVideoBar.vue'
import LectureRenameModal from './LectureRenameModal.vue'
import PageErrorNotice from '../shell/PageErrorNotice.vue'

export type LecturesViewMode = 'list' | 'library'

const { t } = useI18n()

/** Session-only Library|List toggle (not AppConfig). Opens on Library. */
const viewMode = ref<LecturesViewMode>('library')

const {
  videos,
  subtitles,
  files,
  isLoading,
  loadError,
  isSelectMode,
  selectedPaths,
  groupByCourse,
  showRenameModal,
  groups,
  selectedSlideVideos,
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
} = useLectureLibrary(videos, subtitles)

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

const canMakeVideo = computed(
  () => viewMode.value === 'list' && isSelectMode.value && selectedSlideVideos.value.targets.length > 0,
)

const canRename = computed(
  () => viewMode.value === 'list' && isSelectMode.value && selectedRecognised.value.length > 0,
)

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

const openRename = () => {
  if (!canRename.value) return
  showRenameModal.value = true
}

const onMakeVideoStart = (options: SlideVideoOptions) => {
  if (!canMakeVideo.value) return
  const added = queue.enqueue(selectedSlideVideos.value.targets, options)
  if (added === 0) {
    void window.electronAPI.dialog?.showMessageBox?.({ type: 'info', message: t('lectures.makeVideoAlreadyQueued') })
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

.queue-label--error {
  color: var(--danger);
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
