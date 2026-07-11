import type { Course } from "./useCourseList";
import { navigationStore } from "../stores/navigationStore";
import { openPlayback } from "../stores/playbackStore";

// Single entry point for opening a course from any surface (course grid,
// Home rows, Search results) — ported from the desktop app's courseSelection.
// Live opens the playback view directly; recorded goes to the sessions list.
export function openCourse(mode: "live" | "recorded", course: Course) {
  if (mode === "live") {
    navigationStore.activeNav.value = "live";
    openPlayback({ mode: "live", course, session: null });
    return;
  }

  navigationStore.requestCourseOpen("recorded", course);
}
