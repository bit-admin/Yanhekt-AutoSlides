<template>
  <div class="flex flex-col h-full">
    <div class="flex border-b border-border bg-elevated">
      <button  disabled
        :class="[
          'flex-1 px-6 py-3 border-none bg-transparent text-sm font-medium cursor-pointer transition-all border-b-[3px] border-transparent flex items-center justify-center gap-1.5 hover:bg-hover',
          { 'bg-surface border-b-accent text-accent': currentMode === 'live' }
        ]"
        id="tour-live-mode"
      >
        <svg class="shrink-0" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="m23 7-3 2v-4a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-4l3 2z"/>
        </svg>
        {{ $t('navigation.live') }}
      </button>
      <button disabled
        :class="[
          'flex-1 px-6 py-3 border-none bg-transparent text-sm font-medium cursor-pointer transition-all border-b-[3px] border-transparent flex items-center justify-center gap-1.5 hover:bg-hover',
          { 'bg-surface border-b-accent text-accent': currentMode === 'recorded' }
        ]"
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

    <div class="flex-1 overflow-hidden relative">
      <!-- Recorded Mode Components -->
      <div
        :class="[
          'h-full w-full absolute top-0 left-0 transition-opacity duration-200 ease-in-out',
          { 'opacity-0 pointer-events-none -z-1': currentMode !== 'recorded' }
        ]"
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
