import { ref } from "vue";
import type { Course } from "../composables/useCourseList";
import { closePlayback } from "./playbackStore";
import { configStore, persistConfig } from "./configStore";

// Ported (slimmed) from the desktop app's navigationStore. No workspace pages
// or tabs in the web shell; Settings and pinned courses are supported.
export type NavTarget = "home" | "live" | "recorded" | "search" | "slides" | "settings";

export interface CourseOpenRequest {
  mode: "live" | "recorded";
  course: Course;
  requestId: number;
}

// Module-singleton navigation state shared by the left-panel navigator and
// MainContent.
const activeNav = ref<NavTarget>("home");
const courseOpenRequest = ref<CourseOpenRequest | null>(null);
// Which subscribed course is currently highlighted in the sidebar (pure UI state,
// not persisted). Cleared whenever navigation moves elsewhere.
const activeSubscribed = ref<string | null>(null);

let nextRequestId = 1;

const navigate = (target: NavTarget) => {
  activeNav.value = target;
  activeSubscribed.value = null;
  // Sidebar navigation always leaves the playback view.
  closePlayback();
};

const requestCourseOpen = (mode: "live" | "recorded", course: Course) => {
  courseOpenRequest.value = { mode, course, requestId: nextRequestId++ };
  activeNav.value = mode;
  activeSubscribed.value = null;
  closePlayback();
};

const setActiveSubscribed = (id: string | null) => {
  activeSubscribed.value = id;
};

// Sidebar collapse state lives in the unified config store (not a separate key).
const isSidebarCollapsed = ref(configStore.sidebarCollapsed);

const toggleSidebar = () => {
  isSidebarCollapsed.value = !isSidebarCollapsed.value;
  configStore.sidebarCollapsed = isSidebarCollapsed.value;
  persistConfig();
};

export const navigationStore = {
  activeNav,
  courseOpenRequest,
  activeSubscribed,
  isSidebarCollapsed,
  navigate,
  requestCourseOpen,
  setActiveSubscribed,
  toggleSidebar,
};
