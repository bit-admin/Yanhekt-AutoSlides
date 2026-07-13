import { computed } from "vue";
import { configStore, persistConfig, type SubscribedCourse } from "../stores/configStore";
import { openCourse } from "./courseSelection";
import type { Course } from "./useCourseList";

// Subscribed recorded courses. Ported from the desktop app's
// features/course/pinnedCourses.ts. Only recorded courses are subscribable (they
// persist; live streams are transient).

// Ids are compared/exposed as strings: configs persisted before the id
// normalization may hold numeric ids (raw API values), and route params are
// always strings.
export const subscribedRecordedCourses = computed<SubscribedCourse[]>(() =>
  configStore.subscribedRecordedCourses.map((c) => ({ ...c, id: String(c.id) })),
);

export const isSubscribed = (id: string): boolean =>
  configStore.subscribedRecordedCourses.some((c) => String(c.id) === String(id));

// Rebuild a plain, JSON-safe snapshot before persisting (drops reactive proxies
// and any extra Course fields we don't store).
const toPlain = (course: SubscribedCourse | Course): SubscribedCourse => ({
  id: String(course.id),
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
  const idx = list.findIndex((c) => String(c.id) === String(course.id));
  if (idx === -1) {
    list.push(toPlain(course));
  } else {
    list.splice(idx, 1);
  }
  persistConfig();
};

export const removeSubscribedCourse = (id: string): void => {
  const list = configStore.subscribedRecordedCourses;
  const idx = list.findIndex((c) => String(c.id) === String(id));
  if (idx === -1) return;
  list.splice(idx, 1);
  persistConfig();
};

/**
 * Rebuild a full Course from the subscribe-time snapshot. This is the ONLY
 * cold-load source for classrooms/participant_count: the by-id APIs
 * (/v1/course + session/list) never return them — they exist solely in the
 * course list/search responses, which is why subscribing records everything.
 */
export const getSubscribedCourse = (id: string): Course | null => {
  const snapshot = configStore.subscribedRecordedCourses.find(
    (c) => String(c.id) === String(id),
  );
  if (!snapshot) return null;
  return {
    id: String(snapshot.id),
    title: snapshot.title,
    instructor: snapshot.instructor ?? "",
    time: snapshot.time ?? "",
    classrooms: snapshot.classrooms,
    participant_count: snapshot.participant_count,
    college_name: snapshot.college_name,
    professors: snapshot.professors,
    school_year: snapshot.school_year,
    semester: snapshot.semester,
  } as Course;
};

export const openSubscribedCourse = (course: SubscribedCourse): void => {
  const full = getSubscribedCourse(course.id);
  if (full) openCourse("recorded", full);
};
