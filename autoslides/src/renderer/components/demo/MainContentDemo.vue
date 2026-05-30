<template>
  <div class="main-content flex h-full flex-col">
    <div class="navigation-bar flex border-b border-line bg-elevated">
      <button disabled
        :class="['flex flex-1 items-center justify-center gap-1.5 border-b-[3px] px-6 py-3 text-sm font-medium transition-colors',
                 currentMode === 'live' ? 'border-accent bg-surface text-accent' : 'border-transparent bg-transparent text-fg']"
        id="tour-live-mode"
      >
        <svg class="shrink-0" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="m23 7-3 2v-4a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-4l3 2z"/>
        </svg>
        {{ $t('navigation.live') }}
      </button>
      <button disabled
        :class="['flex flex-1 items-center justify-center gap-1.5 border-b-[3px] px-6 py-3 text-sm font-medium transition-colors',
                 currentMode === 'recorded' ? 'border-accent bg-surface text-accent' : 'border-transparent bg-transparent text-fg']"
        id="tour-recorded-mode"
      >
        <svg class="shrink-0" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/>
          <line x1="8" y1="21" x2="16" y2="21"/>
          <line x1="12" y1="17" x2="12" y2="21"/>
        </svg>
        {{ $t('navigation.recorded') }}
      </button>
    </div>

    <div class="content-area relative flex-1 overflow-hidden">
      <!-- Recorded Mode Components -->
      <div
        :class="['mode-container absolute left-0 top-0 h-full w-full transition-opacity duration-200', currentMode !== 'recorded' ? 'pointer-events-none -z-10 opacity-0' : '']"
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
