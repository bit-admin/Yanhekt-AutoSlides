/**
 * What to change in a group of course notes so it holds the wanted courses.
 * Pure. A note matches a course by either id, so a course that gained its
 * other site's id updates its note instead of getting a second one.
 */
import { courseCloudKey, encodeCourseTitle, type CloudCourse } from '@common/courseCloud';

export interface CloudNote {
  id: number;
  rawTitle: string;
  course: CloudCourse;
}

export interface CloudWritePlan {
  create: Array<{ key: string; title: string }>;
  retitle: Array<{ id: number; key: string; title: string }>;
  remove: number[];
  /** Keys whose note is already right. */
  unchanged: string[];
}

const sameCourse = (a: CloudCourse, b: CloudCourse): boolean =>
  (!!a.yanhektId && a.yanhektId === b.yanhektId) || (!!a.yanhe2Id && a.yanhe2Id === b.yanhe2Id);

export function planCloudWrites(notes: CloudNote[], wanted: CloudCourse[]): CloudWritePlan {
  const plan: CloudWritePlan = { create: [], retitle: [], remove: [], unchanged: [] };
  const used = new Set<number>();
  const seen = new Set<string>();

  for (const course of wanted) {
    const key = courseCloudKey(course);
    if (seen.has(key)) continue;
    seen.add(key);
    const matches = notes.filter((n) => !used.has(n.id) && sameCourse(n.course, course));
    matches.forEach((n) => used.add(n.id));
    const [keeper, ...duplicates] = matches;
    plan.remove.push(...duplicates.map((n) => n.id));

    // A field this computer lacks keeps what the note already has.
    const merged: CloudCourse = keeper
      ? {
        yanhektId: course.yanhektId || keeper.course.yanhektId,
        yanhe2Id: course.yanhe2Id || keeper.course.yanhe2Id,
        school_year: course.school_year || keeper.course.school_year,
        semester: course.semester || keeper.course.semester,
        number: course.number || keeper.course.number,
        title: course.title || keeper.course.title,
      }
      : course;
    const title = encodeCourseTitle(merged);
    if (!title) continue;
    if (!keeper) plan.create.push({ key, title });
    else if (keeper.rawTitle !== title) plan.retitle.push({ id: keeper.id, key, title });
    else plan.unchanged.push(key);
  }

  for (const note of notes) if (!used.has(note.id)) plan.remove.push(note.id);
  return plan;
}
