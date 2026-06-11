import { ref } from 'vue'
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

let nextRequestId = 1

const navigate = (target: NavTarget) => {
  activeNav.value = target
}

const requestCourseOpen = (mode: 'live' | 'recorded', course: Course) => {
  courseOpenRequest.value = { mode, course, requestId: nextRequestId++ }
  activeNav.value = mode
}

export const navigationStore = {
  activeNav,
  livePlaybackActive,
  recordedPlaybackActive,
  courseOpenRequest,
  navigate,
  requestCourseOpen
}
