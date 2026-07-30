import { computed } from "vue";
import { configStore, persistConfig, type SubscribedCourse } from "../stores/configStore";
import { authStore } from "../stores/authStore";
import {
  getSubscriptionList,
  subscribeCourse,
  unsubscribeCourse,
  type SubscriptionCourseRow,
} from "../lib/api";
import { createLogger } from "../lib/logger";
import { openCourse } from "./courseSelection";
import type { Course } from "./useCourseList";

const log = createLogger("subscribedCourses");

// Subscribed recorded courses. Ported from the desktop app's
// features/course/pinnedCourses.ts. Only recorded courses are subscribable (they
// persist; live streams are transient). Local cache is kept as last-known state
// and is replaced by the Yanhekt subscription list on login/launch sync.

// Ids are compared/exposed as strings: configs persisted before the id
// normalization may hold numeric ids (raw API values), and route params are
// always strings.
export const subscribedRecordedCourses = computed<SubscribedCourse[]>(() =>
  configStore.subscribedRecordedCourses.map((c) => ({ ...c, id: String(c.id) })),
);

export const isSubscribed = (id: string): boolean =>
  configStore.subscribedRecordedCourses.some((c) => String(c.id) === String(id));

// Tracks in-flight subscribe/unsubscribe per course so double-clicks don't race.
const inFlight = new Set<string>();
// One sync at a time (login + hydrate can otherwise overlap).
let syncInFlight: Promise<void> | null = null;

const SUBSCRIPTION_PAGE_SIZE = 100;
const MAX_SUBSCRIPTION_PAGES = 50;

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

function professorNamesFromRow(row: SubscriptionCourseRow): string[] {
  if (Array.isArray(row.professor_names) && row.professor_names.length) {
    return row.professor_names.map(String).map((s) => s.trim()).filter(Boolean);
  }
  if (Array.isArray(row.professors)) {
    return row.professors
      .map((p) => (typeof p === "string" ? p : (p?.name ?? "")))
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return [];
}

/** Map a Yanhekt subscription list row into a SubscribedCourse snapshot. */
export function mapSubscriptionRowToSubscribedCourse(
  row: SubscriptionCourseRow,
): SubscribedCourse {
  const professors = professorNamesFromRow(row);
  return {
    id: String(row.id),
    title: row.name_zh ?? "",
    instructor: professors.length ? professors.join(", ") : undefined,
    classrooms: row.classrooms
      ?.map((c) => ({ name: c.name }))
      .filter((c) => !!c.name),
    participant_count: row.participant_count,
    college_name: row.college_name || row.college?.name,
    professors: professors.length ? professors : undefined,
    school_year: row.school_year != null ? String(row.school_year) : undefined,
    semester: row.semester != null ? String(row.semester) : undefined,
  };
}

async function fetchAllSubscriptionRows(token: string): Promise<SubscriptionCourseRow[]> {
  const rows: SubscriptionCourseRow[] = [];
  for (let page = 1; page <= MAX_SUBSCRIPTION_PAGES; page++) {
    const result = await getSubscriptionList(token, {
      page,
      pageSize: SUBSCRIPTION_PAGE_SIZE,
    });
    const pageRows = result?.data ?? [];
    rows.push(...pageRows);
    const lastPage = Number(result?.last_page) || 1;
    if (page >= lastPage) break;
  }
  return rows;
}

function replaceLocalList(courses: SubscribedCourse[]): void {
  configStore.subscribedRecordedCourses.splice(
    0,
    configStore.subscribedRecordedCourses.length,
    ...courses.map(toPlain),
  );
  persistConfig();
}

/**
 * Pull the Yanhekt subscription list into the local subscribe cache (replace).
 * Called after login / token hydrate. Soft-fails offline.
 */
export async function syncSubscribedCoursesFromServer(): Promise<void> {
  if (syncInFlight) return syncInFlight;

  syncInFlight = (async () => {
    const token = authStore.token.value;
    if (!token) return;

    try {
      const rows = await fetchAllSubscriptionRows(token);
      replaceLocalList(rows.map(mapSubscriptionRowToSubscribedCourse));
    } catch (error) {
      log.warn("Subscription sync failed; keeping local list:", error);
    }
  })().finally(() => {
    syncInFlight = null;
  });

  return syncInFlight;
}

export const toggleSubscribedCourse = async (
  course: SubscribedCourse | Course,
): Promise<void> => {
  if (!course.id) return;

  const id = String(course.id);
  if (inFlight.has(id)) return;
  inFlight.add(id);

  const list = configStore.subscribedRecordedCourses;
  const previous = list.map(toPlain);
  const idx = list.findIndex((c) => String(c.id) === id);
  const isSubscribe = idx === -1;

  if (isSubscribe) {
    list.push(toPlain(course));
  } else {
    list.splice(idx, 1);
  }
  persistConfig();

  try {
    const token = authStore.token.value;
    if (!token) return; // offline / signed-out: keep local-only change
    if (isSubscribe) {
      await subscribeCourse(token, id);
    } else {
      await unsubscribeCourse(token, id);
    }
  } catch (error) {
    log.warn("Subscribe toggle API failed; rolling back:", error);
    replaceLocalList(previous);
  } finally {
    inFlight.delete(id);
  }
};

export const removeSubscribedCourse = async (id: string): Promise<void> => {
  if (!id) return;

  const courseId = String(id);
  if (inFlight.has(courseId)) return;
  inFlight.add(courseId);

  const list = configStore.subscribedRecordedCourses;
  const previous = list.map(toPlain);
  const idx = list.findIndex((c) => String(c.id) === courseId);
  if (idx === -1) {
    inFlight.delete(courseId);
    return;
  }

  list.splice(idx, 1);
  persistConfig();

  try {
    const token = authStore.token.value;
    if (!token) return;
    await unsubscribeCourse(token, courseId);
  } catch (error) {
    log.warn("Unsubscribe API failed; rolling back:", error);
    replaceLocalList(previous);
  } finally {
    inFlight.delete(courseId);
  }
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
