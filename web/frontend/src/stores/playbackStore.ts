import { ref } from "vue";
import type { Course } from "../composables/useCourseList";
import type { SessionData } from "../lib/api";

// Single playback view (the web shell has no tab strip): at most one active
// playback at a time, overlaying the browsing surfaces.
export interface ActivePlayback {
  mode: "live" | "recorded";
  course: Course;
  session: SessionData | null;
}

const active = ref<ActivePlayback | null>(null);

// Cinema mode hides the sidebar so the player fills the window (the desktop
// app collapses its side panels via layoutStore; the web shell reads this
// flag in App.vue).
const cinema = ref(false);

export const openPlayback = (playback: ActivePlayback) => {
  active.value = playback;
};

export const closePlayback = () => {
  active.value = null;
  cinema.value = false;
};

export const playbackStore = { active, cinema };
