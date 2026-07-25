// Recover list-only course fields (classrooms, participant_count) by id.
//
// Ported from the desktop app's features/course/lookupCourseById.ts.
// `getCourseInfo` never returns those fields — they exist only on
// `/v2/course/list`. Keyword search with the numeric course id across all
// semesters returns the exact row (no dedicated by-id list endpoint).

import { getCourseList, type CourseData, type CourseListResponse } from "../lib/api";
import type { Course } from "./useCourseList";
import { createLogger } from "../lib/logger";

const log = createLogger("lookupCourseById");

// In-flight dedupe: Session page + subscribe upgrade + concurrent routes share
// one request per id.
const inflight = new Map<string, Promise<Course | null>>();

export type CourseListFetcher = (
  token: string,
  options: { semesters?: number[]; page?: number; pageSize?: number; keyword?: string },
) => Promise<CourseListResponse>;

/**
 * True when the in-hand course is missing list-only classrooms. Classrooms drive
 * adaptive SSIM; if they are already present we skip the list round-trip.
 */
export function needsListHydration(
  course: { classrooms?: { name: string }[] | null } | null | undefined,
): boolean {
  return !(course && Array.isArray(course.classrooms) && course.classrooms.length > 0);
}

/**
 * Map a list/search row to Course. Local copy of useCourseList's
 * `transformCourseDataToCourse` so this module does not import the composable
 * (and its navigation side effects). Keep field mapping in lockstep.
 */
function courseFromListRow(courseData: CourseData): Course {
  const professors = courseData.professors ? courseData.professors.join(", ") : "Unknown";
  const semesterText = courseData.semester === "1" ? "Fall" : "Spring";
  return {
    id: String(courseData.id),
    title: courseData.name_zh,
    instructor: professors,
    time: `${courseData.school_year} ${semesterText}`,
    professors: courseData.professors,
    classrooms: courseData.classrooms,
    school_year: courseData.school_year,
    semester: courseData.semester,
    college_name: courseData.college_name,
    participant_count: courseData.participant_count,
  };
}

/** Exact-id match on a list page. Keyword search can return extras. */
export function pickCourseFromList(
  courseId: string,
  rows: CourseData[] | null | undefined,
): Course | null {
  const want = String(courseId);
  const hit = (rows ?? []).find((row) => String(row.id) === want);
  return hit ? courseFromListRow(hit) : null;
}

/**
 * Look up the full list-shaped course for `courseId` via
 * `GET /v2/course/list?keyword=<id>` with no semester filter (all semesters).
 * Soft-fails to `null` on network/API errors or no exact match.
 */
export async function lookupCourseById(
  token: string,
  courseId: string | number | null | undefined,
  fetchList: CourseListFetcher = getCourseList,
): Promise<Course | null> {
  const id = courseId == null ? "" : String(courseId).trim();
  if (!token || !id) return null;

  const existing = inflight.get(id);
  if (existing) return existing;

  const promise = (async (): Promise<Course | null> => {
    try {
      const response = await fetchList(token, {
        keyword: id,
        // Empty = all semesters. Searching only the latest term would miss
        // re-offered courses under older semester tags.
        semesters: [],
        page: 1,
        pageSize: 16,
      });
      return pickCourseFromList(id, response.data);
    } catch (error) {
      log.warn("Course list lookup failed:", id, error);
      return null;
    } finally {
      inflight.delete(id);
    }
  })();

  inflight.set(id, promise);
  return promise;
}

/** Test-only: clear the in-flight map between cases. */
export function __resetLookupInflightForTests(): void {
  inflight.clear();
}
