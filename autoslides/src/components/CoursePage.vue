<template>
  <div class="course-page">
    <div class="header">
      <div class="title-section">
        <h2>{{ mode === 'live' ? 'Live' : 'Recorded' }}</h2>
      </div>
      <div class="controls-section">
        <div class="search-row">
          <input
            v-model="searchQuery"
            type="text"
            placeholder="Search courses..."
            class="search-input"
          />
          <button @click="searchCourses" class="search-btn">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="11" cy="11" r="8"/>
              <path d="m21 21-4.35-4.35"/>
            </svg>
            Search
          </button>
        </div>
        <div class="fetch-row">
          <button @click="fetchPersonalCourses" class="fetch-btn">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="7,10 12,15 17,10"/>
              <line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
            Get Personal Course List
          </button>
        </div>
      </div>
    </div>

    <div class="content">
      <div v-if="isLoading" class="loading-state">
        <div class="spinner"></div>
        <p>Loading courses...</p>
      </div>
      <div v-else class="courses-grid">
        <div
          v-for="course in paginatedCourses"
          :key="course.id"
          class="course-card"
          @click="selectCourse(course)"
        >
          <div class="course-image">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
              <line x1="16" y1="2" x2="16" y2="6"/>
              <line x1="8" y1="2" x2="8" y2="6"/>
              <line x1="3" y1="10" x2="21" y2="10"/>
            </svg>
          </div>
          <div class="course-info">
            <h3 class="course-title">{{ course.title }}</h3>
            <p class="course-instructor">{{ course.instructor }}</p>
            <p class="course-time">{{ course.time }}</p>
          </div>
        </div>
      </div>

      <div v-if="!isLoading && courses.length > 0" class="pagination">
        <button
          :disabled="currentPage === 1"
          @click="goToPage(currentPage - 1)"
          class="page-btn"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="15,18 9,12 15,6"/>
          </svg>
        </button>
        <span class="page-info">{{ currentPage }} / {{ totalPages }}</span>
        <button
          :disabled="currentPage === totalPages"
          @click="goToPage(currentPage + 1)"
          class="page-btn"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="9,18 15,12 9,6"/>
          </svg>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'

interface Course {
  id: string
  title: string
  instructor: string
  time: string
}

const props = defineProps<{
  mode: 'live' | 'recorded'
}>()

const emit = defineEmits<{
  courseSelected: [course: Course]
}>()

const searchQuery = ref('')
const isLoading = ref(false)
const courses = ref<Course[]>([])
const currentPage = ref(1)
const coursesPerPage = 16

const mockCourses: Course[] = [
  { id: '1', title: 'Introduction to Computer Science', instructor: 'Dr. Smith', time: '10:00 AM' },
  { id: '2', title: 'Advanced Mathematics', instructor: 'Prof. Johnson', time: '2:00 PM' },
  { id: '3', title: 'Physics Fundamentals', instructor: 'Dr. Brown', time: '9:00 AM' },
  { id: '4', title: 'Chemistry Lab', instructor: 'Prof. Davis', time: '3:00 PM' },
  { id: '5', title: 'Biology Basics', instructor: 'Dr. Wilson', time: '11:00 AM' },
  { id: '6', title: 'History of Science', instructor: 'Prof. Miller', time: '1:00 PM' },
  { id: '7', title: 'English Literature', instructor: 'Dr. Garcia', time: '10:30 AM' },
  { id: '8', title: 'Art Appreciation', instructor: 'Prof. Martinez', time: '4:00 PM' },
]

const totalPages = computed(() => Math.ceil(courses.value.length / coursesPerPage))

const paginatedCourses = computed(() => {
  const start = (currentPage.value - 1) * coursesPerPage
  const end = start + coursesPerPage
  return courses.value.slice(start, end)
})

const searchCourses = () => {
  if (searchQuery.value.trim()) {
    courses.value = mockCourses.filter(course =>
      course.title.toLowerCase().includes(searchQuery.value.toLowerCase()) ||
      course.instructor.toLowerCase().includes(searchQuery.value.toLowerCase())
    )
  } else {
    courses.value = [...mockCourses]
  }
  currentPage.value = 1
}

const fetchPersonalCourses = async () => {
  isLoading.value = true

  setTimeout(() => {
    courses.value = [...mockCourses]
    isLoading.value = false
  }, 1500)
}

const selectCourse = (course: Course) => {
  emit('courseSelected', course)
}

const goToPage = (page: number) => {
  if (page >= 1 && page <= totalPages.value) {
    currentPage.value = page
  }
}

onMounted(() => {
  fetchPersonalCourses()
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
  margin-bottom: 24px;
  gap: 24px;
}

.title-section h2 {
  margin: 0;
  font-size: 24px;
  font-weight: 600;
  color: #333;
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
}

.search-input {
  flex: 1;
  padding: 8px 12px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 14px;
}

.search-btn, .fetch-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  border: 1px solid #007acc;
  border-radius: 4px;
  background-color: #007acc;
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
  gap: 16px;
  flex: 1;
  overflow-y: auto;
  padding-bottom: 16px;
}

.course-card {
  display: flex;
  flex-direction: column;
  padding: 16px;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  background-color: white;
  cursor: pointer;
  transition: all 0.2s;
  height: fit-content;
}

.course-card:hover {
  border-color: #007acc;
  box-shadow: 0 2px 8px rgba(0, 122, 204, 0.1);
}

.course-image {
  display: flex;
  justify-content: center;
  margin-bottom: 12px;
  color: #666;
}

.course-info {
  text-align: center;
}

.course-title {
  margin: 0 0 8px 0;
  font-size: 14px;
  font-weight: 600;
  color: #333;
  line-height: 1.3;
}

.course-instructor {
  margin: 0 0 4px 0;
  font-size: 12px;
  color: #666;
}

.course-time {
  margin: 0;
  font-size: 12px;
  color: #999;
}

.pagination {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 16px;
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid #e0e0e0;
}

.page-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border: 1px solid #ddd;
  border-radius: 4px;
  background-color: white;
  cursor: pointer;
  transition: all 0.2s;
}

.page-btn:hover:not(:disabled) {
  border-color: #007acc;
  background-color: #f8f9fa;
}

.page-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.page-info {
  font-size: 14px;
  color: #666;
  min-width: 60px;
  text-align: center;
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
</style>