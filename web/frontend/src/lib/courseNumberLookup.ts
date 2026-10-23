/**
 * The registrar's course number of a Yanhekt course, by course id.
 *
 * Port of the desktop app's main/platform/courseNumberLookup.ts. Slide
 * metadata keeps the number (Yanhekt `number`, Yanhe 2.0 `kcwybm`) for every
 * extraction, but the player only holds the course id, so the metadata writer
 * asks here and adds it afterwards. One list call
 * (`/v2/course/list?keyword=<id>`), the id checked on the row, answers
 * remembered for the page's lifetime.
 */
import { getCourseList, type CourseListResponse } from "./api";
import { createLogger } from "./logger";

const log = createLogger("CourseNumber");

type ListCourses = (token: string, keyword: string) => Promise<Pick<CourseListResponse, "data">>;

const listByKeyword: ListCourses = (token, keyword) =>
  getCourseList(token, { keyword, page: 1, pageSize: 16 });

export function createCourseNumberLookup(listCourses: ListCourses = listByKeyword) {
  /** Course id → its number ('' when Yanhekt has none). Failures are not kept. */
  const known = new Map<string, Promise<string>>();

  const ask = async (token: string, courseId: string): Promise<string> => {
    // The keyword also matches numbers, codes and teacher badges, so the id is checked.
    const listed = await listCourses(token, courseId);
    const row = (listed.data ?? []).find((course) => String(course.id) === courseId);
    const value = row?.number;
    return value === undefined || value === null ? "" : String(value);
  };

  /** The number, or null when it cannot be had now (no sign-in, no answer, no such course). */
  return async function numberOf(courseId: string, token: string | null): Promise<string | null> {
    if (!/^\d{1,12}$/.test(courseId) || !token) return null;
    let pending = known.get(courseId);
    if (!pending) {
      pending = ask(token, courseId);
      known.set(courseId, pending);
      pending.catch(() => known.delete(courseId));
    }
    try {
      return (await pending) || null;
    } catch (error) {
      log.debug("Course number lookup failed:", error instanceof Error ? error.message : error);
      return null;
    }
  };
}

export const courseNumberOf = createCourseNumberLookup();
