<template>
  <div class="course-page">
    <div class="header">
      <div class="title-section">
        <h2>{{ $t('courses.title.recordings') }}</h2>
      </div>
      <div class="controls-section">
        <div class="search-row" id="tour-search-row">
          <input
            v-model="searchQuery"
            type="text"
            :placeholder="$t('courses.search.placeholder')"
            class="search-input"
            readonly
          />
          <button class="search-btn" disabled>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="11" cy="11" r="8"/>
              <path d="m21 21-4.35-4.35"/>
            </svg>
            {{ $t('courses.search.button') }}
          </button>
        </div>
        <div class="fetch-row">
          <button class="fetch-btn" disabled>
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

    <div class="content">
      <div v-if="showWelcome" class="welcome-page">
        <div class="welcome-content">
          <p class="greeting-line">{{ $t('demo.greeting') }}</p>
          <div class="saved-courses-section" id="tour-saved-courses">
            <p class="saved-courses-title">{{ $t('courses.savedSearches.sectionTitle') }}</p>
            <div class="saved-courses-grid">
              <div
                v-for="keyword in savedSearches"
                :key="keyword"
                class="course-shortcut-card demo-disabled"
              >
                <div class="shortcut-icon">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="11" cy="11" r="8"/>
                    <path d="m21 21-4.35-4.35"/>
                  </svg>
                </div>
                <span class="shortcut-label">{{ keyword }}</span>
              </div>
              <div class="course-shortcut-card course-shortcut-add demo-disabled">
                <div class="shortcut-icon shortcut-add-icon">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <line x1="12" y1="5" x2="12" y2="19"/>
                    <line x1="5" y1="12" x2="19" y2="12"/>
                  </svg>
                </div>
              </div>
            </div>
          </div>
          <p class="welcome-subtitle">{{ $t('courses.welcome.subtitle') }}</p>
        </div>
      </div>

      <div v-if="isLoading" class="loading-state">
        <div class="spinner"></div>
        <p>{{ $t('courses.loading') }}</p>
      </div>

      <div v-else-if="!showWelcome" class="courses-grid" id="tour-course-list">
        <div
          v-for="course in mockCourses"
          :key="course.id"
          class="course-card course-card-demo"
        >
          <div class="course-id">
            #{{ course.id }}
          </div>
          <div class="course-info">
            <h3 class="course-title">{{ course.title }}</h3>
            <p class="course-instructor">{{ course.instructor }}</p>
            <p class="course-location">{{ course.location }}</p>
            <p class="course-time">{{ course.time }}</p>
            <p class="course-section">{{ course.college }}</p>
            <p class="course-participants">
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
