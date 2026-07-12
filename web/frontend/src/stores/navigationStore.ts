import { ref } from "vue";
import type { Course } from "../composables/useCourseList";
import { closePlayback } from "./playbackStore";
import { configStore, persistConfig } from "./configStore";

// Ported (slimmed) from the desktop app's navigationStore. No workspace pages
// or tabs in the web shell; Settings and pinned courses are supported.
export type NavTarget = "home" | "live" | "recorded" | "search" | "settings";

export interface CourseOpenRequest {
  mode: "live" | "recorded";
  course: Course;
  requestId: number;
}

// Module-singleton navigation state shared by the left-panel navigator and
// MainContent.
const activeNav = ref<NavTarget>("home");
const courseOpenRequest = ref<CourseOpenRequest | null>(null);
// Which pinned course is currently highlighted in the sidebar (pure UI state,
// not persisted). Cleared whenever navigation moves elsewhere.
const activePinned = ref<string | null>(null);

let nextRequestId = 1;

// Mobile-only slide-in drawer for the left panel. Kept separate from the
// desktop collapse pref so it always starts closed on a phone (and resizing
// between layouts never toggles the other one).
const mobileNavOpen = ref(false);

const toggleMobileNav = () => {
  mobileNavOpen.value = !mobileNavOpen.value;
};

const closeMobileNav = () => {
  mobileNavOpen.value = false;
};

const navigate = (target: NavTarget) => {
  activeNav.value = target;
  activePinned.value = null;
  mobileNavOpen.value = false;
  // Sidebar navigation always leaves the playback view.
  closePlayback();
};

const requestCourseOpen = (mode: "live" | "recorded", course: Course) => {
  courseOpenRequest.value = { mode, course, requestId: nextRequestId++ };
  activeNav.value = mode;
  activePinned.value = null;
  mobileNavOpen.value = false;
  closePlayback();
};

const setActivePinned = (id: string | null) => {
  activePinned.value = id;
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
  activePinned,
  isSidebarCollapsed,
  mobileNavOpen,
  navigate,
  requestCourseOpen,
  setActivePinned,
  toggleSidebar,
  toggleMobileNav,
  closeMobileNav,
};
