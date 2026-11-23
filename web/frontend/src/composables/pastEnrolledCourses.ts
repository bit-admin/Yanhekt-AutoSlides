import { courseCloudStore } from "./subscribedCourses";
import { getAvailableSemesters, getCourseDetailIfAvailable } from "../lib/api";
import { identityKey } from "../lib/identityKey";
import { createLogger } from "../lib/logger";
import type { Course } from "./useCourseList";

const log = createLogger("pastEnrolledCourses");

const CACHE_MS = 10 * 60 * 1000;
/** Courses without a title or teacher, filled in per read. */
const MAX_DETAIL_LOOKUPS = 12;

const cache = new Map<number | string, { at: number; courses: Course[] }>();

const termOf = (c: { school_year?: string; semester?: string }): string =>
  c.school_year && c.semester ? `${c.school_year}-${c.semester}` : "";

/**
 * Enrolled courses of earlier terms, from the notes the desktop app keeps.
 * Read only: the web never writes this group. A failed read is an empty list.
 */
export async function getPastEnrolledCourses(token: string): Promise<Course[]> {
  const key = identityKey(token);
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.courses;

  try {
    const { notes } = await courseCloudStore.read(token, "enrolled");
    const currentKey = await getAvailableSemesters(token).then((t) => t[0]?.key ?? "", () => "");
    let budget = MAX_DETAIL_LOOKUPS;
    const courses: Course[] = [];
    for (const { course } of notes) {
      if (!course.yanhektId || courses.some((c) => c.id === course.yanhektId)) continue;
      const year = course.school_year.slice(0, 4);
      const noteTerm = year && course.semester ? `${year}-${Number(year) + 1}-${course.semester}` : "";
      if (currentKey && noteTerm === currentKey) continue;

      const row: Course = {
        id: course.yanhektId,
        title: course.title,
        instructor: "",
        time: "",
        school_year: course.school_year || undefined,
        semester: course.semester || undefined,
      };
      if (budget > 0) {
        budget--;
        try {
          const detail = await getCourseDetailIfAvailable(row.id, token);
          row.title = row.title || detail.title;
          row.titleEn = detail.title_en;
          row.professors = detail.professors;
          row.instructor = detail.professors?.join(", ") ?? "";
          row.college_name = detail.college_name;
          row.imageUrl = detail.image_url;
        } catch {
          // Shown with what the note holds.
        }
      }
      if (row.title) courses.push(row);
    }
    courses.sort((a, b) => termOf(b).localeCompare(termOf(a)));
    cache.set(key, { at: Date.now(), courses });
    return courses;
  } catch (error) {
    log.warn("Enrolled course notes not read:", error);
    return [];
  }
}
