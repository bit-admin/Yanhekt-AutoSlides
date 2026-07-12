import { computed } from "vue";
import { configStore, persistConfig, type SubscribedCourse } from "../stores/configStore";
import { navigationStore } from "../stores/navigationStore";
import { openCourse } from "./courseSelection";
import type { Course } from "./useCourseList";

// Subscribed recorded courses. Ported from the desktop app's
// features/course/pinnedCourses.ts. Only recorded courses are subscribable (they
// persist; live streams are transient).

export const subscribedRecordedCourses = computed<SubscribedCourse[]>(
  () => configStore.subscribedRecordedCourses,
);

export const isSubscribed = (id: string): boolean =>
  subscribedRecordedCourses.value.some((c) => c.id === id);

// Rebuild a plain, JSON-safe snapshot before persisting (drops reactive proxies
// and any extra Course fields we don't store).
const toPlain = (course: SubscribedCourse | Course): SubscribedCourse => ({
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

export const toggleSubscribedCourse = (course: SubscribedCourse | Course): void => {
  if (!course.id) return;
  const list = configStore.subscribedRecordedCourses;
  const idx = list.findIndex((c) => c.id === course.id);
  if (idx === -1) {
    list.push(toPlain(course));
  } else {
    list.splice(idx, 1);
  }
  persistConfig();
};

export const removeSubscribedCourse = (id: string): void => {
  const list = configStore.subscribedRecordedCourses;
  const idx = list.findIndex((c) => c.id === id);
  if (idx === -1) return;
  list.splice(idx, 1);
  persistConfig();
};

export const openSubscribedCourse = (course: SubscribedCourse): void => {
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
  navigationStore.setActiveSubscribed(course.id);
};
