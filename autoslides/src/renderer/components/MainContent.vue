<template>
  <div class="main-content">
    <div class="navigation-bar">
      <button
        :class="['nav-btn', { active: currentMode === 'live' }]"
        @click="switchMode('live')"
      >
        Live
      </button>
      <button
        :class="['nav-btn', { active: currentMode === 'recorded' }]"
        @click="switchMode('recorded')"
      >
        Recorded
      </button>
    </div>

    <div class="content-area">
      <CoursePage
        v-if="currentPage === 'courses'"
        :mode="currentMode"
        @course-selected="handleCourseSelected"
      />
      <SessionPage
        v-else-if="currentPage === 'sessions'"
        :course="selectedCourse"
        @session-selected="handleSessionSelected"
        @back-to-courses="backToCourses"
      />
      <PlaybackPage
        v-else-if="currentPage === 'playback'"
        :course="selectedCourse"
        :session="selectedSession"
        :mode="currentMode"
        :streamId="selectedCourse?.id"
        :sessionId="selectedSession?.session_id"
        @back="handleBackFromPlayback"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
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

// Calculate the status of the current mode
const currentState = computed(() => {
  return currentMode.value === 'live' ? liveState.value : recordedState.value
})

// Convenient accessor
const currentPage = computed(() => currentState.value.page)
const selectedCourse = computed(() => currentState.value.selectedCourse)
const selectedSession = computed(() => currentState.value.selectedSession)

const switchMode = (mode: Mode) => {
  console.log(`🔄 Switching from ${currentMode.value} to ${mode}`)
  console.log(`📊 Current ${currentMode.value} state:`, {
    page: currentState.value.page,
    course: currentState.value.selectedCourse?.title || 'none',
    session: currentState.value.selectedSession?.title || 'none'
  })

  currentMode.value = mode

  console.log(`📊 New ${mode} state:`, {
    page: currentState.value.page,
    course: currentState.value.selectedCourse?.title || 'none',
    session: currentState.value.selectedSession?.title || 'none'
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
}
</style>