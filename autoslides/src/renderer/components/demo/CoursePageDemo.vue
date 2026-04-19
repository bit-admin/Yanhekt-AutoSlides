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

<style scoped>
.course-page {
  display: flex;
  flex-direction: column;
  height: 100%;
  padding: 16px;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 16px;
  gap: 24px;
  background: linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%);
  border-radius: 8px;
  padding: 10px 24px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.08);
  border: 1px solid rgba(0, 122, 204, 0.1);
}

.title-section h2 {
  margin: 25px 0 0 25px;
  font-size: 28px;
  font-weight: 700;
  color: #2c3e50;
  background: linear-gradient(135deg, #007bff 0%, #0056b3 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  text-shadow: 0 2px 4px rgba(0, 122, 204, 0.1);
}

.controls-section {
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-width: 300px;
}

.search-row, .fetch-row {
  display: flex;
  gap: 8px;
  align-items: center;
}

.search-input {
  flex: 1;
  padding: 8px 12px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 14px;
  background-color: #f8f9fa;
}

.search-btn, .fetch-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  border: 1px solid #007bff;
  border-radius: 4px;
  background-color: #007bff;
  color: white;
  font-size: 14px;
  cursor: pointer;
  transition: background-color 0.2s;
}

.search-btn:hover, .fetch-btn:hover {
  background-color: #005a9e;
}

.fetch-btn {
  width: 100%;
  justify-content: center;
}

.content {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  flex: 1;
  gap: 16px;
}

.spinner {
  width: 32px;
  height: 32px;
  border: 3px solid #f3f3f3;
  border-top: 3px solid #007acc;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.courses-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
  flex: 1;
  overflow-y: auto;
  padding-bottom: 16px;
  padding-right: 8px;
  min-height: 0;
}

.course-card {
  display: flex;
  flex-direction: column;
  padding: 10px;
  border: 1px solid #e0e0e0;
  border-radius: 6px;
  background-color: white;
  cursor: pointer;
  transition: all 0.2s;
  height: 140px;
  position: relative;
  overflow: hidden;
}

.course-card:hover {
  border-color: #007acc;
  box-shadow: 0 2px 8px rgba(0, 122, 204, 0.1);
}

.course-card-demo {
  cursor: pointer !important;
  pointer-events: auto;
}

.course-card-demo:hover {
  border-color: #007acc !important;
  box-shadow: 0 2px 8px rgba(0, 122, 204, 0.1) !important;
}

.course-id {
  position: absolute;
  top: 8px;
  right: 8px;
  padding: 2px 6px;
  border-radius: 3px;
  font-size: 10px;
  font-weight: 600;
  background-color: #f0f0f0;
  color: #666;
}

.course-info {
  text-align: left;
  padding-top: 18px;
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
}

.course-title {
  margin: 0 0 4px 0;
  font-size: 12px;
  font-weight: 600;
  color: #333;
  line-height: 1.2;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.course-instructor {
  margin: 0 0 3px 0;
  font-size: 10px;
  color: #666;
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.course-location {
  margin: 0 0 3px 0;
  font-size: 10px;
  color: #888;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.course-time {
  margin: 0 0 3px 0;
  font-size: 10px;
  color: #999;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.course-section {
  margin: 0 0 3px 0;
  font-size: 9px;
  color: #aaa;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.course-participants {
  margin: 0;
  font-size: 9px;
  color: #007acc;
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* Welcome page styles */
.welcome-page {
  flex: 1;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding: 20% 24px 48px;
}

.welcome-content {
  text-align: center;
}

.greeting-line {
  margin: 0;
  font-size: 28px;
  font-weight: 500;
  color: #374151;
  letter-spacing: -0.3px;
}

.saved-courses-section {
  margin: 48px auto 0;
  width: 640px;
  max-width: calc(100% - 32px);
  padding: 16px 24px 20px;
  border: 1px solid rgba(0, 0, 0, 0.12);
  border-radius: 12px;
}

.saved-courses-title {
  margin: 0 0 14px 0;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: #9ca3af;
  text-align: center;
}

.welcome-subtitle {
  margin: 24px 0 0;
  font-size: 11px;
  color: #9ca3af;
  text-align: center;
}

.saved-courses-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  justify-content: center;
  max-width: 700px;
}

.course-shortcut-card {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  width: 88px;
  height: 64px;
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  cursor: pointer;
  transition: all 0.2s;
  padding: 6px 8px;
  overflow: hidden;
}

.course-shortcut-card:hover {
  border-color: #93c5fd;
  background: #eff6ff;
  box-shadow: 0 2px 8px rgba(59, 130, 246, 0.15);
}

.shortcut-icon {
  color: #3b82f6;
  flex-shrink: 0;
}

.shortcut-label {
  font-size: 11px;
  color: #374151;
  text-align: center;
  line-height: 1.2;
  max-width: 80px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.course-shortcut-add {
  border-style: dashed;
  border-color: #cbd5e1;
  background: #f8fafc;
}

.course-shortcut-add:hover {
  border-color: #60a5fa;
  background: #eff6ff;
}

.shortcut-add-icon {
  color: #94a3b8;
}

.course-shortcut-add:hover .shortcut-add-icon {
  color: #3b82f6;
}

@media (max-width: 1200px) {
  .courses-grid {
    grid-template-columns: repeat(3, 1fr);
  }
}

@media (max-width: 900px) {
  .courses-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 600px) {
  .courses-grid {
    grid-template-columns: 1fr;
  }
}

/* Custom scrollbar styles */
.courses-grid {
  scrollbar-width: thin;
  scrollbar-color: transparent transparent;
  transition: scrollbar-color 0.3s ease;
}

.courses-grid:hover {
  scrollbar-color: rgba(0, 0, 0, 0.2) transparent;
}

.courses-grid::-webkit-scrollbar {
  width: 6px;
}

.courses-grid::-webkit-scrollbar-track {
  background: transparent;
  border-radius: 3px;
}

.courses-grid::-webkit-scrollbar-thumb {
  background: transparent;
  border-radius: 3px;
  border: none;
  transition: background 0.3s ease;
}

.courses-grid:hover::-webkit-scrollbar-thumb {
  background: rgba(0, 0, 0, 0.2);
}

.courses-grid::-webkit-scrollbar-thumb:hover {
  background: rgba(0, 0, 0, 0.3) !important;
}

</style>