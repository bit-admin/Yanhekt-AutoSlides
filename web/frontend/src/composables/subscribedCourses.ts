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
 * Rewrite a subscribe snapshot with richer list fields recovered via
 * `lookupCourseById`. No-op when the id is not subscribed. Self-heals thin
 * snapshots (subscribed from a cold open before list hydrate finished).
 */
export const upgradeSubscribedCourse = (course: SubscribedCourse | Course): void => {
  if (!course.id) return;
  const list = configStore.subscribedRecordedCourses;
  const idx = list.findIndex((c) => String(c.id) === String(course.id));
  if (idx === -1) return;

  const existing = list[idx];
  const incoming = toPlain(course);
  list[idx] = {
    id: String(existing.id),
    title: incoming.title || existing.title,
    instructor: incoming.instructor || existing.instructor,
    time: incoming.time || existing.time,
    classrooms: incoming.classrooms?.length ? incoming.classrooms : existing.classrooms,
    participant_count: incoming.participant_count ?? existing.participant_count,
    college_name: incoming.college_name || existing.college_name,
    professors: incoming.professors?.length ? incoming.professors : existing.professors,
    school_year: incoming.school_year || existing.school_year,
    semester: incoming.semester || existing.semester,
  };
  persistConfig();
};

/**
 * Rebuild a full Course from the subscribe-time snapshot. Preferred cold-load
 * cache for classrooms/participant_count (the by-id APIs never return them).
 * When the snapshot is thin or missing, session/player load recovers list fields
 * via `lookupCourseById` and can call `upgradeSubscribedCourse`.
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
