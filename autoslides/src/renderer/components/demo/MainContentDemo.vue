<template>
  <div class="main-content">
    <div class="navigation-bar">
      <button
        :class="['nav-btn', { active: currentMode === 'live' }]"
        @click="switchMode('live')"
        id="tour-live-mode"
      >
        <svg class="nav-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="m23 7-3 2v-4a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-4l3 2z"/>
        </svg>
        {{ $t('navigation.live') }}
      </button>
      <button
        :class="['nav-btn', { active: currentMode === 'recorded' }]"
        @click="switchMode('recorded')"
        id="tour-recorded-mode"
      >
        <svg class="nav-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/>
          <line x1="8" y1="21" x2="16" y2="21"/>
          <line x1="12" y1="17" x2="12" y2="21"/>
        </svg>
        {{ $t('navigation.recorded') }}
      </button>
    </div>

    <div class="content-area">
      <!-- Live Mode Components -->
      <div
        :class="['mode-container', { 'mode-hidden': currentMode !== 'live' }]"
        data-mode="live"
      >
        <div class="demo-placeholder">
          <div class="demo-icon">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="m23 7-3 2v-4a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-4l3 2z"/>
            </svg>
          </div>
          <h3>{{ $t('tour.liveMode.title') }}</h3>
          <p>{{ $t('tour.liveMode.description') }}</p>
        </div>
      </div>

      <!-- Recorded Mode Components -->
      <div
        :class="['mode-container', { 'mode-hidden': currentMode !== 'recorded' }]"
        data-mode="recorded"
      >
        <CoursePageDemo
          :mode="'recorded'"
          @course-selected="handleCourseSelected"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import CoursePageDemo from './CoursePageDemo.vue'

type Mode = 'live' | 'recorded'

const currentMode = ref<Mode>('live')

const switchMode = (mode: Mode) => {
  currentMode.value = mode
}

const emit = defineEmits<{
  courseSelected: [course: any]
}>()

const handleCourseSelected = (course: any) => {
  // Demo mode - emit event to parent to navigate to PlaybackPage
  console.log('Demo: Course selected', course)
  emit('courseSelected', course)
}

// Expose switchMode method for parent component
defineExpose({
  switchMode
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
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
}

.nav-icon {
  flex-shrink: 0;
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

.demo-placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  text-align: center;
  padding: 48px 24px;
  color: #666;
}

.demo-icon {
  margin-bottom: 24px;
  color: #007acc;
}

.demo-placeholder h3 {
  margin: 0 0 16px 0;
  font-size: 24px;
  font-weight: 600;
  color: #333;
}

.demo-placeholder p {
  margin: 0;
  font-size: 16px;
  line-height: 1.5;
  max-width: 400px;
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

  .demo-placeholder {
    color: #b0b0b0;
  }

  .demo-placeholder h3 {
    color: #e0e0e0;
  }

  .demo-icon {
    color: #4da6ff;
  }
}
</style>