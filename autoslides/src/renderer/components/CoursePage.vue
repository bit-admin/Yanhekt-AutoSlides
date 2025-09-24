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
          <div v-if="mode === 'recorded'" class="semester-selector">
            <button @click="toggleSemesterDropdown" class="semester-dropdown-btn">
              <span>{{ semesterDropdownText }}</span>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="6,9 12,15 18,9"/>
              </svg>
            </button>
            <div v-show="showSemesterDropdown" class="semester-dropdown">
              <div class="semester-options">
                <label v-for="semester in availableSemesters" :key="semester.id" class="semester-option">
                  <input
                    type="checkbox"
                    :value="semester.id"
                    v-model="selectedSemesters"
                    @change="updateSemesterDropdownText"
                  />
                  <span>{{ semester.labelEn }}</span>
                </label>
              </div>
            </div>
          </div>
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
      <div v-if="errorMessage" class="error-message">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10"/>
          <line x1="15" y1="9" x2="9" y2="15"/>
          <line x1="9" y1="9" x2="15" y2="15"/>
        </svg>
        {{ errorMessage }}
      </div>
      <div v-if="isLoading" class="loading-state">
        <div class="spinner"></div>
        <p>Loading courses...</p>
      </div>
      <div v-else-if="!errorMessage" class="courses-grid">
        <div
          v-for="course in paginatedCourses"
          :key="course.id"
          class="course-card"
          @click="selectCourse(course)"
        >
          <div v-if="mode === 'live'" class="course-status" :class="getStatusClass(course.status)">
            {{ getStatusText(course.status) }}
          </div>
          <div v-if="mode === 'recorded'" class="course-id">
            #{{ course.id }}
          </div>
          <div class="course-info">
            <h3 class="course-title">{{ course.title }}</h3>
            <p class="course-instructor">{{ course.instructor }}</p>
            <p class="course-location" v-if="mode === 'live' && course.subtitle">{{ course.subtitle }}</p>
            <p class="course-location" v-if="mode === 'recorded' && course.classrooms">
              {{ course.classrooms.map(c => c.name).join(', ') }}
            </p>
            <p class="course-time">{{ course.time }}</p>
            <p class="course-section" v-if="mode === 'live' && course.session?.section_group_title">{{ course.session.section_group_title }}</p>
            <p class="course-section" v-if="mode === 'recorded' && course.college_name">{{ course.college_name }}</p>
            <p class="course-participants" v-if="course.participant_count !== undefined">
              {{ course.participant_count }} participants
            </p>
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
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { ApiClient, type LiveStream, type LiveListResponse, type CourseData, type CourseListResponse, type SemesterOption } from '../services/apiClient'
import { TokenManager } from '../services/authService'
import { DataStore } from '../services/dataStore'

interface Course {
  id: string
  title: string
  instructor: string
  time: string
  status?: number
  subtitle?: string
  schedule_started_at?: string
  schedule_ended_at?: string
  participant_count?: number
  session?: {
    professor?: {
      name: string;
    };
    section_group_title?: string;
  };
  target?: string; // Camera stream URL
  target_vga?: string; // Screen stream URL
  // Record mode specific fields
  professors?: string[];
  classrooms?: { name: string }[];
  school_year?: string;
  semester?: string;
  college_name?: string;
}

const props = defineProps<{
  mode: 'live' | 'recorded'
}>()

const emit = defineEmits<{
  courseSelected: [course: Course]
}>()

const apiClient = new ApiClient()
const tokenManager = new TokenManager()
const searchQuery = ref('')
const isLoading = ref(false)
const courses = ref<Course[]>([])
const currentPage = ref(1)
const totalPages = ref(1)
const coursesPerPage = 16
const errorMessage = ref('')

// Record mode specific state
const availableSemesters = ref<SemesterOption[]>([])
const selectedSemesters = ref<number[]>([])
const showSemesterDropdown = ref(false)
const semesterDropdownText = ref('All Semesters')

const paginatedCourses = computed(() => {
  return courses.value
})

const searchCourses = async () => {
  const token = tokenManager.getToken()
  if (!token) {
    errorMessage.value = 'Please login first'
    return
  }

  isLoading.value = true
  errorMessage.value = ''

  try {
    if (props.mode === 'live') {
      const keyword = searchQuery.value.trim()
      if (!keyword) {
        errorMessage.value = 'Please enter a search keyword'
        return
      }

      const response: LiveListResponse = await apiClient.searchLiveList(token, keyword, currentPage.value, coursesPerPage)
      courses.value = response.data.map(transformLiveStreamToCourse)
      totalPages.value = response.last_page
      currentPage.value = response.current_page
    } else {
      // Record mode search
      const options = {
        keyword: searchQuery.value.trim(),
        semesters: selectedSemesters.value,
        page: currentPage.value,
        pageSize: coursesPerPage
      }
      const response: CourseListResponse = await apiClient.getCourseList(token, options)
      courses.value = response.data.map(transformCourseDataToCourse)
      totalPages.value = response.last_page
      currentPage.value = response.current_page
    }
  } catch (error: any) {
    console.error('Search failed:', error)
    errorMessage.value = error.message || 'Failed to search courses'
    courses.value = []
  } finally {
    isLoading.value = false
  }
}

const fetchPersonalCourses = async () => {
  const token = tokenManager.getToken()
  if (!token) {
    errorMessage.value = 'Please login first'
    return
  }

  isLoading.value = true
  errorMessage.value = ''

  try {
    if (props.mode === 'live') {
      const response: LiveListResponse = await apiClient.getPersonalLiveList(token, currentPage.value, coursesPerPage)
      courses.value = response.data.map(transformLiveStreamToCourse)
      totalPages.value = response.last_page
      currentPage.value = response.current_page
    } else {
      // Record mode personal courses
      const options = {
        page: currentPage.value,
        pageSize: coursesPerPage
      }
      const response: CourseListResponse = await apiClient.getPersonalCourseList(token, options)
      courses.value = response.data.map(transformCourseDataToCourse)
      totalPages.value = response.last_page
      currentPage.value = response.current_page
    }
  } catch (error: any) {
    console.error('Failed to fetch personal courses:', error)
    errorMessage.value = error.message || 'Failed to fetch personal courses'
    courses.value = []
  } finally {
    isLoading.value = false
  }
}

const transformLiveStreamToCourse = (stream: LiveStream): Course => {
  const startTime = new Date(stream.schedule_started_at).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit'
  })
  const endTime = new Date(stream.schedule_ended_at).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit'
  })

  return {
    id: stream.id || stream.live_id || '',
    title: stream.title || 'Untitled',
    instructor: stream.session?.professor?.name || 'Unknown',
    time: `${startTime} - ${endTime}`,
    status: stream.status,
    subtitle: stream.subtitle,
    schedule_started_at: stream.schedule_started_at,
    schedule_ended_at: stream.schedule_ended_at,
    participant_count: stream.participant_count,
    session: stream.session,
    target: stream.target,
    target_vga: stream.target_vga
  }
}

const transformCourseDataToCourse = (courseData: CourseData): Course => {
  const professors = courseData.professors ? courseData.professors.join(', ') : 'Unknown'
  const classrooms = courseData.classrooms && courseData.classrooms.length > 0
    ? courseData.classrooms.map(c => c.name).join(', ')
    : 'Unknown'

  const semesterText = courseData.semester === '1' ? 'Fall' : 'Spring'
  const timeInfo = `${courseData.school_year} ${semesterText}`

  return {
    id: courseData.id,
    title: courseData.name_zh,
    instructor: professors,
    time: timeInfo,
    professors: courseData.professors,
    classrooms: courseData.classrooms,
    school_year: courseData.school_year,
    semester: courseData.semester,
    college_name: courseData.college_name,
    participant_count: courseData.participant_count
  }
}

const getStatusClass = (status?: number): string => {
  switch (status) {
    case 0: return 'status-ended'
    case 1: return 'status-live'
    case 2: return 'status-upcoming'
    default: return 'status-unknown'
  }
}

const getStatusText = (status?: number): string => {
  switch (status) {
    case 0: return 'Ended'
    case 1: return 'Live'
    case 2: return 'Upcoming'
    default: return 'Unknown'
  }
}

const selectCourse = (course: Course) => {
  if (props.mode === 'live') {
    // Store complete stream data for playback
    const streamData: LiveStream = {
      id: course.id,
      title: course.title,
      subtitle: course.subtitle,
      status: course.status || 0,
      schedule_started_at: course.schedule_started_at || '',
      schedule_ended_at: course.schedule_ended_at || '',
      participant_count: course.participant_count,
      session: course.session,
      target: course.target,
      target_vga: course.target_vga
    };

    // Store data in localStorage for the playback page
    DataStore.setStreamData(course.id, streamData);
  }

  // Emit the course selection event
  emit('courseSelected', course)
}

const goToPage = async (page: number) => {
  if (page >= 1 && page <= totalPages.value && page !== currentPage.value) {
    currentPage.value = page

    // Re-fetch data for the new page
    if (searchQuery.value.trim() || (props.mode === 'recorded' && selectedSemesters.value.length > 0)) {
      await searchCourses()
    } else {
      await fetchPersonalCourses()
    }
  }
}

// Record mode specific functions
const loadAvailableSemesters = async () => {
  try {
    const semesters = await apiClient.getAvailableSemesters()
    availableSemesters.value = semesters
  } catch (error) {
    console.error('Failed to load available semesters:', error)
  }
}

const toggleSemesterDropdown = () => {
  showSemesterDropdown.value = !showSemesterDropdown.value
}

const updateSemesterDropdownText = () => {
  if (selectedSemesters.value.length === 0) {
    semesterDropdownText.value = 'All Semesters'
  } else if (selectedSemesters.value.length === 1) {
    const semester = availableSemesters.value.find(s => s.id === selectedSemesters.value[0])
    semesterDropdownText.value = semester ? semester.labelEn : `${selectedSemesters.value.length} selected`
  } else {
    semesterDropdownText.value = `${selectedSemesters.value.length} semesters selected`
  }
}

// Close dropdown when clicking outside
const handleClickOutside = (event: Event) => {
  const target = event.target as HTMLElement
  if (!target.closest('.semester-selector')) {
    showSemesterDropdown.value = false
  }
}

onMounted(async () => {
  if (props.mode === 'recorded') {
    await loadAvailableSemesters()
    document.addEventListener('click', handleClickOutside)
  }

  // Load initial data
  await fetchPersonalCourses()
})

onUnmounted(() => {
  if (props.mode === 'recorded') {
    document.removeEventListener('click', handleClickOutside)
  }
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
  align-items: center;
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
  min-height: 0; /* Important for flex child to shrink */
}

.error-message {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  margin-bottom: 16px;
  background-color: #fee;
  border: 1px solid #fcc;
  border-radius: 4px;
  color: #c33;
  font-size: 14px;
  flex-shrink: 0;
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
  min-height: 0; /* Important for scrolling */
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
  height: 140px; /* Fixed height for consistent layout */
  position: relative;
  overflow: hidden;
}

.course-card:hover {
  border-color: #007acc;
  box-shadow: 0 2px 8px rgba(0, 122, 204, 0.1);
}

.course-status {
  position: absolute;
  top: 8px;
  right: 8px;
  padding: 2px 6px;
  border-radius: 3px;
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
}

.status-ended {
  background-color: #f5f5f5;
  color: #666;
}

.status-live {
  background-color: #e8f5e8;
  color: #2d8f2d;
}

.status-upcoming {
  background-color: #fff3cd;
  color: #856404;
}

.status-unknown {
  background-color: #f8f9fa;
  color: #6c757d;
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
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.course-instructor {
  margin: 0 0 3px 0;
  font-size: 10px;
  color: #666;
  font-weight: 500;
}

.course-location {
  margin: 0 0 3px 0;
  font-size: 10px;
  color: #888;
}

.course-time {
  margin: 0 0 3px 0;
  font-size: 10px;
  color: #999;
}

.course-section {
  margin: 0 0 3px 0;
  font-size: 9px;
  color: #aaa;
}

.course-participants {
  margin: 0;
  font-size: 9px;
  color: #007acc;
  font-weight: 500;
}

.pagination {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 16px;
  margin-top: 16px;
  padding: 16px 0;
  border-top: 1px solid #e0e0e0;
  flex-shrink: 0; /* Prevent pagination from shrinking */
  background-color: white; /* Ensure visibility */
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

/* Semester selector styles */
.semester-selector {
  position: relative;
  display: inline-block;
}

.semester-dropdown-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 12px;
  border: 1px solid #ddd;
  border-radius: 4px;
  background-color: white;
  color: #333;
  font-size: 14px;
  cursor: pointer;
  transition: border-color 0.2s;
  min-width: 140px;
  justify-content: space-between;
}

.semester-dropdown-btn:hover {
  border-color: #007acc;
}

.semester-dropdown {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  z-index: 1000;
  background-color: white;
  border: 1px solid #ddd;
  border-radius: 4px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  max-height: 200px;
  overflow-y: auto;
  margin-top: 2px;
}

.semester-options {
  padding: 8px 0;
}

.semester-option {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px;
  cursor: pointer;
  font-size: 13px;
  transition: background-color 0.2s;
}

.semester-option:hover {
  background-color: #f5f5f5;
}

.semester-option input[type="checkbox"] {
  margin: 0;
  cursor: pointer;
}

.semester-option span {
  flex: 1;
  user-select: none;
}
</style>