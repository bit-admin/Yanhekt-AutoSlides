<template>
  <div class="main-content">
    <div class="content-area">
      <!-- Info tab: Home / Search / Live & Recorded browsing + sessions list.
           Shown whenever no playback tab is active (activeTabId === null). -->
      <div
        :class="['mode-container', { 'mode-hidden': tabStore.state.activeTabId !== null }]"
        data-tab="info"
      >
        <!-- Home Page -->
        <div
          :class="['mode-container', { 'mode-hidden': activeNav !== 'home' }]"
          data-mode="home"
        >
          <HomePage />
        </div>

        <!-- Search Page -->
        <div
          :class="['mode-container', { 'mode-hidden': activeNav !== 'search' }]"
          data-mode="search"
        >
          <SearchPage />
        </div>

        <!-- Slides (Workspace page — full-width, right panel hidden).
             Merged review + PDF/PPTX export: the folder Select mode doubles
             as the export selection. -->
        <div
          :class="['mode-container', { 'mode-hidden': activeNav !== 'slides-review' }]"
          data-mode="slides-review"
        >
          <ResultsWindow />
        </div>

        <!-- Cloud Notes (Workspace page — full-width, right panel hidden).
             Lazily mounted on first visit: its onMounted loads notes over the
             network AND recreates a README note (a network write), so we don't
             want that firing on every app start. Kept mounted once opened. -->
        <div
          :class="['mode-container', { 'mode-hidden': activeNav !== 'cloud-notes' }]"
          data-mode="cloud-notes"
        >
          <CloudNotesTab v-if="cloudNotesMounted" />
        </div>

        <!-- Settings (Workspace page — full-width, right panel hidden). Reached
             from the user-bar gear button / menu bar, not the Workspace nav list.
             Lazily mounted on first visit so its prepare loads (network
             interfaces, extractor verify, …) don't fire on every app start. -->
        <div
          :class="['mode-container', { 'mode-hidden': activeNav !== 'settings' }]"
          data-mode="settings"
        >
          <SettingsPage v-if="settingsMounted" />
        </div>

        <!-- Live Mode (browsing only — playback opens in a tab) -->
        <div
          :class="['mode-container', { 'mode-hidden': activeNav !== 'live' }]"
          data-mode="live"
        >
          <CoursePage :mode="'live'" />
        </div>

        <!-- Recorded Mode (course grid → sessions list) -->
        <div
          :class="['mode-container', { 'mode-hidden': activeNav !== 'recorded' }]"
          data-mode="recorded"
        >
          <CoursePage
            v-if="recordedState.page === 'courses'"
            :mode="'recorded'"
          />
          <SessionPage
            v-else
            :key="recordedState.selectedCourse?.id"
            :course="recordedState.selectedCourse"
            @session-selected="handleSessionSelected"
            @back-to-courses="backToCourses"
            @switch-to-download="handleSwitchToDownload"
            @switch-to-task="handleSwitchToTask"
          />
        </div>
      </div>

      <!-- Playback tabs — one PlaybackPage per open tab, kept mounted so
           background playback + slide extraction continue when not focused. -->
      <div
        v-for="tab in tabStore.state.tabs"
        :key="tab.id"
        :class="['mode-container', { 'mode-hidden': tabStore.state.activeTabId !== tab.id }]"
        data-tab="playback"
      >
        <PlaybackPage
          :course="(tab.course as Course)"
          :session="(tab.session as Session | null)"
          :mode="tab.mode"
          :streamId="tab.streamId"
          :sessionId="tab.sessionId"
          :isVisible="tabStore.state.activeTabId === tab.id"
          @back="handleTabBack(tab.id)"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { createLogger } from '@shared/utils/logger';
const log = createLogger('MainContent');
import { ref, watch, onMounted, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import CoursePage from '@renderer/components/course/CoursePage.vue'
import SessionPage from '@renderer/components/course/SessionPage.vue'
import PlaybackPage from '@renderer/components/video/PlaybackPage.vue'
import HomePage from '@renderer/components/course/HomePage.vue'
import SearchPage from '@renderer/components/course/SearchPage.vue'
import ResultsWindow from '@renderer/components/results/ResultsWindow.vue'
import CloudNotesTab from '@renderer/components/cloudnotes/CloudNotesTab.vue'
import SettingsPage from '@renderer/components/settings/SettingsPage.vue'
import type { Course, Session } from '@features/video/useSlideExtraction'
import { DataStore } from '@shared/services/dataStore'
import { TaskCoordinator, type TaskContext } from '@shared/orchestration/taskCoordinator'
import { taskQueueState } from '@shared/services/taskQueueService'
import { navigationStore } from '@features/course/navigationStore'
import { tabStore, openPlaybackTab } from '@features/course/tabStore'

type Page = 'courses' | 'sessions'

interface RecordedState {
  page: Page;
  selectedCourse: any;
}

const { t } = useI18n()
const { activeNav, courseOpenRequest, recordedGridResetTick } = navigationStore

// Cloud Notes mounts lazily on first visit (its onMounted hits the network and
// recreates a README note), then stays mounted to preserve editor/queue state.
const cloudNotesMounted = ref(false)
watch(
  activeNav,
  (nav) => {
    if (nav === 'cloud-notes') cloudNotesMounted.value = true
  },
  { immediate: true }
)

// Settings likewise mounts lazily on first visit (its prepare loads network
// interfaces and verifies the extractor), then stays mounted.
const settingsMounted = ref(false)
watch(
  activeNav,
  (nav) => {
    if (nav === 'settings') settingsMounted.value = true
  },
  { immediate: true }
)

// Recorded mode keeps its own browse state (course grid → sessions list).
// Live mode has no intermediate page; playback is a tab.
const recordedState = ref<RecordedState>({
  page: 'courses',
  selectedCourse: null
})

// Mirror the recorded sub-page into the navigation store so the title bar's
// Info tab chip can label itself "Sessions" while the sessions list is shown.
watch(
  () => recordedState.value.page,
  (page) => {
    navigationStore.recordedOnSessions.value = page === 'sessions'
  },
  { immediate: true }
)

const notifyManualTabLimit = () => {
  void window.electronAPI?.dialog?.showMessageBox?.({
    type: 'info',
    title: t('tabs.limitTitle'),
    message: t('tabs.limitMessage'),
    buttons: [t('titlebar.ok')]
  })
}

// Course opens come from any surface (course grid, Home rows, Search results)
// via the navigation store. Live opens are handled directly by courseSelection
// (a tab); here we only route recorded courses to their sessions list.
// Clicking "Recorded" right after opening a pinned course returns to the course
// grid (otherwise the content, already in recorded mode, would look unchanged).
// Only fires for that pinned→recorded transition — a normal "Recorded" click
// leaves the current sessions/grid state alone.
watch(recordedGridResetTick, () => {
  recordedState.value.page = 'courses'
  recordedState.value.selectedCourse = null
})

watch(courseOpenRequest, (request) => {
  if (!request || request.mode !== 'recorded') return
  recordedState.value.selectedCourse = request.course
  recordedState.value.page = 'sessions'
})

// Sidebar playback indicator dots reflect whether any tab of a mode is open.
watch(
  () => tabStore.state.tabs.map(tab => tab.mode),
  () => {
    navigationStore.livePlaybackActive.value = tabStore.state.tabs.some(tab => tab.mode === 'live')
    navigationStore.recordedPlaybackActive.value = tabStore.state.tabs.some(tab => tab.mode === 'recorded')
  },
  { deep: true }
)

// Task tabs are transient: once a task reaches a terminal state its playback
// tab is closed (post-processing runs independently in PostProcessingService).
watch(
  () => taskQueueState.value.tasks.map(task => ({ id: task.id, status: task.status })),
  (tasks) => {
    for (const task of tasks) {
      if (task.status === 'completed' || task.status === 'error') {
        tabStore.closeTabByTaskId(task.id)
      }
    }
  },
  { deep: true }
)

const handleSessionSelected = (session: any) => {
  const course = recordedState.value.selectedCourse
  const result = openPlaybackTab({
    mode: 'recorded',
    course,
    session,
    streamId: String(course?.id ?? ''),
    sessionId: session?.session_id?.toString(),
    title: session?.title || course?.title || t('navigation.recorded'),
    origin: 'manual'
  })
  if (!result.ok) notifyManualTabLimit()
}

const backToCourses = () => {
  recordedState.value.page = 'courses'
  recordedState.value.selectedCourse = null
  // Returning to the course grid is recorded browsing again — drop any pinned
  // highlight so the "Recorded" navigator entry lights up instead.
  navigationStore.setActivePinned(null)
}

// The playback page's "Back" button closes its tab and returns to the Info tab
// (the old pre-tabs behavior: back went to the sessions/browse page). The tab
// chip's "×" keeps the browser-like neighbor fallback in tabStore.closeTab.
const handleTabBack = (tabId: string) => {
  tabStore.closeTab(tabId)
  tabStore.activateTab(null)
}

const emit = defineEmits<{
  switchToDownload: [downloadItemId?: string]
  switchToTask: [taskId?: string]
}>()

const handleSwitchToDownload = (downloadItemId?: string) => {
  emit('switchToDownload', downloadItemId)
}

const handleSwitchToTask = (taskId?: string) => {
  emit('switchToTask', taskId)
}

// Task navigation handler — invoked by the task coordinator before it starts a
// task. Opens (or focuses) a recorded-mode playback tab so the matching
// PlaybackPage mounts and registers its TaskDriver. Does not steal focus from a
// tab the user is already watching — only the first task tab (opened while on
// the Info tab) auto-activates.
const handleTaskNavigation = (task: TaskContext) => {
  const { taskId, sessionId, courseId, courseTitle, sessionTitle } = task

  const sessionData = DataStore.getSessionData(sessionId)
  if (!sessionData) {
    log.error('Session data not found for task navigation:', sessionId)
    log.error('Make sure the session was properly stored when the task was added to the queue')
    return
  }

  const courseInfo = sessionData.courseInfo
  const course = {
    id: courseId,
    title: courseTitle,
    instructor: courseInfo?.instructor || 'Auto Task',
    time: courseInfo?.time || sessionData.started_at,
    status: 1,
    subtitle: sessionTitle,
    schedule_started_at: sessionData.started_at,
    schedule_ended_at: sessionData.ended_at,
    classrooms: courseInfo?.classrooms,
    college_name: courseInfo?.college_name,
    participant_count: courseInfo?.participant_count,
    professors: courseInfo?.professors,
    school_year: courseInfo?.school_year,
    semester: courseInfo?.semester
  }

  openPlaybackTab(
    {
      mode: 'recorded',
      course,
      session: sessionData,
      streamId: String(courseId),
      sessionId,
      title: sessionTitle || courseTitle || t('navigation.task'),
      origin: 'task',
      taskId
    },
    { activate: tabStore.state.activeTabId === null }
  )

  log.debug('Task navigation completed:', { taskId, courseId, sessionId, courseTitle, sessionTitle })
}

let unregisterNavigator: (() => void) | null = null

onMounted(() => {
  // Register the navigation handler with the task coordinator.
  unregisterNavigator = TaskCoordinator.registerNavigator(handleTaskNavigation)
})

onUnmounted(() => {
  if (unregisterNavigator) {
    unregisterNavigator()
    unregisterNavigator = null
  }
})
</script>

<style scoped>
.main-content {
  display: flex;
  flex-direction: column;
  height: 100%;
  background-color: var(--bg-page);
  color: var(--text-primary);
}

.content-area {
  flex: 1;
  overflow: hidden;
  position: relative;
}

.mode-container {
  height: 100%;
  width: 100%;
  position: absolute;
  top: 0;
  left: 0;
  transition: opacity 0.2s ease-in-out;
}

.mode-container.mode-hidden {
  opacity: 0;
  pointer-events: none;
  z-index: -1;
}
</style>
