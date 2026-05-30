<template>
  <div class="flex h-full flex-col dark:bg-[#1a1a1a] dark:text-[#e0e0e0]">
    <!-- 'navigation-bar' retained as a Driver.js tour hook -->
    <div class="navigation-bar flex border-b border-line bg-[#f8f9fa] dark:bg-[#2d2d2d]">
      <button
        :class="[navBtnBase, currentMode === 'live' ? navActive : navIdle]"
        @click="switchMode('live')"
      >
        <svg class="shrink-0" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="m23 7-3 2v-4a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-4l3 2z"/>
        </svg>
        {{ $t('navigation.live') }}
        <span v-if="liveState.page === 'playback'" class="ml-1.5 animate-pulse text-xs font-bold text-[#28a745] dark:text-[#66cc66]">●</span>
      </button>
      <button
        :class="[navBtnBase, currentMode === 'recorded' ? navActive : navIdle]"
        @click="switchMode('recorded')"
      >
        <svg class="shrink-0" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/>
          <line x1="8" y1="21" x2="16" y2="21"/>
          <line x1="12" y1="17" x2="12" y2="21"/>
        </svg>
        {{ $t('navigation.recorded') }}
        <span v-if="recordedState.page === 'playback'" class="ml-1.5 animate-pulse text-xs font-bold text-[#28a745] dark:text-[#66cc66]">●</span>
      </button>
    </div>

    <div class="relative flex-1 overflow-hidden">
      <!-- Live Mode Components -->
      <div
        class="absolute left-0 top-0 h-full w-full transition-opacity duration-200 ease-in-out"
        :class="{ 'pointer-events-none -z-10 opacity-0': currentMode !== 'live' }"
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
          :sessionId="liveState.selectedSession?.session_id?.toString()"
          @back="handleBackFromPlayback"
          :key="`live-playback-${liveState.selectedCourse?.id || 'none'}`"
          :isVisible="currentMode === 'live'"
        />
      </div>

      <!-- Recorded Mode Components -->
      <div
        class="absolute left-0 top-0 h-full w-full transition-opacity duration-200 ease-in-out"
        :class="{ 'pointer-events-none -z-10 opacity-0': currentMode !== 'recorded' }"
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
          :sessionId="recordedState.selectedSession?.session_id?.toString()"
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
import CoursePage from '@renderer/components/course/CoursePage.vue'
import SessionPage from '@renderer/components/course/SessionPage.vue'
import PlaybackPage from '@renderer/components/video/PlaybackPage.vue'
import { DataStore } from '@shared/services/dataStore'

type Mode = 'live' | 'recorded'
type Page = 'courses' | 'sessions' | 'playback'

interface ModeState {
  page: Page;
  selectedCourse: any;
  selectedSession: any;
}

const currentMode = ref<Mode>('live')

// Nav tab class strings (split idle/active so only one color set applies).
const navBtnBase =
  'flex flex-1 items-center justify-center gap-1.5 border-none border-b-[3px] bg-transparent px-6 py-3 text-sm font-medium cursor-pointer transition-all'
const navIdle = 'border-b-transparent text-fg hover:bg-hover hover:text-fg dark:text-fg-secondary'
const navActive = 'border-b-accent bg-surface text-accent'

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
  switchToDownload: [downloadItemId?: string]
  switchToTask: [taskId?: string]
}>()

const handleSwitchToDownload = (downloadItemId?: string) => {
  emit('switchToDownload', downloadItemId)
}

const handleSwitchToTask = (taskId?: string) => {
  emit('switchToTask', taskId)
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

onMounted(() => {
  // Listen for task navigation events
  window.addEventListener('taskNavigation', handleTaskNavigation as EventListener)
})

onUnmounted(() => {
  // Clean up event listeners
  window.removeEventListener('taskNavigation', handleTaskNavigation as EventListener)
})
</script>
