<template>
  <div class="flex h-full flex-col p-4">
    <div class="mb-6 overflow-hidden rounded-lg border border-line bg-elevated">
      <div class="flex items-center gap-4 p-4">
        <button class="flex items-center gap-1.5 rounded border border-line-input bg-surface px-4 py-2 text-sm text-fg-secondary cursor-pointer transition-colors" disabled>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="15,18 9,12 15,6"/>
          </svg>
          {{ $t('sessions.backToCourses') }}
        </button>
        <h2 class="m-0 flex-1 text-xl font-semibold text-fg">{{ t('demo.course.title') }}</h2>
        <button class="flex h-8 w-8 items-center justify-center rounded border border-line-input bg-surface cursor-pointer transition-colors" disabled>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="transition-transform" :class="{ 'rotate-180': showCourseDetails }">
            <polyline points="6,9 12,15 18,9"/>
          </svg>
        </button>
      </div>
      <div v-show="showCourseDetails" class="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-3 border-t border-line bg-surface p-4">
        <div class="flex flex-col gap-1">
          <span class="text-xs font-semibold uppercase tracking-wide text-fg-secondary">{{ $t('playback.instructor') }}</span>
          <span class="text-sm font-medium text-fg">{{ t('demo.course.instructor') }}</span>
        </div>
        <div class="flex flex-col gap-1">
          <span class="text-xs font-semibold uppercase tracking-wide text-fg-secondary">{{ $t('sessions.academicTerm') }}</span>
          <span class="text-sm font-medium text-fg">{{ t('demo.course.term') }}</span>
        </div>
        <div class="flex flex-col gap-1">
          <span class="text-xs font-semibold uppercase tracking-wide text-fg-secondary">{{ $t('sessions.classrooms') }}</span>
          <span class="text-sm font-medium text-fg">{{ t('demo.course.classroom') }}</span>
        </div>
        <div class="flex flex-col gap-1">
          <span class="text-xs font-semibold uppercase tracking-wide text-fg-secondary">{{ $t('sessions.college') }}</span>
          <span class="text-sm font-medium text-fg">{{ t('demo.course.college') }}</span>
        </div>
        <div class="flex flex-col gap-1">
          <span class="text-xs font-semibold uppercase tracking-wide text-fg-secondary">{{ $t('sessions.participants') }}</span>
          <span class="text-sm font-medium text-fg">120 {{ $t('sessions.participantsCount') }}</span>
        </div>
      </div>
    </div>

    <!-- 'content' retained as a Driver.js tour hook -->
    <div class="content flex min-h-0 flex-1 flex-col">
      <div v-if="isLoading" class="flex flex-col items-center justify-center gap-4 px-4 py-12">
        <div class="h-8 w-8 animate-spin rounded-full border-[3px] border-[#f3f3f3] border-t-accent dark:border-[#555]"></div>
        <p>{{ $t('sessions.loadingSessions') }}</p>
      </div>

      <div v-else class="flex min-h-0 flex-1 flex-col">
        <div class="mt-4 flex min-h-0 flex-1 flex-col" id="tour-sessions-container">
          <div class="mb-4 flex gap-2 rounded-lg border border-line bg-elevated p-4" id="tour-batch-actions">
            <button class="flex flex-1 items-center justify-center gap-1.5 rounded border border-[#28a745] bg-surface px-3 py-2 text-xs text-[#28a745] cursor-pointer" disabled>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                <polyline points="14,2 14,8 20,8"/>
                <line x1="16" y1="13" x2="8" y2="13"/>
                <line x1="16" y1="17" x2="8" y2="17"/>
                <line x1="10" y1="9" x2="8" y2="9"/>
              </svg>
              {{ $t('sessions.addAllToTasks') }}
            </button>
            <button class="flex flex-1 items-center justify-center gap-1.5 rounded border border-accent bg-surface px-3 py-2 text-xs text-accent cursor-pointer" disabled>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                <circle cx="12" cy="13" r="4"/>
              </svg>
              {{ $t('sessions.downloadAllCamera') }}
            </button>
            <button class="flex flex-1 items-center justify-center gap-1.5 rounded border border-[#6f42c1] bg-surface px-3 py-2 text-xs text-[#6f42c1] cursor-pointer dark:border-[#9d7be0] dark:text-[#9d7be0]" disabled>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/>
                <line x1="8" y1="21" x2="16" y2="21"/>
                <line x1="12" y1="17" x2="12" y2="21"/>
              </svg>
              {{ $t('sessions.downloadAllScreen') }}
            </button>
          </div>
          <div class="sessions-list flex flex-1 flex-col gap-px overflow-y-auto rounded-lg bg-elevated p-1">
            <div
              v-for="session in mockSessions"
              :key="session.id"
              class="pointer-events-none flex min-h-[48px] items-center justify-between rounded bg-surface px-3 py-2"
            >
              <div class="flex min-w-0 flex-1 items-center gap-3">
                <div class="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-[#f0f8ff] text-accent dark:bg-[#243447]">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polygon points="5,3 19,12 5,21"/>
                  </svg>
                </div>
                <div class="min-w-0 flex-1">
                  <div class="mb-0.5 truncate text-sm font-semibold text-fg">{{ session.title }}</div>
                  <div class="flex gap-3 text-xs text-fg-secondary">
                    <span class="whitespace-nowrap font-medium text-accent">
                      {{ $t('sessions.week') }} {{ session.week }}{{ $t('sessions.week') === '第' ? '周' : '' }}, {{ session.day }}
                    </span>
                    <span class="whitespace-nowrap text-fg-secondary">
                      {{ session.duration }}
                    </span>
                    <span class="whitespace-nowrap text-fg-muted">
                      {{ session.date }}
                    </span>
                  </div>
                </div>
              </div>
              <div class="flex w-[200px] shrink-0 items-center justify-end gap-1">
                <button class="pointer-events-none flex h-10 w-[60px] flex-col items-center justify-center gap-0.5 rounded border border-[#28a745] bg-surface text-[#28a745]" :title="$t('sessions.addToTask')">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                    <polyline points="14,2 14,8 20,8"/>
                    <line x1="16" y1="13" x2="8" y2="13"/>
                    <line x1="16" y1="17" x2="8" y2="17"/>
                    <line x1="10" y1="9" x2="8" y2="9"/>
                  </svg>
                  <span class="text-[10px] font-medium leading-none">{{ $t('sessions.task') }}</span>
                </button>
                <button class="pointer-events-none flex h-10 w-[60px] flex-col items-center justify-center gap-0.5 rounded border border-accent bg-surface text-accent" :title="$t('sessions.downloadCamera')">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                    <circle cx="12" cy="13" r="4"/>
                  </svg>
                  <span class="text-[10px] font-medium leading-none">{{ $t('sessions.camera') }}</span>
                </button>
                <button class="pointer-events-none flex h-10 w-[60px] flex-col items-center justify-center gap-0.5 rounded border border-[#6f42c1] bg-surface text-[#6f42c1] dark:border-[#9d7be0] dark:text-[#9d7be0]" :title="$t('sessions.downloadScreen')">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/>
                    <line x1="8" y1="21" x2="16" y2="21"/>
                    <line x1="12" y1="17" x2="12" y2="21"/>
                  </svg>
                  <span class="text-[10px] font-medium leading-none">{{ $t('sessions.screen') }}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'

interface MockSession {
  id: string
  title: string
  week: number
  day: string
  duration: string
  date: string
}

const emit = defineEmits<{
  backToCourses: []
}>()

const { t } = useI18n()

const isLoading = ref(false)
const showCourseDetails = ref(false)

// Mock session data (8 sessions as requested)
const mockSessions = computed<MockSession[]>(() => [
  {
    id: '001',
    title: t('demo.sessions.functionalAnalysis.chapter1.concept'),
    week: 1,
    day: t('demo.days.monday'),
    duration: '90m',
    date: 'Sep 2, 2024, 08:00'
  },
  {
    id: '002',
    title: t('demo.sessions.functionalAnalysis.chapter1.properties'),
    week: 1,
    day: t('demo.days.wednesday'),
    duration: '90m',
    date: 'Sep 4, 2024, 08:00'
  },
  {
    id: '003',
    title: t('demo.sessions.functionalAnalysis.chapter1.completeness'),
    week: 2,
    day: t('demo.days.monday'),
    duration: '90m',
    date: 'Sep 9, 2024, 08:00'
  },
  {
    id: '004',
    title: t('demo.sessions.functionalAnalysis.chapter2.banachSpaces'),
    week: 2,
    day: t('demo.days.wednesday'),
    duration: '90m',
    date: 'Sep 11, 2024, 08:00'
  },
  {
    id: '005',
    title: t('demo.sessions.functionalAnalysis.chapter2.linearOperators'),
    week: 3,
    day: t('demo.days.monday'),
    duration: '90m',
    date: 'Sep 16, 2024, 08:00'
  },
  {
    id: '006',
    title: t('demo.sessions.functionalAnalysis.chapter2.dualSpaces'),
    week: 3,
    day: t('demo.days.wednesday'),
    duration: '90m',
    date: 'Sep 18, 2024, 08:00'
  },
  {
    id: '007',
    title: t('demo.sessions.functionalAnalysis.chapter3.hilbertSpaces'),
    week: 4,
    day: t('demo.days.monday'),
    duration: '90m',
    date: 'Sep 23, 2024, 08:00'
  },
  {
    id: '008',
    title: t('demo.sessions.functionalAnalysis.chapter3.orthogonality'),
    week: 4,
    day: t('demo.days.wednesday'),
    duration: '90m',
    date: 'Sep 25, 2024, 08:00'
  }
])

const goBack = () => {
  emit('backToCourses')
}

const toggleCourseDetails = () => {
  showCourseDetails.value = !showCourseDetails.value
}

const handleDemoLoadSessions = () => {
  isLoading.value = true

  // Simulate loading
  setTimeout(() => {
    isLoading.value = false
  }, 800)
}

onMounted(() => {
  // Listen for demo load sessions trigger
  window.addEventListener('demo-load-sessions', handleDemoLoadSessions)

  // Auto-load sessions for demo
  handleDemoLoadSessions()
})

onUnmounted(() => {
  window.removeEventListener('demo-load-sessions', handleDemoLoadSessions)
})

// Expose methods for parent component
defineExpose({
  handleDemoLoadSessions
})
</script>

<style scoped>
/* Custom auto-hiding scrollbar for the demo session list (genuinely custom). */
.sessions-list {
  scrollbar-width: thin;
  scrollbar-color: transparent transparent;
  transition: scrollbar-color 0.3s ease;
}
.sessions-list:hover { scrollbar-color: rgba(0, 0, 0, 0.2) transparent; }
.sessions-list::-webkit-scrollbar { width: 6px; }
.sessions-list::-webkit-scrollbar-track { background: transparent; border-radius: 3px; }
.sessions-list::-webkit-scrollbar-thumb { background: transparent; border-radius: 3px; transition: background 0.3s ease; }
.sessions-list:hover::-webkit-scrollbar-thumb { background: rgba(0, 0, 0, 0.2); }
.sessions-list::-webkit-scrollbar-thumb:hover { background: rgba(0, 0, 0, 0.3); }
</style>
