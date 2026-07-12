<template>
  <div class="main-content">
    <div class="content-area">
      <!-- Browsing surfaces (kept mounted; visibility toggled by CSS like the
           desktop app's mode containers). -->
      <div :class="['mode-container', { 'mode-hidden': playbackStore.active.value !== null }]">
        <!-- Home Page -->
        <div :class="['mode-container', { 'mode-hidden': activeNav !== 'home' }]" data-mode="home">
          <HomePage />
        </div>

        <!-- Search Page -->
        <div :class="['mode-container', { 'mode-hidden': activeNav !== 'search' }]" data-mode="search">
          <SearchPage />
        </div>

        <!-- Live Mode (browsing only — selecting a stream opens playback) -->
        <div :class="['mode-container', { 'mode-hidden': activeNav !== 'live' }]" data-mode="live">
          <CoursePage :mode="'live'" />
        </div>

        <!-- Recorded Mode (course grid → sessions list) -->
        <div :class="['mode-container', { 'mode-hidden': activeNav !== 'recorded' }]" data-mode="recorded">
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
          />
        </div>

        <!-- Slides (extraction results review + export) -->
        <div :class="['mode-container', { 'mode-hidden': activeNav !== 'slides' }]" data-mode="slides">
          <SlidesPage />
        </div>

        <!-- Settings Page -->
        <div :class="['mode-container', { 'mode-hidden': activeNav !== 'settings' }]" data-mode="settings">
          <SettingsPage />
        </div>
      </div>

      <!-- Single playback view (the web shell has no tab strip) -->
      <div
        v-if="playbackStore.active.value"
        class="mode-container"
        data-mode="playback"
      >
        <PlaybackPage
          :key="playbackKey"
          :course="playbackStore.active.value.course"
          :session="playbackStore.active.value.session"
          :mode="playbackStore.active.value.mode"
          @back="closePlayback()"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { computed } from 'vue'
import HomePage from './course/HomePage.vue'
import SearchPage from './course/SearchPage.vue'
import CoursePage from './course/CoursePage.vue'
import SessionPage from './course/SessionPage.vue'
import SettingsPage from './SettingsPage.vue'
import SlidesPage from './slides/SlidesPage.vue'
import PlaybackPage from './video/PlaybackPage.vue'
import { navigationStore } from '../stores/navigationStore'
import { playbackStore, closePlayback } from '../stores/playbackStore'
import type { SessionCourse, Session } from '../composables/useSessionPage'

type Page = 'courses' | 'sessions'

interface RecordedState {
  page: Page;
  selectedCourse: SessionCourse | null;
}

const { activeNav, courseOpenRequest } = navigationStore

// Recorded mode keeps its own browse state (course grid → sessions list).
const recordedState = ref<RecordedState>({
  page: 'courses',
  selectedCourse: null,
})

// Course opens come from any surface (course grid, Home rows, Search results)
// via the navigation store; only recorded courses route to a sessions list.
watch(courseOpenRequest, (request) => {
  if (!request || request.mode !== 'recorded') return
  recordedState.value.selectedCourse = request.course
  recordedState.value.page = 'sessions'
})

const handleSessionSelected = (session: Session) => {
  const course = recordedState.value.selectedCourse
  if (!course) return
  playbackStore.active.value = {
    mode: 'recorded',
    course: course as never,
    session,
  }
}

const backToCourses = () => {
  recordedState.value.page = 'courses'
  recordedState.value.selectedCourse = null
}

// Re-mount the player when a different stream/session is opened.
const playbackKey = computed(() => {
  const active = playbackStore.active.value
  if (!active) return 'none'
  return `${active.mode}-${active.course.id}-${active.session?.session_id ?? 'live'}`
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
