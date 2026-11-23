import { computed } from "vue";
import { configStore, persistConfig, type SubscribedCourse } from "../stores/configStore";
import { authStore, onIdentityReady } from "../stores/authStore";
import {
  getAvailableSemesters,
  getCourseDetailIfAvailable,
  getSubscriptionList,
  sendYanhektRequest,
  subscribeCourse,
  unsubscribeCourse,
  type SubscriptionCourseRow,
} from "../lib/api";
import { cloudCourseOf, type CloudCourse } from "../lib/courseCloud";
import { CourseCloudStore, type CloudSnapshot } from "../lib/courseCloudStore";
import { planSubscriptionSync } from "../lib/subscriptionSyncPlan";
import { readJSON, writeJSON } from "../stores/storage";
import { createLogger } from "../lib/logger";
import { openCourse } from "./courseSelection";
import type { Course } from "./useCourseList";

const log = createLogger("subscribedCourses");

// Subscribed recorded courses. Ported from the desktop app's
// features/course/pinnedCourses.ts. Only recorded courses are subscribable (they
// persist; live streams are transient). Local cache is kept as last-known state
// and is merged with Yanhekt's list and the account's course notes on each sync
// (`subscriptionSyncPlan.ts`), so subscriptions of earlier terms stay.

// Ids are compared/exposed as strings: configs persisted before the id
// normalization may hold numeric ids (raw API values), and route params are
// always strings.
export const subscribedRecordedCourses = computed<SubscribedCourse[]>(() =>
  configStore.subscribedRecordedCourses
    // A course from a note whose title could not be read yet stays in the list
    // (dropping it would read as an unsubscribe) but has nothing to show.
    .filter((c) => !!c.title)
    .map((c) => ({ ...c, id: String(c.id) })),
);

export const isSubscribed = (id: string): boolean =>
  configStore.subscribedRecordedCourses.some((c) => String(c.id) === String(id));

// Tracks in-flight subscribe/unsubscribe per course so double-clicks don't race.
const inFlight = new Set<string>();
// One sync at a time (login + hydrate can otherwise overlap).
let syncInFlight: Promise<boolean> | null = null;
let syncAgain = false;
let lastSync: { token: string; at: number } | null = null;

const MAX_SUBSCRIPTION_PAGES = 50;
const SYNC_STATE_KEY = "autoslides.subscriptionSync";
/** Courses from the notes without a title or teacher, filled in per sync. */
const MAX_DETAIL_LOOKUPS = 12;

/** The account's course notes (shared with the read-only enrolled list). */
export const courseCloudStore = new CourseCloudStore(sendYanhektRequest);

// Rebuild a plain, JSON-safe snapshot before persisting (drops reactive proxies
// and any extra Course fields we don't store).
const toPlain = (course: SubscribedCourse | Course): SubscribedCourse => ({
  id: String(course.id),
  title: course.title,
  titleEn: course.titleEn,
  instructor: course.instructor,
  time: course.time,
  classrooms: course.classrooms?.map((r) => ({ name: r.name })),
  participant_count: course.participant_count,
  college_name: course.college_name,
  professors: course.professors ? [...course.professors] : undefined,
  school_year: course.school_year,
  semester: course.semester,
  imageUrl: course.imageUrl,
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
  const imageUrl = (row.image_url || row.college?.image_url || "").trim() || undefined;
  return {
    id: String(row.id),
    title: row.name_zh ?? "",
    titleEn: row.name_en,
    instructor: professors.length ? professors.join(", ") : undefined,
    classrooms: row.classrooms
      ?.map((c) => ({ name: c.name }))
      .filter((c) => !!c.name),
    participant_count: row.participant_count,
    college_name: row.college_name || row.college?.name,
    professors: professors.length ? professors : undefined,
    school_year: row.school_year != null ? String(row.school_year) : undefined,
    semester: row.semester != null ? String(row.semester) : undefined,
    imageUrl,
  };
}

async function fetchAllSubscriptionRows(token: string): Promise<SubscriptionCourseRow[]> {
  const rows: SubscriptionCourseRow[] = [];
  for (let page = 1; page <= MAX_SUBSCRIPTION_PAGES; page++) {
    const result = await getSubscriptionList(token, { page });
    const pageRows = result?.data ?? [];
    rows.push(...pageRows);
    const lastPage = Number(result?.last_page) || 1;
    if (page >= lastPage) break;
  }
  return rows;
}

/** A newer snapshot over a stored one: what the newer one lacks is kept. */
function mergeCourse(existing: SubscribedCourse | undefined, incoming: SubscribedCourse): SubscribedCourse {
  if (!existing) return incoming;
  return {
    id: String(existing.id),
    title: incoming.title || existing.title,
    titleEn: incoming.titleEn || existing.titleEn,
    instructor: incoming.instructor || existing.instructor,
    time: incoming.time || existing.time,
    classrooms: incoming.classrooms?.length ? incoming.classrooms : existing.classrooms,
    participant_count: incoming.participant_count ?? existing.participant_count,
    college_name: incoming.college_name || existing.college_name,
    professors: incoming.professors?.length ? incoming.professors : existing.professors,
    school_year: incoming.school_year || existing.school_year,
    semester: incoming.semester || existing.semester,
    imageUrl: incoming.imageUrl || existing.imageUrl,
  };
}

function replaceLocalList(courses: SubscribedCourse[]): void {
  configStore.subscribedRecordedCourses.splice(
    0,
    configStore.subscribedRecordedCourses.length,
    ...courses.map(toPlain),
  );
  persistConfig();
}

const toTerm = (c: Pick<SubscribedCourse, "school_year" | "semester">): string | null => {
  const year = Number(String(c.school_year ?? "").slice(0, 4));
  const semester = Number(c.semester);
  if (!Number.isInteger(year) || year < 2000 || (semester !== 1 && semester !== 2)) return null;
  return `${year}-${year + 1}-${semester}`;
};

function courseFromNote(course: CloudCourse): SubscribedCourse {
  return {
    id: course.yanhektId,
    title: course.title,
    school_year: course.school_year || undefined,
    semester: course.semester || undefined,
  };
}

/** What each account's lists held after its last sync, and whose list is stored. */
interface SyncState {
  listOwner: string | null;
  bases: Record<string, { yanhekt: string[] | null; cloud: string[] | null }>;
}

const readSyncState = (): SyncState => {
  const state = readJSON<Partial<SyncState>>(SYNC_STATE_KEY, {}) ?? {};
  return { listOwner: state.listOwner ?? null, bases: state.bases ?? {} };
};

async function fillThinCourses(courses: SubscribedCourse[], token: string): Promise<void> {
  let budget = MAX_DETAIL_LOOKUPS;
  for (const course of courses) {
    if (course.title && course.instructor) continue;
    if (budget-- <= 0) break;
    try {
      const detail = await getCourseDetailIfAvailable(course.id, token);
      course.title = course.title || detail.title;
      course.titleEn = course.titleEn || detail.title_en;
      course.professors = course.professors ?? detail.professors;
      course.instructor = course.instructor || detail.professors?.join(", ") || undefined;
      course.college_name = course.college_name || detail.college_name;
      course.imageUrl = course.imageUrl || detail.image_url;
    } catch {
      // Stays thin until the next sync.
    }
  }
}

/** One sync. True when Yanhekt's list was read. */
async function runSync(): Promise<boolean> {
  const token = authStore.token.value;
  if (!token) return false;
  const owner = authStore.userId.value;

  let rows: SubscriptionCourseRow[];
  try {
    rows = await fetchAllSubscriptionRows(token);
  } catch (error) {
    log.warn("Subscription sync failed; keeping local list:", error);
    return false;
  }
  const fresh = rows.map(mapSubscriptionRowToSubscribedCourse);
  if (!owner) {
    replaceLocalList(fresh);
    return true;
  }

  const state = readSyncState();
  const isMine = state.listOwner === owner;
  const startIds = configStore.subscribedRecordedCourses.map((c) => String(c.id)).join();
  const [snapshot, currentTerm] = await Promise.all([
    courseCloudStore.read(token, "subscribed").catch((error: unknown): CloudSnapshot | null => {
      log.warn("Course notes not read:", error);
      return null;
    }),
    getAvailableSemesters(token).then((terms) => terms[0]?.key ?? null, () => null),
  ]);

  const byId = new Map<string, SubscribedCourse>();
  if (isMine) for (const c of configStore.subscribedRecordedCourses) byId.set(String(c.id), toPlain(c));
  for (const note of snapshot?.notes ?? []) {
    if (note.course.yanhektId && !byId.has(note.course.yanhektId)) {
      byId.set(note.course.yanhektId, courseFromNote(note.course));
    }
  }
  for (const c of fresh) byId.set(c.id, mergeCourse(byId.get(c.id), c));

  const base = state.bases[owner] ?? { yanhekt: null, cloud: null };
  const noteIds = (snapshot?.notes ?? []).map((n) => n.course.yanhektId).filter(Boolean);
  // A missing or empty group merges like a first sync: losing it unsubscribes nothing.
  const cloudBase = noteIds.length && base.cloud ? new Set(base.cloud) : null;
  const plan = planSubscriptionSync({
    local: isMine ? new Set(configStore.subscribedRecordedCourses.map((c) => String(c.id))) : null,
    yanhekt: { remote: new Set(fresh.map((c) => c.id)), base: base.yanhekt ? new Set(base.yanhekt) : null },
    cloud: snapshot ? { remote: new Set(noteIds), base: cloudBase } : null,
    termOf: (id) => {
      const course = byId.get(id);
      return course ? toTerm(course) : null;
    },
    currentTerm,
  });
  const kept = plan.kept.map((id) => byId.get(id)).filter((c): c is SubscribedCourse => !!c);
  await fillThinCourses(kept, token);

  // The account changed, or a course was toggled (which asks for another sync).
  if (authStore.token.value !== token) return false;
  if (inFlight.size || configStore.subscribedRecordedCourses.map((c) => String(c.id)).join() !== startIds) {
    return true;
  }
  replaceLocalList(kept);

  const held = new Set(fresh.map((c) => c.id));
  for (const id of plan.subscribe) {
    try {
      await subscribeCourse(token, id);
      held.add(id);
    } catch (error) {
      log.warn("Subscribe not sent:", error);
    }
  }
  for (const id of plan.unsubscribe) {
    try {
      await unsubscribeCourse(token, id);
      held.delete(id);
    } catch (error) {
      log.warn("Unsubscribe not sent:", error);
    }
  }

  let nextCloud = base.cloud;
  if (snapshot) {
    // Courses only Yanhe 2.0 has are the desktop's; the web keeps their notes.
    const others = snapshot.notes.filter((n) => !n.course.yanhektId).map((n) => n.course);
    try {
      nextCloud = await courseCloudStore.reconcile(token, "subscribed", [...kept.map(cloudCourseOf), ...others], snapshot);
    } catch (error) {
      log.warn("Course notes not written:", error);
    }
  }

  // Without the notes, this list may lack another account's earlier terms, so
  // it does not yet count as this account's.
  const latest = readSyncState();
  writeJSON(SYNC_STATE_KEY, {
    listOwner: isMine || snapshot ? owner : latest.listOwner,
    bases: { ...latest.bases, [owner]: { yanhekt: [...held], cloud: nextCloud } },
  } satisfies SyncState);
  return true;
}

/**
 * Whether Yanhekt may hold this subscription. A course of an earlier term that
 * came from the notes is not on its list, so there is nothing to unsubscribe,
 * and a refused call must not undo the removal.
 */
const mayBeOnYanhekt = (id: string): boolean => {
  const owner = authStore.userId.value;
  const held = owner ? readSyncState().bases[owner]?.yanhekt : null;
  return !held || held.includes(id);
};

/** Whether the stored list is known to be the signed-in account's. */
export const subscribedListIsCurrent = (): boolean => {
  const owner = authStore.userId.value;
  return !!owner && readSyncState().listOwner === owner;
};

/**
 * Bring this browser, Yanhekt and the course notes into step. One at a time;
 * asked again while running, it runs once more. With `maxAgeMs`, a recent sync
 * of the same account counts. Resolves true when Yanhekt's list was read.
 */
export function syncSubscribedCoursesFromServer(options: { maxAgeMs?: number } = {}): Promise<boolean> {
  if (syncInFlight) {
    if (options.maxAgeMs === undefined) syncAgain = true;
    return syncInFlight;
  }
  const token = authStore.token.value;
  if (!token) return Promise.resolve(false);
  if (
    options.maxAgeMs !== undefined &&
    lastSync?.token === token &&
    Date.now() - lastSync.at < options.maxAgeMs
  ) {
    return Promise.resolve(true);
  }

  syncInFlight = (async () => {
    let ok = false;
    do {
      syncAgain = false;
      ok = await runSync();
    } while (syncAgain);
    if (ok) lastSync = { token, at: Date.now() };
    return ok;
  })()
    .catch((error: unknown) => {
      log.warn("Subscription sync failed:", error);
      return false;
    })
    .finally(() => {
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
    } else if (mayBeOnYanhekt(id)) {
      await unsubscribeCourse(token, id);
    }
  } catch (error) {
    log.warn("Subscribe toggle API failed; rolling back:", error);
    replaceLocalList(previous);
  } finally {
    inFlight.delete(id);
    void syncSubscribedCoursesFromServer();
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
    if (mayBeOnYanhekt(courseId)) await unsubscribeCourse(token, courseId);
  } catch (error) {
    log.warn("Unsubscribe API failed; rolling back:", error);
    replaceLocalList(previous);
  } finally {
    inFlight.delete(courseId);
    void syncSubscribedCoursesFromServer();
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

  list[idx] = mergeCourse(list[idx], toPlain(course));
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
    titleEn: snapshot.titleEn,
    instructor: snapshot.instructor ?? "",
    time: snapshot.time ?? "",
    classrooms: snapshot.classrooms,
    participant_count: snapshot.participant_count,
    college_name: snapshot.college_name,
    professors: snapshot.professors,
    school_year: snapshot.school_year,
    semester: snapshot.semester,
    imageUrl: snapshot.imageUrl,
  } as Course;
};

export const openSubscribedCourse = (course: SubscribedCourse): void => {
  const full = getSubscribedCourse(course.id);
  if (full) openCourse("recorded", full);
};

// Refresh from the server whenever a session becomes valid (launch hydrate,
// paste-Verify, password login). Registered rather than called from authStore
// so the import only ever points this way — see onIdentityReady. Failures are
// swallowed inside the sync itself; the last-known local list stays.
onIdentityReady(() => {
  void syncSubscribedCoursesFromServer();
});
