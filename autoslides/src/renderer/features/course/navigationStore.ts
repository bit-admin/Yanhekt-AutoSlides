import { ref, computed } from 'vue'
import { activateTab, tabStore } from './tabStore'
import type { Course } from './useCourseList'

export type NavTarget = 'home' | 'live' | 'recorded' | 'search' | 'yanhe2-calendar' | 'yanhe2-curriculum' | 'slides-review' | 'cloud-notes' | 'lectures' | 'developer' | 'webcapture' | 'yuketang' | 'settings'

// Workspace and Tools use the full width beside the left panel. Settings and
// the browsing pages keep the normal three-panel layout.
const FULL_WIDTH_TARGETS = new Set<NavTarget>(['slides-review', 'cloud-notes', 'lectures', 'developer', 'webcapture', 'yuketang'])

export interface CourseOpenRequest {
  mode: 'live' | 'recorded'
  course: Course
  requestId: number
}

// Module-singleton navigation state shared by the left-panel navigator and
// MainContent (same pattern as useAuth's shared refs).
const activeNav = ref<NavTarget>('home')
// True when the recorded-mode browse state is on the sessions list (vs. the
// course grid). Set by MainContent; read by the title bar so the Info tab chip
// can label itself "Sessions" instead of "Recorded".
const recordedOnSessions = ref(false)
// The same for Yanhe 2.0's Curriculum page (My Courses grid vs. one course's
// sessions). Set by that page.
const yanhe2OnSessions = ref(false)
const courseOpenRequest = ref<CourseOpenRequest | null>(null)
// When a course is opened directly from a sidebar pinned item, that item takes
// the active highlight instead of the "Recorded" navigator entry. Cleared the
// moment the user navigates anywhere else or opens a course from another surface.
const activePinnedId = ref<string | null>(null)
// Bumps only when the user clicks "Recorded" while a pinned item was the active
// highlight. MainContent watches it to return to the course grid — otherwise the
// content (already in recorded mode) would look unchanged. A normal "Recorded"
// click does NOT bump this, so it preserves the current sessions/grid state.
const recordedGridResetTick = ref(0)

// A full-width page only hides the right panel while the Info tab is in front.
// Focusing a playback tab restores the usual layout without changing preferences.
const isFullWidthPage = computed(
  () => tabStore.state.activeTabId === null && FULL_WIDTH_TARGETS.has(activeNav.value)
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

export const navigationStore = {
  activeNav,
  recordedOnSessions,
  yanhe2OnSessions,
  isFullWidthPage,
  courseOpenRequest,
  activePinnedId,
  recordedGridResetTick,
  navigate,
  openSettings,
  requestCourseOpen,
  setActivePinned
}
