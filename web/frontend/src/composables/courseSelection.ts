import type { Course } from "./useCourseList";
import { router } from "../router";
import { stashCourse } from "../stores/courseTransfer";

// Single entry point for opening a course from any surface (course grid,
// Home rows, Search results) — ported from the desktop app's courseSelection.
// Live opens the playback route directly; recorded goes to the sessions list.
// The course object is stashed so the target route renders without refetching.
export function openCourse(mode: "live" | "recorded", course: Course) {
  stashCourse(course);
  if (mode === "live") {
    void router.push({ name: "player-live", params: { courseId: course.id } });
  } else {
    void router.push({ name: "recorded-course", params: { courseId: course.id } });
  }
}
