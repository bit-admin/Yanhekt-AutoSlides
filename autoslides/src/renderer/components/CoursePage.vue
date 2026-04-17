<template>
  <div class="course-page">
    <div class="header">
      <div class="title-section">
        <h2>{{ mode === 'live' ? $t('courses.title.liveStreams') : $t('courses.title.recordings') }}</h2>
      </div>
      <div class="controls-section">
        <div class="search-row">
          <input
            v-model="searchQuery"
            type="text"
            :placeholder="$t('courses.search.placeholder')"
            class="search-input"
            @keyup.enter="searchCourses"
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
            {{ $t('courses.search.button') }}
          </button>
        </div>
        <div class="fetch-row">
          <button @click="fetchPersonalCourses" class="fetch-btn">
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
      <div v-if="errorMessage" class="error-message">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10"/>
          <line x1="15" y1="9" x2="9" y2="15"/>
          <line x1="9" y1="9" x2="15" y2="15"/>
        </svg>
        {{ errorMessage }}
      </div>

      <div v-if="showWelcome" class="welcome-page">
        <div class="welcome-content">
          <p class="greeting-line">{{ greetingText }}</p>
          <div class="saved-courses-section">
            <p class="saved-courses-title">{{ $t('courses.savedSearches.sectionTitle') }}</p>
            <div class="saved-courses-grid">
              <div
                v-for="keyword in savedSearches"
                :key="keyword"
                class="course-shortcut-card"
                @click="runSavedSearch(keyword)"
              >
                <button
                  class="shortcut-remove"
                  @click.stop="removeSavedSearch(keyword)"
                  :title="$t('courses.savedSearches.remove')"
                >
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                    <line x1="18" y1="6" x2="6" y2="18"/>
                    <line x1="6" y1="6" x2="18" y2="18"/>
                  </svg>
                </button>
                <div class="shortcut-icon">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="11" cy="11" r="8"/>
                    <path d="m21 21-4.35-4.35"/>
                  </svg>
                </div>
                <span class="shortcut-label">{{ keyword }}</span>
              </div>
              <div class="course-shortcut-card course-shortcut-add" @click="openAddModal">
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

      <div v-if="showAddModal" class="modal-overlay" @click.self="closeAddModal">
        <div class="modal-box">
          <h3 class="modal-title">{{ $t('courses.savedSearches.modalTitle') }}</h3>
          <input
            v-model="newKeyword"
            type="text"
            class="modal-input"
            :placeholder="$t('courses.savedSearches.placeholder')"
            @keyup.enter="confirmAddSearch"
            @keyup.esc="closeAddModal"
            ref="modalInputRef"
          />
          <div class="modal-actions">
            <button class="modal-btn modal-cancel" @click="closeAddModal">{{ $t('courses.savedSearches.cancel') }}</button>
            <button class="modal-btn modal-confirm" @click="confirmAddSearch" :disabled="!newKeyword.trim()">{{ $t('courses.savedSearches.confirm') }}</button>
          </div>
        </div>
      </div>

      <div v-if="isLoading" class="loading-state">
        <div class="spinner"></div>
        <p>{{ $t('courses.loading') }}</p>
      </div>

      <div v-else-if="!errorMessage && !showWelcome" class="courses-grid">
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
              {{ course.participant_count }} {{ $t('courses.info.participants') }}
            </p>
          </div>
        </div>
      </div>

      <div v-if="!isLoading && courses.length > 0 && !showWelcome" class="pagination">
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
import { toRef, ref, onMounted, onUnmounted, nextTick, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useCourseList, type Course } from '../composables/useCourseList'
import { useGreeting } from '../composables/useGreeting'

const props = defineProps<{
  mode: 'live' | 'recorded'
}>()

const emit = defineEmits<{
  courseSelected: [course: Course]
}>()

const { t, locale } = useI18n()

const { greetingText, loadGreeting } = useGreeting()

const showAddModal = ref(false)
const newKeyword = ref('')
const modalInputRef = ref<HTMLInputElement | null>(null)

const openAddModal = () => {
  newKeyword.value = ''
  showAddModal.value = true
  nextTick(() => modalInputRef.value?.focus())
}
const closeAddModal = () => {
  showAddModal.value = false
}
const confirmAddSearch = () => {
  if (newKeyword.value.trim()) {
    addSavedSearch(newKeyword.value)
  }
  closeAddModal()
}

const {
  // State
  searchQuery,
  isLoading,
  courses,
  currentPage,
  totalPages,
  errorMessage,
  showWelcome,

  // Semester state
  availableSemesters,
  selectedSemesters,
  showSemesterDropdown,
  semesterDropdownText,

  // Computed
  paginatedCourses,

  // Methods
  searchCourses,
  fetchPersonalCourses,
  goToPage,
  selectCourse,
  getStatusClass,
  getStatusText,

  // Semester methods
  loadAvailableSemesters,
  toggleSemesterDropdown,
  updateSemesterDropdownText,
  handleClickOutside,

  // State management
  resetPageState,
  initSemesterDropdownText,

  // Saved searches
  savedSearches,
  loadSavedSearches,
  addSavedSearch,
  removeSavedSearch,
  runSavedSearch
} = useCourseList({
  mode: toRef(props, 'mode'),
  t,
  onCourseSelected: (course) => emit('courseSelected', course)
})

// Watch for mode changes and reset state
watch(() => props.mode, async () => {
  resetPageState()
  if (props.mode === 'recorded') {
    await loadAvailableSemesters()
  }
})

// Watch for language changes and update semester dropdown text
watch(() => locale.value, () => {
  initSemesterDropdownText()
})

onMounted(async () => {
  initSemesterDropdownText()
  loadGreeting()
  loadSavedSearches()

  if (props.mode === 'recorded') {
    await loadAvailableSemesters()
    document.addEventListener('click', handleClickOutside)
  }

  showWelcome.value = true
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
  padding-right: 8px; /* Space for scrollbar */
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

.pagination {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 16px;
  margin-top: 12px;
  padding: 12px 0;
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

.shortcut-remove {
  position: absolute;
  top: 4px;
  right: 4px;
  display: none;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  border: none;
  background: rgba(0, 0, 0, 0.15);
  border-radius: 50%;
  padding: 0;
  color: #555;
  cursor: pointer;
  transition: background 0.15s;
}

.course-shortcut-card:hover .shortcut-remove {
  display: flex;
}

.shortcut-remove:hover {
  background: rgba(239, 68, 68, 0.8);
  color: white;
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

.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.35);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-box {
  background: white;
  border-radius: 12px;
  padding: 24px;
  width: 320px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.modal-title {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: #1f2937;
}

.modal-input {
  padding: 8px 12px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-size: 14px;
  outline: none;
  transition: border-color 0.2s;
}

.modal-input:focus {
  border-color: #3b82f6;
}

.modal-actions {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
}

.modal-btn {
  padding: 7px 16px;
  border-radius: 6px;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s;
  border: 1px solid transparent;
}

.modal-cancel {
  background: #f3f4f6;
  color: #374151;
  border-color: #e5e7eb;
}

.modal-cancel:hover {
  background: #e5e7eb;
}

.modal-confirm {
  background: #3b82f6;
  color: white;
}

.modal-confirm:hover:not(:disabled) {
  background: #2563eb;
}

.modal-confirm:disabled {
  opacity: 0.5;
  cursor: not-allowed;
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

/* Custom scrollbar styles - macOS style thin scrollbars that auto-hide */
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

/* Dark mode support */
@media (prefers-color-scheme: dark) {
  .course-page {
    background-color: #2d2d2d;
    color: #e0e0e0;
  }

  .header {
    background: linear-gradient(135deg, #2d2d2d 0%, #1f1f1f 100%);
    border: 1px solid rgba(255, 255, 255, 0.1);
    box-shadow: 0 2px 12px rgba(0, 0, 0, 0.3);
  }

  .title-section h2 {
    color: #e0e0e0;
    background: linear-gradient(135deg, #4da6ff 0%, #0080ff 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
    text-shadow: 0 2px 4px rgba(77, 166, 255, 0.2);
  }

  .search-input {
    background-color: #2d2d2d;
    border: 1px solid #404040;
    color: #e0e0e0;
  }

  .search-input::placeholder {
    color: #888;
  }

  .search-input:focus {
    border-color: #4da6ff;
    outline: none;
  }

  .search-btn, .fetch-btn {
    background-color: #2563eb;
    border: 1px solid #2563eb;
    color: #ffffff;
  }

  .search-btn:hover, .fetch-btn:hover {
    background-color: #1d4ed8;
    border-color: #1d4ed8;
  }

  .error-message {
    background-color: #3d1a1a;
    border: 1px solid #5d2d2d;
    color: #ff6b6b;
  }

  .spinner {
    border: 3px solid #404040;
    border-top: 3px solid #4da6ff;
  }

  .course-card {
    background-color: #2d2d2d;
    border: 1px solid #404040;
    color: #e0e0e0;
  }

  .course-card:hover {
    border-color: #4da6ff;
    box-shadow: 0 2px 8px rgba(77, 166, 255, 0.2);
  }

  .course-title {
    color: #e0e0e0;
  }

  .course-instructor {
    color: #b0b0b0;
  }

  .course-location {
    color: #999;
  }

  .course-time {
    color: #888;
  }

  .course-section {
    color: #777;
  }

  .course-participants {
    color: #4da6ff;
  }

  .status-ended {
    background-color: #404040;
    color: #b0b0b0;
  }

  .status-live {
    background-color: #1a3d1a;
    color: #66cc66;
  }

  .status-upcoming {
    background-color: #3d3d1a;
    color: #cccc66;
  }

  .status-unknown {
    background-color: #333;
    color: #999;
  }

  .course-id {
    background-color: #404040;
    color: #b0b0b0;
  }

  .pagination {
    border-top: 1px solid #404040;
    background-color: #2d2d2d;
  }

  .page-btn {
    background-color: #2d2d2d;
    border: 1px solid #404040;
    color: #e0e0e0;
  }

  .page-btn:hover:not(:disabled) {
    border-color: #4da6ff;
    background-color: #333;
  }

  .page-info {
    color: #b0b0b0;
  }

  .semester-dropdown-btn {
    background-color: #2d2d2d;
    border: 1px solid #404040;
    color: #e0e0e0;
  }

  .semester-dropdown-btn:hover {
    border-color: #4da6ff;
  }

  .semester-dropdown {
    background-color: #2d2d2d;
    border: 1px solid #404040;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.4);
  }

  .semester-option:hover {
    background-color: #404040;
  }

  .greeting-line {
    color: #e0e0e0;
  }

  .saved-courses-section {
    background: linear-gradient(#2d2d2d, #2d2d2d) padding-box,
                linear-gradient(to right, transparent, rgba(255,255,255,0.10), transparent) border-box;
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 12px;
  }

  .saved-courses-title {
    color: #6b7280;
  }

  .welcome-subtitle {
    color: #6b7280;
  }

  .course-shortcut-card {
    background: #2d2d2d;
    border-color: #404040;
  }

  .course-shortcut-card:hover {
    border-color: #4da6ff;
    background: #1e2a4a;
    box-shadow: 0 2px 8px rgba(77, 166, 255, 0.2);
  }

  .shortcut-label {
    color: #e0e0e0;
  }

  .shortcut-icon {
    color: #4da6ff;
  }

  .shortcut-remove {
    background: rgba(255, 255, 255, 0.15);
    color: #ccc;
  }

  .shortcut-remove:hover {
    background: rgba(239, 68, 68, 0.8);
    color: white;
  }

  .course-shortcut-add {
    background: #222;
    border-color: #404040;
  }

  .course-shortcut-add:hover {
    border-color: #4da6ff;
    background: #1e2a4a;
  }

  .shortcut-add-icon {
    color: #555;
  }

  .course-shortcut-add:hover .shortcut-add-icon {
    color: #4da6ff;
  }

  .modal-box {
    background: #2d2d2d;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
  }

  .modal-title {
    color: #e0e0e0;
  }

  .modal-input {
    background: #1f1f1f;
    border-color: #404040;
    color: #e0e0e0;
  }

  .modal-input:focus {
    border-color: #4da6ff;
  }

  .modal-cancel {
    background: #404040;
    color: #e0e0e0;
    border-color: #555;
  }

  .modal-cancel:hover {
    background: #505050;
  }

  /* Scrollbar styles for dark mode */
  .courses-grid {
    scrollbar-color: transparent transparent;
  }

  .courses-grid:hover {
    scrollbar-color: rgba(255, 255, 255, 0.2) transparent;
  }

  .courses-grid::-webkit-scrollbar-track {
    background: transparent;
  }

  .courses-grid::-webkit-scrollbar-thumb {
    background: transparent;
  }

  .courses-grid:hover::-webkit-scrollbar-thumb {
    background: rgba(255, 255, 255, 0.2);
  }

  .courses-grid::-webkit-scrollbar-thumb:hover {
    background: rgba(255, 255, 255, 0.3) !important;
  }
}

</style>