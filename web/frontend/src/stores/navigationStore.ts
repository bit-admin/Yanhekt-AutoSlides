import { ref } from "vue";
import type { Course } from "../composables/useCourseList";
import { closePlayback } from "./playbackStore";

// Ported (slimmed) from the desktop app's navigationStore: no workspace
// pages, tabs, or pinned courses in the web shell.
export type NavTarget = "home" | "live" | "recorded" | "search";

export interface CourseOpenRequest {
  mode: "live" | "recorded";
  course: Course;
  requestId: number;
}

// Module-singleton navigation state shared by the left-panel navigator and
// MainContent.
const activeNav = ref<NavTarget>("home");
const courseOpenRequest = ref<CourseOpenRequest | null>(null);

let nextRequestId = 1;

const navigate = (target: NavTarget) => {
  activeNav.value = target;
  // Sidebar navigation always leaves the playback view.
  closePlayback();
};

const requestCourseOpen = (mode: "live" | "recorded", course: Course) => {
  courseOpenRequest.value = { mode, course, requestId: nextRequestId++ };
  activeNav.value = mode;
  closePlayback();
};

export const navigationStore = {
  activeNav,
  courseOpenRequest,
  navigate,
  requestCourseOpen,
};
