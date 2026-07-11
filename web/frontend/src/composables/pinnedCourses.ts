import { computed } from "vue";
import { configStore, persistConfig, type PinnedCourse } from "../stores/configStore";
import { navigationStore } from "../stores/navigationStore";
import { openCourse } from "./courseSelection";
import type { Course } from "./useCourseList";

// Pinned recorded courses. Ported from the desktop app's
// features/course/pinnedCourses.ts. Only recorded courses are pinnable (they
// persist; live streams are transient).

export const pinnedRecordedCourses = computed<PinnedCourse[]>(
  () => configStore.pinnedRecordedCourses,
);

export const isPinned = (id: string): boolean =>
  pinnedRecordedCourses.value.some((c) => c.id === id);

// Rebuild a plain, JSON-safe snapshot before persisting (drops reactive proxies
// and any extra Course fields we don't store).
const toPlain = (course: PinnedCourse | Course): PinnedCourse => ({
  id: course.id,
  title: course.title,
  instructor: course.instructor,
  time: course.time,
  classrooms: course.classrooms?.map((r) => ({ name: r.name })),
  participant_count: course.participant_count,
  college_name: course.college_name,
  professors: course.professors ? [...course.professors] : undefined,
  school_year: course.school_year,
  semester: course.semester,
});

export const togglePinnedCourse = (course: PinnedCourse | Course): void => {
  if (!course.id) return;
  const list = configStore.pinnedRecordedCourses;
  const idx = list.findIndex((c) => c.id === course.id);
  if (idx === -1) {
    list.push(toPlain(course));
  } else {
    list.splice(idx, 1);
  }
  persistConfig();
};

export const removePinnedCourse = (id: string): void => {
  const list = configStore.pinnedRecordedCourses;
  const idx = list.findIndex((c) => c.id === id);
  if (idx === -1) return;
  list.splice(idx, 1);
  persistConfig();
};

export const openPinnedCourse = (course: PinnedCourse): void => {
  openCourse("recorded", {
    id: course.id,
    title: course.title,
    instructor: course.instructor ?? "",
    time: course.time ?? "",
    classrooms: course.classrooms,
    participant_count: course.participant_count,
    college_name: course.college_name,
    professors: course.professors,
    school_year: course.school_year,
    semester: course.semester,
  } as Course);
  navigationStore.setActivePinned(course.id);
};
