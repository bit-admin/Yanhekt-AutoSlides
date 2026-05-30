<template>
  <div class="flex h-full flex-col">
    <div class="border-b border-line bg-elevated p-4">
      <div>
        <h2 class="m-0 mb-3 text-lg font-semibold text-fg">{{ mode === 'live' ? $t('courses.title.liveStreams') : $t('courses.title.recordings') }}</h2>
      </div>
      <!-- 'controls-section' retained as a Driver.js tour hook -->
      <div class="controls-section flex flex-col gap-2">
        <div class="flex gap-2">
          <input
            v-model="searchQuery"
            type="text"
            :placeholder="$t('courses.search.placeholder')"
            class="input flex-1"
            @keyup.enter="searchCourses"
          />
          <div v-if="mode === 'recorded'" class="relative">
            <button @click="toggleSemesterDropdown" class="flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded border border-line-input bg-field px-3 py-1.5 text-xs text-fg transition-colors hover:bg-hover">
              <span>{{ semesterDropdownText }}</span>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="6,9 12,15 18,9"/>
              </svg>
            </button>
            <div v-show="showSemesterDropdown" class="absolute right-0 z-dropdown mt-1 max-h-[300px] overflow-y-auto rounded border border-line bg-modal p-2 shadow-[0_4px_12px_rgba(0,0,0,0.15)]">
              <div class="flex flex-col gap-1">
                <label v-for="semester in availableSemesters" :key="semester.id" class="flex cursor-pointer items-center gap-2 whitespace-nowrap text-xs text-fg">
                  <input
                    type="checkbox"
                    class="accent-accent"
                    :value="semester.id"
                    v-model="selectedSemesters"
                    @change="updateSemesterDropdownText"
                  />
                  <span>{{ semester.labelEn }}</span>
                </label>
              </div>
            </div>
          </div>
          <button @click="searchCourses" :class="acctBtn">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="11" cy="11" r="8"/>
              <path d="m21 21-4.35-4.35"/>
            </svg>
            {{ $t('courses.search.button') }}
          </button>
        </div>
        <div class="flex">
          <button @click="fetchPersonalCourses" :class="acctBtn">
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
    <div class="content flex-1 overflow-y-auto p-4">
      <div v-if="errorMessage" class="mb-3 flex items-center gap-2 rounded border border-danger bg-danger/10 px-3 py-2 text-sm text-danger">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10"/>
          <line x1="15" y1="9" x2="9" y2="15"/>
          <line x1="9" y1="9" x2="15" y2="15"/>
        </svg>
        {{ errorMessage }}
      </div>

      <div v-if="showWelcome" class="flex h-full items-center justify-center">
        <div class="w-full max-w-2xl text-center">
          <p class="mb-6 text-xl font-semibold text-fg">{{ greetingText }}</p>
          <div class="mb-6">
            <p class="mb-3 text-sm font-medium text-fg-secondary">{{ $t('courses.savedSearches.sectionTitle') }}</p>
            <div class="grid grid-cols-[repeat(auto-fill,minmax(120px,1fr))] gap-3">
              <div
                v-for="keyword in savedSearches"
                :key="keyword"
                class="group/card relative flex cursor-pointer flex-col items-center gap-2 rounded-lg border border-line bg-surface p-4 transition-all hover:border-accent hover:shadow-md"
                @click="runSavedSearch(keyword)"
              >
                <button
                  class="absolute right-1 top-1 flex h-5 w-5 cursor-pointer items-center justify-center rounded-full border-none bg-transparent text-fg-muted hover:bg-hover hover:text-danger"
                  @click.stop="removeSavedSearch(keyword)"
                  :title="$t('courses.savedSearches.remove')"
                >
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                    <line x1="18" y1="6" x2="6" y2="18"/>
                    <line x1="6" y1="6" x2="18" y2="18"/>
                  </svg>
                </button>
                <div class="flex h-10 w-10 items-center justify-center rounded-full bg-elevated text-fg-secondary">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="11" cy="11" r="8"/>
                    <path d="m21 21-4.35-4.35"/>
                  </svg>
                </div>
                <span class="w-full truncate text-center text-xs text-fg">{{ keyword }}</span>
              </div>
              <div class="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-line bg-surface p-4 transition-all hover:border-accent hover:shadow-md" @click="openAddModal">
                <div class="flex h-10 w-10 items-center justify-center rounded-full bg-elevated text-accent">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <line x1="12" y1="5" x2="12" y2="19"/>
                    <line x1="5" y1="12" x2="19" y2="12"/>
                  </svg>
                </div>
              </div>
            </div>
          </div>
          <p class="text-sm text-fg-muted">{{ $t('courses.welcome.subtitle') }}</p>
        </div>
      </div>

      <div v-if="showAddModal" class="fixed inset-0 z-modal flex items-center justify-center bg-black/50" @click.self="closeAddModal">
        <div class="w-[360px] max-w-[90vw] rounded-lg bg-modal p-5 shadow-[0_8px_32px_rgba(0,0,0,0.2)]">
          <h3 class="m-0 mb-4 text-base font-semibold text-fg">{{ $t('courses.savedSearches.modalTitle') }}</h3>
          <input
            v-model="newKeyword"
            type="text"
            class="input w-full"
            :placeholder="$t('courses.savedSearches.placeholder')"
            @keyup.enter="confirmAddSearch"
            @keyup.esc="closeAddModal"
            ref="modalInputRef"
          />
          <div class="mt-4 flex justify-end gap-2">
            <button class="cursor-pointer rounded border border-line bg-elevated px-4 py-2 text-xs text-fg-secondary transition-colors hover:border-line-strong hover:bg-hover" @click="closeAddModal">{{ $t('courses.savedSearches.cancel') }}</button>
            <button class="cursor-pointer rounded border border-accent bg-accent px-4 py-2 text-xs text-white transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50" @click="confirmAddSearch" :disabled="!newKeyword.trim()">{{ $t('courses.savedSearches.confirm') }}</button>
          </div>
        </div>
      </div>

      <div v-if="isLoading" class="flex flex-col items-center justify-center gap-3 py-16 text-fg-secondary">
        <div class="h-8 w-8 animate-spin rounded-full border-[3px] border-line border-t-accent"></div>
        <p class="m-0 text-sm">{{ $t('courses.loading') }}</p>
      </div>

      <div v-else-if="!errorMessage && !showWelcome" class="grid grid-cols-4 gap-4 max-[1100px]:grid-cols-3 max-[800px]:grid-cols-2">
        <div
          v-for="course in paginatedCourses"
          :key="course.id"
          class="relative cursor-pointer rounded-lg border border-line bg-surface p-4 transition-all hover:border-accent hover:shadow-md"
          @click="selectCourse(course)"
        >
          <div v-if="mode === 'live'" :class="statusBadgeCls(course.status)">
            {{ getStatusText(course.status) }}
          </div>
          <div v-if="mode === 'recorded'" class="absolute right-2 top-2 text-[10px] text-fg-muted">
            #{{ course.id }}
          </div>
          <div>
            <h3 class="m-0 mb-1.5 pr-12 text-sm font-semibold text-fg">{{ course.title }}</h3>
            <p class="m-0 mb-1 text-xs text-fg-secondary">{{ course.instructor }}</p>
            <p class="m-0 mb-1 text-xs text-fg-secondary" v-if="mode === 'live' && course.subtitle">{{ course.subtitle }}</p>
            <p class="m-0 mb-1 text-xs text-fg-secondary" v-if="mode === 'recorded' && course.classrooms">
              {{ course.classrooms.map(c => c.name).join(', ') }}
            </p>
            <p class="m-0 mb-1 text-xs text-fg-muted">{{ course.time }}</p>
            <p class="m-0 mb-1 text-xs text-fg-muted" v-if="mode === 'live' && course.session?.section_group_title">{{ course.session.section_group_title }}</p>
            <p class="m-0 mb-1 text-xs text-fg-muted" v-if="mode === 'recorded' && course.college_name">{{ course.college_name }}</p>
            <p class="m-0 text-xs text-fg-muted" v-if="course.participant_count !== undefined">
              {{ course.participant_count }} {{ $t('courses.info.participants') }}
            </p>
          </div>
        </div>
      </div>

      <div v-if="!isLoading && courses.length > 0 && !showWelcome" class="mt-4 flex items-center justify-center gap-3">
        <button
          :disabled="currentPage === 1"
          @click="goToPage(currentPage - 1)"
          class="flex h-8 w-8 cursor-pointer items-center justify-center rounded border border-line bg-surface text-fg transition-colors enabled:hover:border-accent enabled:hover:text-accent disabled:cursor-not-allowed disabled:opacity-40"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="15,18 9,12 15,6"/>
          </svg>
        </button>
        <span class="text-xs text-fg-secondary">{{ currentPage }} / {{ totalPages }}</span>
        <button
          :disabled="currentPage === totalPages"
          @click="goToPage(currentPage + 1)"
          class="flex h-8 w-8 cursor-pointer items-center justify-center rounded border border-line bg-surface text-fg transition-colors enabled:hover:border-accent enabled:hover:text-accent disabled:cursor-not-allowed disabled:opacity-40"
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

// ---- Tailwind class-string helpers ----
const acctBtn = 'flex items-center gap-1.5 rounded border-none bg-accent px-4 py-1.5 text-sm text-white cursor-pointer transition-colors hover:bg-accent-hover'
const statusBadgeBase = 'absolute right-2 top-2 rounded px-2 py-0.5 text-[10px] font-semibold'
const statusBadgeCls = (status?: number) => {
  const v = status === 1 ? 'bg-[#28a745] text-white'
    : status === 2 ? 'bg-[#ffc107] text-[#212529]'
    : 'bg-[#6c757d] text-white'
  return `${statusBadgeBase} ${v}`
}

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

