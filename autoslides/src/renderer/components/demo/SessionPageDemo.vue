<template>
  <div class="flex flex-col h-full p-4">
    <div class="border border-border rounded-lg bg-elevated mb-6 overflow-hidden">
      <div class="flex items-center gap-4 p-4">
        <button class="flex items-center gap-1.5 px-4 py-2 border border-border-input rounded bg-surface text-text-secondary text-sm cursor-pointer transition-all hover:border-accent hover:text-accent" disabled>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="15,18 9,12 15,6"/>
          </svg>
          {{ $t('sessions.backToCourses') }}
        </button>
        <h2 class="m-0 text-xl font-semibold text-text flex-1">{{ t('demo.course.title') }}</h2>
        <button class="flex items-center justify-center w-8 h-8 border border-border-input rounded bg-surface cursor-pointer transition-all hover:border-accent hover:bg-accent/5" disabled>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" :class="{ 'rotate-180': showCourseDetails }">
            <polyline points="6,9 12,15 18,9"/>
          </svg>
        </button>
      </div>
      <div v-show="showCourseDetails" class="p-4 border-t border-border bg-surface grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-3">
        <div class="flex flex-col gap-1">
          <span class="text-xs font-semibold text-text-secondary uppercase tracking-[0.5px]">{{ $t('playback.instructor') }}</span>
          <span class="text-sm text-text font-medium">{{ t('demo.course.instructor') }}</span>
        </div>
        <div class="flex flex-col gap-1">
          <span class="text-xs font-semibold text-text-secondary uppercase tracking-[0.5px]">{{ $t('sessions.academicTerm') }}</span>
          <span class="text-sm text-text font-medium">{{ t('demo.course.term') }}</span>
        </div>
        <div class="flex flex-col gap-1">
          <span class="text-xs font-semibold text-text-secondary uppercase tracking-[0.5px]">{{ $t('sessions.classrooms') }}</span>
          <span class="text-sm text-text font-medium">{{ t('demo.course.classroom') }}</span>
        </div>
        <div class="flex flex-col gap-1">
          <span class="text-xs font-semibold text-text-secondary uppercase tracking-[0.5px]">{{ $t('sessions.college') }}</span>
          <span class="text-sm text-text font-medium">{{ t('demo.course.college') }}</span>
        </div>
        <div class="flex flex-col gap-1">
          <span class="text-xs font-semibold text-text-secondary uppercase tracking-[0.5px]">{{ $t('sessions.participants') }}</span>
          <span class="text-sm text-text font-medium">120 {{ $t('sessions.participantsCount') }}</span>
        </div>
      </div>
    </div>

    <div class="flex-1 flex flex-col min-h-0">
      <div v-if="isLoading" class="flex flex-col items-center justify-center p-12 px-4 gap-4">
        <div class="w-8 h-8 border-[3px] border-[var(--bg-elevated)] border-t-accent rounded-full animate-spin"></div>
        <p>{{ $t('sessions.loadingSessions') }}</p>
      </div>

      <div v-else class="flex-1 flex flex-col min-h-0">
        <div class="flex-1 flex flex-col min-h-0 mt-4" id="tour-sessions-container">
          <div class="flex gap-2 mb-4 p-4 bg-elevated rounded-lg border border-hover" id="tour-batch-actions">
            <button class="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 border rounded text-xs cursor-pointer transition-all min-h-[36px] text-success border-success hover:bg-success/10 hover:border-text-success" disabled>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                <polyline points="14,2 14,8 20,8"/>
                <line x1="16" y1="13" x2="8" y2="13"/>
                <line x1="16" y1="17" x2="8" y2="17"/>
                <line x1="10" y1="9" x2="8" y2="9"/>
              </svg>
              {{ $t('sessions.addAllToTasks') }}
            </button>
            <button class="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 border rounded text-xs cursor-pointer transition-all min-h-[36px] text-accent border-accent hover:bg-accent/10 hover:border-accent-hover" disabled>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                <circle cx="12" cy="13" r="4"/>
              </svg>
              {{ $t('sessions.downloadAllCamera') }}
            </button>
            <button class="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 border border-[#6f42c1] rounded text-xs cursor-pointer transition-all min-h-[36px] text-[#6f42c1] hover:bg-[#f3e5f5] hover:border-[#59359a]" disabled>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/>
                <line x1="8" y1="21" x2="16" y2="21"/>
                <line x1="12" y1="17" x2="12" y2="21"/>
              </svg>
              {{ $t('sessions.downloadAllScreen') }}
            </button>
          </div>
          <div class="flex-1 overflow-y-auto flex flex-col gap-px bg-elevated rounded-lg p-1 [&_span]:whitespace-nowrap scrollbar-thin">
            <div
              v-for="session in mockSessions"
              :key="session.id"
              class="flex items-center justify-between px-3 py-2 bg-surface rounded cursor-pointer transition-all min-h-12 !cursor-default !pointer-events-none hover:!bg-surface hover:!shadow-none"
            >
              <div class="flex items-center gap-3 flex-1 min-w-0">
                <div class="flex items-center justify-center w-8 h-8 bg-accent/5 rounded-md text-accent shrink-0">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polygon points="5,3 19,12 5,21"/>
                  </svg>
                </div>
                <div class="flex-1 min-w-0">
                  <div class="text-sm font-semibold text-text mb-0.5 whitespace-nowrap overflow-hidden text-ellipsis">{{ session.title }}</div>
                  <div class="flex gap-3 text-xs text-text-secondary">
                    <span class="text-accent font-medium">
                      {{ $t('sessions.week') }} {{ session.week }}{{ $t('sessions.week') === '第' ? '周' : '' }}, {{ session.day }}
                    </span>
                    <span>
                      {{ session.duration }}
                    </span>
                    <span class="text-text-muted">
                      {{ session.date }}
                    </span>
                  </div>
                </div>
              </div>
              <div class="w-[200px] flex justify-end items-center gap-1 shrink-0">
                <button class="flex flex-col items-center justify-center w-[60px] h-[40px] border border-success rounded bg-surface cursor-pointer transition-all gap-0.5 text-success !cursor-default !pointer-events-none hover:-translate-y-[1px] hover:shadow-[0_2px_4px_rgba(0,0,0,0.1)] hover:!transform-none hover:!shadow-none" :title="$t('sessions.addToTask')">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                    <polyline points="14,2 14,8 20,8"/>
                    <line x1="16" y1="13" x2="8" y2="13"/>
                    <line x1="16" y1="17" x2="8" y2="17"/>
                    <line x1="10" y1="9" x2="8" y2="9"/>
                  </svg>
                  <span class="text-[10px] font-medium leading-none">{{ $t('sessions.task') }}</span>
                </button>
                <button class="flex flex-col items-center justify-center w-[60px] h-[40px] border border-accent rounded bg-surface cursor-pointer transition-all gap-0.5 text-accent !cursor-default !pointer-events-none hover:-translate-y-[1px] hover:shadow-[0_2px_4px_rgba(0,0,0,0.1)] hover:!transform-none hover:!shadow-none" :title="$t('sessions.downloadCamera')">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                    <circle cx="12" cy="13" r="4"/>
                  </svg>
                  <span class="text-[10px] font-medium leading-none">{{ $t('sessions.camera') }}</span>
                </button>
                <button class="flex flex-col items-center justify-center w-[60px] h-[40px] border border-[#6f42c1] rounded bg-surface cursor-pointer transition-all gap-0.5 text-[#6f42c1] !cursor-default !pointer-events-none hover:-translate-y-[1px] hover:shadow-[0_2px_4px_rgba(0,0,0,0.1)] hover:!transform-none hover:!shadow-none" :title="$t('sessions.downloadScreen')">
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
/* WebKit scrollbar pseudo-elements cannot be expressed as Tailwind utilities */
.scrollbar-thin {
  scrollbar-width: thin;
  scrollbar-color: transparent transparent;
  transition: scrollbar-color 0.3s ease;
}

.scrollbar-thin:hover {
  scrollbar-color: rgba(0, 0, 0, 0.2) transparent;
}

.scrollbar-thin::-webkit-scrollbar {
  width: 6px;
}

.scrollbar-thin::-webkit-scrollbar-track {
  background: transparent;
  border-radius: 3px;
}

.scrollbar-thin::-webkit-scrollbar-thumb {
  background: transparent;
  border-radius: 3px;
  border: none;
  transition: background 0.3s ease;
}

.scrollbar-thin:hover::-webkit-scrollbar-thumb {
  background: rgba(0, 0, 0, 0.2);
}

.scrollbar-thin::-webkit-scrollbar-thumb:hover {
  background: rgba(0, 0, 0, 0.3) !important;
}
</style>
