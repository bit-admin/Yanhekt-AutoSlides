import type { Course } from "../composables/useCourseList";
import type { SessionData } from "../lib/api";

// In-memory handoff of already-loaded Course/Session objects between routes,
// so in-app navigation (grid → sessions → player) never refetches what the
// previous page already had. Deliberately not persisted: a cold load (deep
// link, reload) simply hydrates from the API instead.
const courses = new Map<string, Course>();
const sessions = new Map<string, SessionData>();

// Keys are String()-coerced defensively: route params are always strings but
// upstream API ids arrive as numbers at runtime (despite the declared types).
const sessionKey = (courseId: string, sessionId: string) => `${courseId}:${sessionId}`;

export const stashCourse = (course: Course): void => {
  if (course.id) courses.set(String(course.id), course);
};

export const takeCourse = (courseId: string): Course | undefined => courses.get(String(courseId));

export const stashSession = (courseId: string, session: SessionData): void => {
  sessions.set(sessionKey(String(courseId), String(session.session_id)), session);
};

export const takeSession = (courseId: string, sessionId: string): SessionData | undefined =>
  sessions.get(sessionKey(String(courseId), String(sessionId)));
