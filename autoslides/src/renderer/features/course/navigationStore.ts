import { ref, computed } from 'vue'
import { activateTab, tabStore } from './tabStore'
import type { Course } from './useCourseList'

// Yanhekt browsing pages keep the three-panel layout; Workspace pages (the
// migrated Tools tabs) take the whole window beside the left panel.
export type NavTarget = 'home' | 'live' | 'recorded' | 'search' | 'slides-review' | 'cloud-notes' | 'settings'

// Nav targets that render as full-width Workspace pages (right panel hidden).
// NOTE: 'settings' is deliberately NOT here — like the "AutoSlides" section pages
// (home/live/recorded), it occupies only the main content area and keeps the
// normal three-panel layout (right panel stays visible).
const WORKSPACE_TARGETS = new Set<NavTarget>(['slides-review', 'cloud-notes'])

export interface CourseOpenRequest {
  mode: 'live' | 'recorded'
  course: Course
  requestId: number
}

export interface CloudIndexSearchRequest {
  term: string
  requestId: number
}

// Module-singleton navigation state shared by the left-panel navigator and
// MainContent (same pattern as useAuth's shared refs).
const activeNav = ref<NavTarget>('home')
const livePlaybackActive = ref(false)
const recordedPlaybackActive = ref(false)
// True when the recorded-mode browse state is on the sessions list (vs. the
// course grid). Set by MainContent; read by the title bar so the Info tab chip
// can label itself "Sessions" instead of "Recorded".
const recordedOnSessions = ref(false)
const courseOpenRequest = ref<CourseOpenRequest | null>(null)
// A course name to pre-search in the Cloud Notes page's index mode. Consumed by
// CloudNotesTab (immediate watch), which enters index mode and runs the search.
const cloudIndexSearchRequest = ref<CloudIndexSearchRequest | null>(null)
// When a course is opened directly from a sidebar pinned item, that item takes
// the active highlight instead of the "Recorded" navigator entry. Cleared the
// moment the user navigates anywhere else or opens a course from another surface.
const activePinnedId = ref<string | null>(null)
// Bumps only when the user clicks "Recorded" while a pinned item was the active
// highlight. MainContent watches it to return to the course grid — otherwise the
// content (already in recorded mode) would look unchanged. A normal "Recorded"
// click does NOT bump this, so it preserves the current sessions/grid state.
const recordedGridResetTick = ref(0)

// True when a Workspace page owns the content area: the Info tab is active (no
// playback tab) AND the current nav target is a workspace page. Read by App.vue
// and the title bar to collapse the right panel into a full-width main content.
// Clicking a playback tab flips activeTabId, which turns this off automatically.
const isWorkspacePage = computed(
  () => tabStore.state.activeTabId === null && WORKSPACE_TARGETS.has(activeNav.value)
)

let nextRequestId = 1

const navigate = (target: NavTarget) => {
  const leavingPinned = activePinnedId.value !== null
  activeNav.value = target
  activePinnedId.value = null
  if (target === 'recorded' && leavingPinned) {
    recordedGridResetTick.value++
  }
  // Sidebar navigation always returns to the Info tab (playback lives in tabs).
  activateTab(null)
}

// Open the Settings page (from the user-bar gear button / menu bar). Save and
// Cancel both stay on the page, so there's no return-target to remember.
const openSettings = () => {
  navigate('settings')
}

const requestCourseOpen = (mode: 'live' | 'recorded', course: Course) => {
  courseOpenRequest.value = { mode, course, requestId: nextRequestId++ }
  activeNav.value = mode
  // Default to no pinned highlight; openPinned re-sets it after this returns.
  activePinnedId.value = null
  // Browsing (course grid / sessions list) happens inside the Info tab.
  activateTab(null)
}

// Highlight a specific pinned item (called right after requestCourseOpen by the
// sidebar's openPinned handler).
const setActivePinned = (id: string | null) => {
  activePinnedId.value = id
}

// Jump to the Cloud Notes page's index mode with a course name pre-searched
// (from the sessions header search button).
const requestCloudIndexSearch = (term: string) => {
  cloudIndexSearchRequest.value = { term, requestId: nextRequestId++ }
  navigate('cloud-notes')
}

export const navigationStore = {
  activeNav,
  livePlaybackActive,
  recordedPlaybackActive,
  recordedOnSessions,
  isWorkspacePage,
  courseOpenRequest,
  cloudIndexSearchRequest,
  activePinnedId,
  recordedGridResetTick,
  navigate,
  openSettings,
  requestCourseOpen,
  requestCloudIndexSearch,
  setActivePinned
}
