<template>
  <div class="flex h-full flex-col p-4">
    <div class="mb-4 flex items-start justify-between gap-6 rounded-lg border border-accent/10 bg-gradient-to-br from-white to-bg-elevated px-6 py-2.5 shadow-[0_2px_12px_rgba(0,0,0,0.08)] dark:from-bg-surface dark:to-[var(--text-primary)]">
      <div class="title-section">
        <h2 class="gradient-title m-0 ml-6 mt-6 text-[28px] font-bold">{{ $t('courses.title.recordings') }}</h2>
      </div>
      <!-- 'controls-section' retained as a Driver.js tour hook -->
      <div class="controls-section flex min-w-[300px] flex-col gap-3">
        <div class="flex items-center gap-2" id="tour-search-row">
          <input
            v-model="searchQuery"
            type="text"
            :placeholder="$t('courses.search.placeholder')"
            class="flex-1 rounded border border-border-input bg-elevated px-3 py-2 text-sm"
            readonly
          />
          <button class="flex items-center gap-1.5 rounded border border-accent bg-accent px-4 py-2 text-sm text-white transition-colors hover:bg-accent-strong dark:text-[#1a1a1a]" disabled>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="11" cy="11" r="8"/>
              <path d="m21 21-4.35-4.35"/>
            </svg>
            {{ $t('courses.search.button') }}
          </button>
        </div>
        <div class="flex items-center gap-2">
          <button class="flex w-full items-center justify-center gap-1.5 rounded border border-accent bg-accent px-4 py-2 text-sm text-white transition-colors hover:bg-accent-strong dark:text-[#1a1a1a]" disabled>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="7,10 12,15 17,10"/>
              <line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
            {{ $t('courses.actions.getPersonalCourseList') }}
          </button>
        </div>
      </div>
    </div>

    <!-- 'content' retained as a Driver.js tour hook -->
    <div class="content flex min-h-0 flex-1 flex-col">
      <div v-if="showWelcome" class="flex flex-1 items-start justify-center px-6 pb-12 pt-[20%]">
        <div class="text-center">
          <p class="m-0 text-[28px] font-medium tracking-[-0.3px] text-text-text dark:text-border-border">{{ $t('demo.greeting') }}</p>
          <div class="mx-auto mt-12 w-[640px] max-w-[calc(100%-32px)] rounded-xl border border-black/10 px-6 pb-5 pt-4 dark:border-white/10" id="tour-saved-courses">
            <p class="m-0 mb-3.5 text-center text-[11px] font-semibold uppercase tracking-[0.06em] text-text-text-muted">{{ $t('courses.savedSearches.sectionTitle') }}</p>
            <div class="flex max-w-[700px] flex-wrap justify-center gap-3">
              <div
                v-for="keyword in savedSearches"
                :key="keyword"
                class="pointer-events-none relative flex h-16 w-[88px] flex-col items-center justify-center gap-1.5 overflow-hidden rounded-[10px] border border-border-border bg-white px-2 py-1.5 opacity-50 dark:border-[var(--bg-hover)] dark:bg-bg-surface"
              >
                <div class="shrink-0 text-bg-accent">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="11" cy="11" r="8"/>
                    <path d="m21 21-4.35-4.35"/>
                  </svg>
                </div>
                <span class="max-w-20 truncate text-[11px] leading-tight text-text-text dark:text-[var(--border-strong)]">{{ keyword }}</span>
              </div>
              <div class="pointer-events-none relative flex h-16 w-[88px] flex-col items-center justify-center gap-1.5 overflow-hidden rounded-[10px] border border-dashed border-border-border-strong bg-bg-page px-2 py-1.5 opacity-50 dark:border-[var(--text-secondary)] dark:bg-[#262626]">
                <div class="shrink-0 text-text-text-muted">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <line x1="12" y1="5" x2="12" y2="19"/>
                    <line x1="5" y1="12" x2="19" y2="12"/>
                  </svg>
                </div>
              </div>
            </div>
          </div>
          <p class="mt-6 text-center text-[11px] text-text-text-muted">{{ $t('courses.welcome.subtitle') }}</p>
        </div>
      </div>

      <div v-if="isLoading" class="flex flex-1 flex-col items-center justify-center gap-4">
        <div class="h-8 w-8 animate-spin rounded-full border-[3px] border-[var(--bg-elevated)] border-t-accent dark:border-[var(--text-secondary)]"></div>
        <p>{{ $t('courses.loading') }}</p>
      </div>

      <div v-else-if="!showWelcome" class="courses-grid grid min-h-0 flex-1 grid-cols-4 gap-3 overflow-y-auto pb-4 pr-2 max-[1200px]:grid-cols-3 max-[900px]:grid-cols-2 max-[600px]:grid-cols-1" id="tour-course-list">
        <div
          v-for="course in mockCourses"
          :key="course.id"
          class="relative flex h-[140px] cursor-pointer flex-col overflow-hidden rounded-md border border-border bg-surface p-2.5 transition-all hover:border-accent hover:shadow-[0_2px_8px_rgba(0,122,204,0.1)]"
        >
          <div class="absolute right-2 top-2 rounded-[3px] bg-bg-page px-1.5 py-0.5 text-[10px] font-semibold text-text-secondary dark:bg-[#3a3a3a]">
            #{{ course.id }}
          </div>
          <div class="flex flex-1 flex-col justify-between pt-[18px] text-left">
            <h3 class="m-0 mb-1 line-clamp-2 text-xs font-semibold leading-tight text-text">{{ course.title }}</h3>
            <p class="m-0 mb-[3px] truncate text-[10px] font-medium text-text-secondary">{{ course.instructor }}</p>
            <p class="m-0 mb-[3px] truncate text-[10px] text-text-muted">{{ course.location }}</p>
            <p class="m-0 mb-[3px] truncate text-[10px] text-[#999]">{{ course.time }}</p>
            <p class="m-0 mb-[3px] truncate text-[9px] text-text-muted">{{ course.college }}</p>
            <p class="m-0 truncate text-[9px] font-medium text-accent">
              {{ course.participants }} {{ $t('courses.info.participants') }}
            </p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'

interface Course {
  id: string
  title: string
  instructor: string
  location: string
  time: string
  college: string
  participants: number
}

const props = defineProps<{
  mode: 'live' | 'recorded'
}>()

const emit = defineEmits<{
  courseSelected: [course: Course]
}>()

const { t } = useI18n()

const searchQuery = ref('')
const isLoading = ref(false)
const showWelcome = ref(true)

const savedSearches = computed(() => [
  t('demo.courses.functionalAnalysis.title'),
  t('demo.courses.realAnalysis.title'),
  t('demo.courses.complexAnalysis.title'),
  t('demo.courses.abstractAlgebra.title')
])

// Mock course data for demo (16 mathematics courses)
const mockCourses = computed<Course[]>(() => [
  {
    id: '001',
    title: t('demo.courses.functionalAnalysis.title'),
    instructor: t('demo.courses.functionalAnalysis.instructor'),
    location: t('demo.courses.functionalAnalysis.location'),
    time: '2024 Fall',
    college: t('demo.courses.functionalAnalysis.college'),
    participants: 120
  },
  {
    id: '002',
    title: t('demo.courses.realAnalysis.title'),
    instructor: t('demo.courses.realAnalysis.instructor'),
    location: t('demo.courses.realAnalysis.location'),
    time: '2024 Fall',
    college: t('demo.courses.realAnalysis.college'),
    participants: 95
  },
  {
    id: '003',
    title: t('demo.courses.complexAnalysis.title'),
    instructor: t('demo.courses.complexAnalysis.instructor'),
    location: t('demo.courses.complexAnalysis.location'),
    time: '2024 Fall',
    college: t('demo.courses.complexAnalysis.college'),
    participants: 150
  },
  {
    id: '004',
    title: t('demo.courses.abstractAlgebra.title'),
    instructor: t('demo.courses.abstractAlgebra.instructor'),
    location: t('demo.courses.abstractAlgebra.location'),
    time: '2024 Fall',
    college: t('demo.courses.abstractAlgebra.college'),
    participants: 180
  },
  {
    id: '005',
    title: t('demo.courses.differentialGeometry.title'),
    instructor: t('demo.courses.differentialGeometry.instructor'),
    location: t('demo.courses.differentialGeometry.location'),
    time: '2024 Fall',
    college: t('demo.courses.differentialGeometry.college'),
    participants: 160
  },
  {
    id: '006',
    title: t('demo.courses.algebraicTopology.title'),
    instructor: t('demo.courses.algebraicTopology.instructor'),
    location: t('demo.courses.algebraicTopology.location'),
    time: '2024 Fall',
    college: t('demo.courses.algebraicTopology.college'),
    participants: 80
  },
  {
    id: '007',
    title: t('demo.courses.numberTheory.title'),
    instructor: t('demo.courses.numberTheory.instructor'),
    location: t('demo.courses.numberTheory.location'),
    time: '2024 Fall',
    college: t('demo.courses.numberTheory.college'),
    participants: 110
  },
  {
    id: '008',
    title: t('demo.courses.partialDifferentialEquations.title'),
    instructor: t('demo.courses.partialDifferentialEquations.instructor'),
    location: t('demo.courses.partialDifferentialEquations.location'),
    time: '2024 Fall',
    college: t('demo.courses.partialDifferentialEquations.college'),
    participants: 90
  },
  {
    id: '009',
    title: t('demo.courses.measureTheory.title'),
    instructor: t('demo.courses.measureTheory.instructor'),
    location: t('demo.courses.measureTheory.location'),
    time: '2024 Fall',
    college: t('demo.courses.measureTheory.college'),
    participants: 75
  },
  {
    id: '010',
    title: t('demo.courses.algebraicGeometry.title'),
    instructor: t('demo.courses.algebraicGeometry.instructor'),
    location: t('demo.courses.algebraicGeometry.location'),
    time: '2024 Fall',
    college: t('demo.courses.algebraicGeometry.college'),
    participants: 65
  },
  {
    id: '011',
    title: t('demo.courses.harmonicAnalysis.title'),
    instructor: t('demo.courses.harmonicAnalysis.instructor'),
    location: t('demo.courses.harmonicAnalysis.location'),
    time: '2024 Fall',
    college: t('demo.courses.harmonicAnalysis.college'),
    participants: 140
  },
  {
    id: '012',
    title: t('demo.courses.operatorTheory.title'),
    instructor: t('demo.courses.operatorTheory.instructor'),
    location: t('demo.courses.operatorTheory.location'),
    time: '2024 Fall',
    college: t('demo.courses.operatorTheory.college'),
    participants: 85
  },
  {
    id: '013',
    title: t('demo.courses.stochasticProcesses.title'),
    instructor: t('demo.courses.stochasticProcesses.instructor'),
    location: t('demo.courses.stochasticProcesses.location'),
    time: '2024 Fall',
    college: t('demo.courses.stochasticProcesses.college'),
    participants: 200
  },
  {
    id: '014',
    title: t('demo.courses.mathematicalLogic.title'),
    instructor: t('demo.courses.mathematicalLogic.instructor'),
    location: t('demo.courses.mathematicalLogic.location'),
    time: '2024 Fall',
    college: t('demo.courses.mathematicalLogic.college'),
    participants: 50
  },
  {
    id: '015',
    title: t('demo.courses.categoryTheory.title'),
    instructor: t('demo.courses.categoryTheory.instructor'),
    location: t('demo.courses.categoryTheory.location'),
    time: '2024 Fall',
    college: t('demo.courses.categoryTheory.college'),
    participants: 60
  },
  {
    id: '016',
    title: t('demo.courses.homologicalAlgebra.title'),
    instructor: t('demo.courses.homologicalAlgebra.instructor'),
    location: t('demo.courses.homologicalAlgebra.location'),
    time: '2024 Fall',
    college: t('demo.courses.homologicalAlgebra.college'),
    participants: 100
  }
])

const demoSearch = () => {
  showWelcome.value = false
  isLoading.value = true

  // Simulate loading
  setTimeout(() => {
    isLoading.value = false
  }, 1000)
}

const demoFetchPersonal = () => {
  showWelcome.value = false
  isLoading.value = true

  // Simulate loading
  setTimeout(() => {
    isLoading.value = false
  }, 1000)
}

const selectCourse = (course: Course) => {
  // Demo mode - just emit the event
  emit('courseSelected', course)
}

const handleDemoTriggerSearch = () => {
  demoSearch()
}

onMounted(() => {
  // Listen for demo search trigger
  window.addEventListener('demo-trigger-search', handleDemoTriggerSearch)
})

onUnmounted(() => {
  window.removeEventListener('demo-trigger-search', handleDemoTriggerSearch)
})

// Expose methods for parent component
defineExpose({
  demoSearch,
  demoFetchPersonal
})
</script>

<style scoped>
/* Gradient text for the title — requires background-clip + text-fill-color which need a style rule. */
.gradient-title {
  background: linear-gradient(135deg, var(--accent) 0%, #0056b3 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

/* Auto-hiding scrollbar for the course grid — genuinely custom pseudo-element styling. */
.courses-grid {
  scrollbar-width: thin;
  scrollbar-color: transparent transparent;
  transition: scrollbar-color 0.3s ease;
}
.courses-grid:hover { scrollbar-color: rgba(0, 0, 0, 0.2) transparent; }
.courses-grid::-webkit-scrollbar { width: 6px; }
.courses-grid::-webkit-scrollbar-track { background: transparent; border-radius: 3px; }
.courses-grid::-webkit-scrollbar-thumb { background: transparent; border-radius: 3px; transition: background 0.3s ease; }
.courses-grid:hover::-webkit-scrollbar-thumb { background: rgba(0, 0, 0, 0.2); }
.courses-grid::-webkit-scrollbar-thumb:hover { background: rgba(0, 0, 0, 0.3); }
</style>
