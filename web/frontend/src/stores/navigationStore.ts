import { computed, ref } from "vue";
import { router } from "../router";
import { configStore, persistConfig } from "./configStore";

// Thin façade over vue-router so nav consumers (LeftPanel, Header, mobile
// bottom nav, page refresh watchers) keep their existing read/call surface.
// The route is the source of truth; nothing here holds navigation state.
export type NavTarget = "home" | "live" | "recorded" | "search" | "slides" | "settings";

// Which nav entry the current route belongs to (player routes highlight their
// mode, matching the pre-router behavior).
const activeNav = computed<NavTarget>(
  () => (router.currentRoute.value.meta.nav as NavTarget | undefined) ?? "home",
);

// Which subscribed course is highlighted in the sidebar: the course open in
// the recorded sessions/player route, if any.
const activeSubscribed = computed<string | null>(() => {
  const route = router.currentRoute.value;
  const courseId = route.params.courseId;
  return route.meta.nav === "recorded" && typeof courseId === "string" ? courseId : null;
});

const navigate = (target: NavTarget) => {
  void router.push({ name: target });
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
  activeSubscribed,
  isSidebarCollapsed,
  navigate,
  toggleSidebar,
};
