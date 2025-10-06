<template>
  <div class="main-content">
    <div class="navigation-bar">
      <button
        :class="['nav-btn', { active: currentMode === 'live' }]"
        @click="switchMode('live')"
      >
        Live
        <span v-if="liveState.page === 'playback'" class="playback-indicator">●</span>
      </button>
      <button
        :class="['nav-btn', { active: currentMode === 'recorded' }]"
        @click="switchMode('recorded')"
      >
        Recorded
        <span v-if="recordedState.page === 'playback'" class="playback-indicator">●</span>
      </button>
    </div>

    <div class="content-area">
      <!-- Live Mode Components -->
      <div
        :class="['mode-container', { 'mode-hidden': currentMode !== 'live' }]"
        data-mode="live"
      >
        <CoursePage
          v-if="liveState.page === 'courses'"
          :mode="'live'"
          @course-selected="handleCourseSelected"
        />
        <PlaybackPage
          v-else-if="liveState.page === 'playback'"
          :course="liveState.selectedCourse"
          :session="liveState.selectedSession"
          :mode="'live'"
          :streamId="String(liveState.selectedCourse?.id || '')"
          :sessionId="liveState.selectedSession?.session_id"
          @back="handleBackFromPlayback"
          :key="`live-playback-${liveState.selectedCourse?.id || 'none'}`"
          :isVisible="currentMode === 'live'"
        />
      </div>

      <!-- Recorded Mode Components -->
      <div
        :class="['mode-container', { 'mode-hidden': currentMode !== 'recorded' }]"
        data-mode="recorded"
      >
        <CoursePage
          v-if="recordedState.page === 'courses'"
          :mode="'recorded'"
          @course-selected="handleCourseSelected"
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
          :sessionId="recordedState.selectedSession?.session_id"
          @back="handleBackFromPlayback"
          :key="`recorded-playback-${recordedState.selectedSession?.session_id || 'none'}`"
          :isVisible="currentMode === 'recorded'"
        />
      </div>

    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import CoursePage from './CoursePage.vue'
import SessionPage from './SessionPage.vue'
import PlaybackPage from './PlaybackPage.vue'
import { DataStore } from '../services/dataStore'

type Mode = 'live' | 'recorded'
type Page = 'courses' | 'sessions' | 'playback'

interface ModeState {
  page: Page;
  selectedCourse: any;
  selectedSession: any;
}

const currentMode = ref<Mode>('live')

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


const switchMode = (mode: Mode) => {
  currentMode.value = mode
}

const handleCourseSelected = (course: any) => {
  const state = currentMode.value === 'live' ? liveState.value : recordedState.value
  state.selectedCourse = course

  if (currentMode.value === 'live') {
    state.page = 'playback'
  } else {
    state.page = 'sessions'
  }
}

const handleSessionSelected = (session: any) => {
  const state = currentMode.value === 'live' ? liveState.value : recordedState.value
  state.selectedSession = session
  state.page = 'playback'
}

const backToCourses = () => {
  const state = currentMode.value === 'live' ? liveState.value : recordedState.value
  state.page = 'courses'
  state.selectedCourse = null
  state.selectedSession = null
}

const handleBackFromPlayback = () => {
  const state = currentMode.value === 'live' ? liveState.value : recordedState.value

  if (currentMode.value === 'live') {
    backToCourses()
  } else {
    state.page = 'sessions'
    state.selectedSession = null
  }
}

const emit = defineEmits<{
  switchToDownload: []
  switchToTask: []
}>()

const handleSwitchToDownload = () => {
  emit('switchToDownload')
}

const handleSwitchToTask = () => {
  emit('switchToTask')
}

// Task navigation handler
const handleTaskNavigation = (event: CustomEvent) => {
  const { taskId, sessionId, courseId, courseTitle, sessionTitle } = event.detail

  // Switch to recorded mode
  currentMode.value = 'recorded'

  // Find the session data from DataStore (should have been stored when task was added)
  const sessionData = DataStore.getSessionData(sessionId)
  if (sessionData) {
    // Create a course object that matches the expected interface
    // This mimics what would normally come from CoursePage
    recordedState.value.selectedCourse = {
      id: courseId, // Use the correct course ID from task data
      title: courseTitle,
      instructor: 'Auto Task', // Indicate this is from automated task
      time: sessionData.started_at,
      // Optional properties that PlaybackPage might use
      status: 1,
      subtitle: sessionTitle,
      schedule_started_at: sessionData.started_at,
      schedule_ended_at: sessionData.ended_at
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

onMounted(() => {
  // Listen for task navigation events
  window.addEventListener('taskNavigation', handleTaskNavigation as EventListener)
})

onUnmounted(() => {
  // Clean up event listeners
  window.removeEventListener('taskNavigation', handleTaskNavigation as EventListener)
})
</script>

<style scoped>
.main-content {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.navigation-bar {
  display: flex;
  border-bottom: 1px solid #e0e0e0;
  background-color: #f8f9fa;
}

.nav-btn {
  flex: 1;
  padding: 12px 24px;
  border: none;
  background-color: transparent;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  border-bottom: 3px solid transparent;
}

.nav-btn:hover {
  background-color: #e9ecef;
}

.nav-btn.active {
  background-color: white;
  border-bottom-color: #007acc;
  color: #007acc;
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

.playback-indicator {
  margin-left: 6px;
  color: #28a745;
  font-size: 12px;
  font-weight: bold;
  animation: pulse 2s infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

/* Dark mode support */
@media (prefers-color-scheme: dark) {
  .main-content {
    background-color: #1a1a1a;
    color: #e0e0e0;
  }

  .navigation-bar {
    border-bottom: 1px solid #404040;
    background-color: #2d2d2d;
  }

  .nav-btn {
    color: #b0b0b0;
  }

  .nav-btn:hover {
    background-color: #404040;
    color: #e0e0e0;
  }

  .nav-btn.active {
    background-color: #1a1a1a;
    border-bottom-color: #4da6ff;
    color: #4da6ff;
  }

  .playback-indicator {
    color: #66cc66;
  }
}

</style>