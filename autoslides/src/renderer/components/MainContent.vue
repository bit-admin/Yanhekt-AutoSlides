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
        @back="handleBackFromPlayback"
      />
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

const currentMode = ref<Mode>('live')
const currentPage = ref<Page>('courses')
const selectedCourse = ref<any>(null)
const selectedSession = ref<any>(null)

const switchMode = (mode: Mode) => {
  currentMode.value = mode
  currentPage.value = 'courses'
  selectedCourse.value = null
  selectedSession.value = null
}

const handleCourseSelected = (course: any) => {
  selectedCourse.value = course

  if (currentMode.value === 'live') {
    currentPage.value = 'playback'
  } else {
    currentPage.value = 'sessions'
  }
}

const handleSessionSelected = (session: any) => {
  selectedSession.value = session
  currentPage.value = 'playback'
}

const backToCourses = () => {
  currentPage.value = 'courses'
  selectedCourse.value = null
  selectedSession.value = null
}

const handleBackFromPlayback = () => {
  if (currentMode.value === 'live') {
    backToCourses()
  } else {
    currentPage.value = 'sessions'
    selectedSession.value = null
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