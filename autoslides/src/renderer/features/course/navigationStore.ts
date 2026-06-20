import { ref } from 'vue'
import { activateTab } from './tabStore'
import type { Course } from './useCourseList'

export type NavTarget = 'home' | 'live' | 'recorded' | 'search'

export interface CourseOpenRequest {
  mode: 'live' | 'recorded'
  course: Course
  requestId: number
}

// Module-singleton navigation state shared by the left-panel navigator and
// MainContent (same pattern as useAuth's shared refs).
const activeNav = ref<NavTarget>('home')
const livePlaybackActive = ref(false)
const recordedPlaybackActive = ref(false)
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
  livePlaybackActive,
  recordedPlaybackActive,
  courseOpenRequest,
  activePinnedId,
  recordedGridResetTick,
  navigate,
  requestCourseOpen,
  setActivePinned
}
