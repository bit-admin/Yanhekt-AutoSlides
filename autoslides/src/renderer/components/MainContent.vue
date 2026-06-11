<template>
  <div class="main-content">
    <div class="content-area">
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

      <!-- Live Mode Components -->
      <div
        :class="['mode-container', { 'mode-hidden': activeNav !== 'live' }]"
        data-mode="live"
      >
        <CoursePage
          v-if="liveState.page === 'courses'"
          :mode="'live'"
        />
        <PlaybackPage
          v-else-if="liveState.page === 'playback'"
          :course="liveState.selectedCourse"
          :session="liveState.selectedSession"
          :mode="'live'"
          :streamId="String(liveState.selectedCourse?.id || '')"
          :sessionId="liveState.selectedSession?.session_id?.toString()"
          @back="handleBackFromPlayback('live')"
          :key="`live-playback-${liveState.selectedCourse?.id || 'none'}`"
          :isVisible="activeNav === 'live'"
        />
      </div>

      <!-- Recorded Mode Components -->
      <div
        :class="['mode-container', { 'mode-hidden': activeNav !== 'recorded' }]"
        data-mode="recorded"
      >
        <CoursePage
          v-if="recordedState.page === 'courses'"
          :mode="'recorded'"
        />
        <SessionPage
          v-else-if="recordedState.page === 'sessions'"
          :course="recordedState.selectedCourse"
          @session-selected="handleSessionSelected"
          @back-to-courses="backToCourses"
          @switch-to-download="handleSwitchToDownload"
          @switch-to-task="handleSwitchToTask"
        />
        <PlaybackPage
          v-else-if="recordedState.page === 'playback'"
          :course="recordedState.selectedCourse"
          :session="recordedState.selectedSession"
          :mode="'recorded'"
          :streamId="String(recordedState.selectedCourse?.id || '')"
          :sessionId="recordedState.selectedSession?.session_id?.toString()"
          @back="handleBackFromPlayback('recorded')"
          :key="`recorded-playback-${recordedState.selectedSession?.session_id || 'none'}`"
          :isVisible="activeNav === 'recorded'"
        />
      </div>

    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted } from 'vue'
import CoursePage from '@renderer/components/course/CoursePage.vue'
import SessionPage from '@renderer/components/course/SessionPage.vue'
import PlaybackPage from '@renderer/components/video/PlaybackPage.vue'
import HomePage from '@renderer/components/course/HomePage.vue'
import SearchPage from '@renderer/components/course/SearchPage.vue'
import { DataStore } from '@shared/services/dataStore'
import { TaskCoordinator, type TaskContext } from '@shared/orchestration/taskCoordinator'
import { navigationStore } from '@features/course/navigationStore'

type Mode = 'live' | 'recorded'
type Page = 'courses' | 'sessions' | 'playback'

interface ModeState {
  page: Page;
  selectedCourse: any;
  selectedSession: any;
}

const { activeNav, courseOpenRequest } = navigationStore

// 为每个模式维护独立的状态
const liveState = ref<ModeState>({
  page: 'courses',
  selectedCourse: null,
  selectedSession: null
})

const recordedState = ref<ModeState>({
  page: 'courses',
  selectedCourse: null,
  selectedSession: null
})

// Course opens come from any surface (course grid, Home rows, Search results)
// via the navigation store; the store already switched activeNav to the mode.
watch(courseOpenRequest, (request) => {
  if (!request) return

  if (request.mode === 'live') {
    liveState.value.selectedCourse = request.course
    liveState.value.selectedSession = null
    liveState.value.page = 'playback'
  } else {
    recordedState.value.selectedCourse = request.course
    recordedState.value.selectedSession = null
    recordedState.value.page = 'sessions'
  }
})

// Sidebar playback indicator dots
watch(() => liveState.value.page, (page) => {
  navigationStore.livePlaybackActive.value = page === 'playback'
})
watch(() => recordedState.value.page, (page) => {
  navigationStore.recordedPlaybackActive.value = page === 'playback'
})

const handleSessionSelected = (session: any) => {
  recordedState.value.selectedSession = session
  recordedState.value.page = 'playback'
}

const backToCourses = () => {
  recordedState.value.page = 'courses'
  recordedState.value.selectedCourse = null
  recordedState.value.selectedSession = null
}

const handleBackFromPlayback = (mode: Mode) => {
  if (mode === 'live') {
    liveState.value.page = 'courses'
    liveState.value.selectedCourse = null
    liveState.value.selectedSession = null
  } else {
    recordedState.value.page = 'sessions'
    recordedState.value.selectedSession = null
  }
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
// task, so the right recorded-mode PlaybackPage mounts and registers its driver.
const handleTaskNavigation = (task: TaskContext) => {
  const { taskId, sessionId, courseId, courseTitle, sessionTitle } = task

  // Switch to recorded mode
  navigationStore.navigate('recorded')

  // Find the session data from DataStore (should have been stored when task was added)
  const sessionData = DataStore.getSessionData(sessionId)
  if (sessionData) {
    // Create a course object that matches the expected interface
    // Use complete course information if available, otherwise fall back to task data
    const courseInfo = sessionData.courseInfo
    recordedState.value.selectedCourse = {
      id: courseId, // Use the correct course ID from task data
      title: courseTitle,
      instructor: courseInfo?.instructor || 'Auto Task', // Use real instructor if available
      time: courseInfo?.time || sessionData.started_at,
      // Include all available course information
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

    // Set the selected session (this is the same object that was stored)
    recordedState.value.selectedSession = sessionData

    // Navigate directly to playback (skipping the sessions page)
    recordedState.value.page = 'playback'

    console.log('Task navigation completed:', {
      taskId,
      courseId,
      sessionId,
      courseTitle,
      sessionTitle
    })
  } else {
    console.error('Session data not found for task navigation:', sessionId)
    console.error('Make sure the session was properly stored when the task was added to the queue')
  }
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
