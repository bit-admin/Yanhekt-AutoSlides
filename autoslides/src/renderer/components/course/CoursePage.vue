<template>
  <div class="flex h-full flex-col p-4">
    <div class="mb-4 flex items-start justify-between gap-6 rounded-lg border border-accent/10 bg-gradient-to-br from-white to-bg-elevated px-6 py-2.5 shadow-[0_2px_12px_rgba(0,0,0,0.08)] dark:from-bg-surface dark:to-[var(--text-primary)]">
      <div class="title-section">
        <h2 class="gradient-title m-0 ml-6 mt-6 text-[28px] font-bold">{{ mode === 'live' ? $t('courses.title.liveStreams') : $t('courses.title.recordings') }}</h2>
      </div>
      <!-- 'controls-section' retained as a Driver.js tour hook -->
      <div class="controls-section flex min-w-[300px] flex-col gap-3">
        <div class="flex items-center gap-2">
          <input
            v-model="searchQuery"
            type="text"
            :placeholder="$t('courses.search.placeholder')"
            class="flex-1 rounded border border-border-input bg-elevated px-3 py-2 text-sm placeholder:text-text-muted focus:border-accent focus:outline-none dark:bg-input dark:placeholder:text-text-muted"
            @keyup.enter="searchCourses"
          />
          <div v-if="mode === 'recorded'" class="semester-selector relative inline-block">
            <button @click="toggleSemesterDropdown" class="semester-dropdown-btn flex min-w-[140px] items-center justify-between gap-1.5 rounded border border-border-input bg-surface px-3 py-2 text-sm text-text transition-colors hover:border-accent dark:bg-input dark:text-text">
              <span>{{ semesterDropdownText }}</span>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="6,9 12,15 18,9"/>
              </svg>
            </button>
            <div v-show="showSemesterDropdown" class="semester-dropdown absolute left-0 right-0 z-[1000] mt-0.5 max-h-[200px] overflow-y-auto rounded border border-border-input bg-surface shadow-[0_2px_8px_rgba(0,0,0,0.1)] dark:bg-modal dark:shadow-[0_2px_8px_rgba(0,0,0,0.4)]">
              <div class="px-0 py-2">
                <label v-for="semester in availableSemesters" :key="semester.id" class="semester-option flex cursor-pointer items-center gap-2 px-3 py-1.5 text-[13px] transition-colors hover:bg-hover">
                  <input
                    type="checkbox"
                    :value="semester.id"
                    v-model="selectedSemesters"
                    @change="updateSemesterDropdownText"
                    class="m-0 cursor-pointer"
                  />
                  <span class="flex-1 select-none">{{ semester.labelEn }}</span>
                </label>
              </div>
            </div>
          </div>
          <button @click="searchCourses" class="flex items-center gap-1.5 rounded border border-accent bg-accent px-4 py-2 text-sm text-white transition-colors hover:bg-accent-strong">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="11" cy="11" r="8"/>
              <path d="m21 21-4.35-4.35"/>
            </svg>
            {{ $t('courses.search.button') }}
          </button>
        </div>
        <div class="flex items-center gap-2">
          <button @click="fetchPersonalCourses" class="flex w-full items-center justify-center gap-1.5 rounded border border-accent bg-accent px-4 py-2 text-sm text-white transition-colors hover:bg-accent-strong">
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
      <div v-if="errorMessage" class="mb-4 flex shrink-0 items-center gap-2 rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600 dark:border-red-900 dark:bg-red-950/50 dark:text-red-400">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10"/>
          <line x1="15" y1="9" x2="9" y2="15"/>
          <line x1="9" y1="9" x2="15" y2="15"/>
        </svg>
        {{ errorMessage }}
      </div>

      <div v-if="showWelcome" class="flex flex-1 items-start justify-center px-6 pb-12 pt-[20%]">
        <div class="text-center">
          <p class="m-0 text-[28px] font-medium tracking-[-0.3px] text-text-text dark:text-text">{{ greetingText }}</p>
          <div class="saved-courses-section mx-auto mt-12 w-[640px] max-w-[calc(100%-32px)] rounded-xl border border-black/10 px-6 pb-5 pt-4 dark:border-white/10">
            <p class="m-0 mb-3.5 text-center text-[11px] font-semibold uppercase tracking-[0.06em] text-text-text-muted">{{ $t('courses.savedSearches.sectionTitle') }}</p>
            <div class="flex max-w-[700px] flex-wrap justify-center gap-3">
              <div
                v-for="keyword in savedSearches"
                :key="keyword"
                class="group relative flex h-16 w-[88px] cursor-pointer flex-col items-center justify-center gap-1.5 overflow-hidden rounded-[10px] border border-border-border bg-white px-2 py-1.5 transition-all hover:border-[#93c5fd] hover:bg-bg-accent/5 hover:shadow-[0_2px_8px_rgba(59,130,246,0.15)] dark:border-[var(--bg-hover)] dark:bg-bg-surface dark:hover:border-accent dark:hover:bg-[#1e2a4a] dark:hover:shadow-[0_2px_8px_rgba(77,166,255,0.2)]"
                @click="runSavedSearch(keyword)"
              >
                <button
                  class="absolute right-1 top-1 hidden h-4 w-4 items-center justify-center rounded-full border-none bg-black/15 p-0 text-text-secondary transition-colors hover:bg-red-500/80 hover:text-white group-hover:flex dark:bg-white/15 dark:text-[var(--border-strong)] dark:hover:bg-red-500/80 dark:hover:text-white"
                  @click.stop="removeSavedSearch(keyword)"
                  :title="$t('courses.savedSearches.remove')"
                >
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                    <line x1="18" y1="6" x2="6" y2="18"/>
                    <line x1="6" y1="6" x2="18" y2="18"/>
                  </svg>
                </button>
                <div class="shrink-0 text-bg-accent dark:text-accent">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="11" cy="11" r="8"/>
                    <path d="m21 21-4.35-4.35"/>
                  </svg>
                </div>
                <span class="max-w-20 truncate text-[11px] leading-tight text-text-text dark:text-text">{{ keyword }}</span>
              </div>
              <div class="relative flex h-16 w-[88px] cursor-pointer flex-col items-center justify-center gap-1.5 overflow-hidden rounded-[10px] border border-dashed border-border-border-strong bg-bg-page px-2 py-1.5 transition-all hover:border-[#60a5fa] hover:bg-bg-accent/5 dark:border-[var(--bg-hover)] dark:bg-[var(--text-primary)] dark:hover:border-accent dark:hover:bg-[#1e2a4a]" @click="openAddModal">
                <div class="shrink-0 text-text-text-muted transition-colors hover:text-bg-accent dark:text-text-secondary dark:hover:text-accent">
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

      <div v-if="showAddModal" class="fixed inset-0 z-[1000] flex items-center justify-center bg-black/35" @click.self="closeAddModal">
        <div class="flex w-80 flex-col gap-4 rounded-xl bg-modal p-6 shadow-[0_8px_32px_rgba(0,0,0,0.2)]">
          <h3 class="m-0 text-base font-semibold text-text">{{ $t('courses.savedSearches.modalTitle') }}</h3>
          <input
            v-model="newKeyword"
            type="text"
            class="rounded-lg border border-[#d1d5db] bg-input px-3 py-2 text-sm text-text outline-none transition-colors focus:border-bg-accent dark:border-border-input"
            :placeholder="$t('courses.savedSearches.placeholder')"
            @keyup.enter="confirmAddSearch"
            @keyup.esc="closeAddModal"
            ref="modalInputRef"
          />
          <div class="flex justify-end gap-2">
            <button class="rounded-lg border border-[#e5e7eb] bg-[#f3f4f6] px-4 py-[7px] text-sm text-text transition-all hover:bg-hover dark:border-border-input dark:bg-hover dark:hover:bg-border-input" @click="closeAddModal">{{ $t('courses.savedSearches.cancel') }}</button>
            <button class="rounded-lg border border-transparent bg-bg-accent px-4 py-[7px] text-sm text-white transition-all hover:bg-text-accent disabled:cursor-not-allowed disabled:opacity-50" @click="confirmAddSearch" :disabled="!newKeyword.trim()">{{ $t('courses.savedSearches.confirm') }}</button>
          </div>
        </div>
      </div>

      <div v-if="isLoading" class="flex flex-1 flex-col items-center justify-center gap-4">
        <div class="spinner h-8 w-8 animate-spin rounded-full border-[3px] border-[var(--bg-elevated)] border-t-accent dark:border-border-input"></div>
        <p>{{ $t('courses.loading') }}</p>
      </div>

      <div v-else-if="!errorMessage && !showWelcome" class="courses-grid grid min-h-0 flex-1 grid-cols-4 gap-3 overflow-y-auto pb-4 pr-2 max-[1200px]:grid-cols-3 max-[900px]:grid-cols-2 max-[600px]:grid-cols-1">
        <div
          v-for="course in paginatedCourses"
          :key="course.id"
          class="relative flex h-[140px] cursor-pointer flex-col overflow-hidden rounded-md border border-border bg-surface p-2.5 transition-all hover:border-accent hover:shadow-[0_2px_8px_rgba(0,122,204,0.1)] dark:hover:shadow-[0_2px_8px_rgba(77,166,255,0.2)]"
          @click="selectCourse(course)"
        >
          <div v-if="mode === 'live'" class="course-status absolute right-2 top-2 rounded-[3px] px-1.5 py-0.5 text-[10px] font-semibold uppercase" :class="getStatusClass(course.status)">
            {{ getStatusText(course.status) }}
          </div>
          <div v-if="mode === 'recorded'" class="course-id absolute right-2 top-2 rounded-[3px] bg-bg-page px-1.5 py-0.5 text-[10px] font-semibold text-text-secondary dark:bg-hover dark:text-text-secondary">
            #{{ course.id }}
          </div>
          <div class="flex flex-1 flex-col justify-between pt-[18px] text-left">
            <h3 class="m-0 mb-1 line-clamp-2 text-xs font-semibold leading-tight text-text">{{ course.title }}</h3>
            <p class="m-0 mb-[3px] truncate text-[10px] font-medium text-text-secondary">{{ course.instructor }}</p>
            <p class="m-0 mb-[3px] truncate text-[10px] text-text-muted" v-if="mode === 'live' && course.subtitle">{{ course.subtitle }}</p>
            <p class="m-0 mb-[3px] truncate text-[10px] text-text-muted" v-if="mode === 'recorded' && course.classrooms">
              {{ course.classrooms.map(c => c.name).join(', ') }}
            </p>
            <p class="m-0 mb-[3px] truncate text-[10px] text-text-muted">{{ course.time }}</p>
            <p class="m-0 mb-[3px] truncate text-[9px] text-text-muted/70" v-if="mode === 'live' && course.session?.section_group_title">{{ course.session.section_group_title }}</p>
            <p class="m-0 mb-[3px] truncate text-[9px] text-text-muted/70" v-if="mode === 'recorded' && course.college_name">{{ course.college_name }}</p>
            <p class="m-0 truncate text-[9px] font-medium text-accent" v-if="course.participant_count !== undefined">
              {{ course.participant_count }} {{ $t('courses.info.participants') }}
            </p>
          </div>
        </div>
      </div>

      <div v-if="!isLoading && courses.length > 0 && !showWelcome" class="flex shrink-0 items-center justify-center gap-4 border-t border-border bg-surface py-3">
        <button
          :disabled="currentPage === 1"
          @click="goToPage(currentPage - 1)"
          class="flex h-8 w-8 items-center justify-center rounded border border-border-input bg-surface transition-all hover:border-accent hover:bg-elevated disabled:cursor-not-allowed disabled:opacity-50 dark:bg-input dark:hover:bg-hover"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="15,18 9,12 15,6"/>
          </svg>
        </button>
        <span class="min-w-[60px] text-center text-sm text-text-secondary">{{ currentPage }} / {{ totalPages }}</span>
        <button
          :disabled="currentPage === totalPages"
          @click="goToPage(currentPage + 1)"
          class="flex h-8 w-8 items-center justify-center rounded border border-border-input bg-surface transition-all hover:border-accent hover:bg-elevated disabled:cursor-not-allowed disabled:opacity-50 dark:bg-input dark:hover:bg-hover"
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
import { useCourseList, type Course } from '@features/course/useCourseList'
import { useGreeting } from '@features/platform/useGreeting'

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
/* Gradient text for the title — requires background-clip + text-fill-color which need a style rule. */
.gradient-title {
  background: linear-gradient(135deg, var(--accent) 0%, var(--accent-hover) 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

/* Status badges — driven by dynamic :class from getStatusClass() */
.status-live {
  background-color: var(--success-bg);
  color: var(--success);
}
.status-ended {
  background-color: var(--bg-page);
  color: var(--text-secondary);
}
.status-upcoming {
  background-color: var(--warning-bg);
  color: var(--warning);
}
.status-unknown {
  background-color: var(--bg-elevated);
  color: var(--text-muted);
}

/* Spinner — the @keyframes rule cannot be expressed as a utility. */
@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
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
.courses-grid::-webkit-scrollbar-thumb:hover { background: rgba(0, 0, 0, 0.3) !important; }
</style>
