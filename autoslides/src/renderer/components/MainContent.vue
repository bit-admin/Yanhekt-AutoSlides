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
          :streamId="liveState.selectedCourse?.id"
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
        />
        <PlaybackPage
          v-else-if="recordedState.page === 'playback'"
          :course="recordedState.selectedCourse"
          :session="recordedState.selectedSession"
          :mode="'recorded'"
          :streamId="recordedState.selectedCourse?.id"
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
import { ref } from 'vue'
import CoursePage from './CoursePage.vue'
import SessionPage from './SessionPage.vue'
import PlaybackPage from './PlaybackPage.vue'

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
  const currentState = currentMode.value === 'live' ? liveState.value : recordedState.value
  console.log(`🔄 Switching from ${currentMode.value} to ${mode}`)
  console.log(`📊 Current ${currentMode.value} state:`, {
    page: currentState.page,
    course: currentState.selectedCourse?.title || currentState.selectedCourse?.name_zh || 'none',
    session: currentState.selectedSession?.title || 'none'
  })

  currentMode.value = mode

  const newState = mode === 'live' ? liveState.value : recordedState.value
  console.log(`📊 New ${mode} state:`, {
    page: newState.page,
    course: newState.selectedCourse?.title || newState.selectedCourse?.name_zh || 'none',
    session: newState.selectedSession?.title || 'none'
  })
  // Without resetting the state, each mode maintains its own navigation state.
}

const handleCourseSelected = (course: any) => {
  console.log(`📚 Course selected in ${currentMode.value} mode:`, course.title)
  const state = currentMode.value === 'live' ? liveState.value : recordedState.value
  state.selectedCourse = course

  if (currentMode.value === 'live') {
    state.page = 'playback'
    console.log(`🎬 ${currentMode.value}: Going to playback page`)
  } else {
    state.page = 'sessions'
    console.log(`📋 ${currentMode.value}: Going to sessions page`)
  }
}

const handleSessionSelected = (session: any) => {
  console.log(`🎥 Session selected in ${currentMode.value} mode:`, session.title)
  const state = currentMode.value === 'live' ? liveState.value : recordedState.value
  state.selectedSession = session
  state.page = 'playback'
  console.log(`🎬 ${currentMode.value}: Going to playback page`)
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

</style>