/**
 * Course lists kept in the account's Yanhekt notes.
 *
 * Yanhekt no longer saves note content, but still creates, titles and deletes
 * notes and groups. So one course is one empty note whose title carries the
 * course, in one of two groups. A course per note lets two computers change
 * different courses without overwriting each other.
 *
 * Title: `AS1|<yanhekt id>|<yanhe2 id>|<year>-<semester>|<number>|<course title>`
 * The course title is stored whole or not at all, because it can become a
 * folder name; a course without one is filled in from its id.
 */
import { YANHE2_PIN_PREFIX, yanhe2PinKey, yanhektIdOf } from './pins';

export const COURSE_CLOUD_GROUP_MAX = 6;
export const COURSE_CLOUD_TITLE_MAX = 80;

export const COURSE_CLOUD_GROUPS = {
  enrolled: 'ASenrl',
  subscribed: 'ASsubs',
} as const;
export type CourseCloudKind = keyof typeof COURSE_CLOUD_GROUPS;

const PREFIX = 'AS1';
const SEPARATOR = '|';
const ID = /^\d{1,12}$/;

export interface CloudCourse {
  /** Yanhekt course id, '' when only Yanhe 2.0 has the course. */
  yanhektId: string;
  /** Yanhe 2.0 course id, '' when not known. */
  yanhe2Id: string;
  school_year: string;
  semester: string;
  number: string;
  /** Canonical Chinese title, '' when it did not fit. */
  title: string;
}

/** The course's key: its Yanhekt id, else `yanhe2:<id>` (the same as a pin's). */
export const courseCloudKey = (course: Pick<CloudCourse, 'yanhektId' | 'yanhe2Id'>): string =>
  course.yanhektId || yanhe2PinKey(course.yanhe2Id);

/** The stored fields of a pin or an enrolled row. */
export function cloudCourseOf(row: {
  id: string;
  yanhe2Id?: string;
  title?: string;
  number?: string;
  school_year?: string;
  semester?: string;
}): CloudCourse {
  const id = String(row.id ?? '');
  const fromKey = id.startsWith(YANHE2_PIN_PREFIX) ? id.slice(YANHE2_PIN_PREFIX.length) : '';
  return {
    yanhektId: yanhektIdOf({ id }),
    yanhe2Id: row.yanhe2Id ?? fromKey,
    school_year: row.school_year ?? '',
    semester: row.semester ?? '',
    number: row.number ?? '',
    title: row.title ?? '',
  };
}

const clean = (value: string): string => (value.includes(SEPARATOR) ? '' : value.trim());

/** The note title of a course, at most 80 characters; null when it has no valid id. */
export function encodeCourseTitle(course: CloudCourse): string | null {
  const { yanhektId, yanhe2Id } = course;
  if ((!yanhektId && !yanhe2Id) || (yanhektId && !ID.test(yanhektId)) || (yanhe2Id && !ID.test(yanhe2Id))) {
    return null;
  }
  const year = clean(course.school_year);
  const semester = clean(course.semester);
  const term = year && semester ? `${year}-${semester}` : '';
  const head = [PREFIX, yanhektId, yanhe2Id, term].join(SEPARATOR);
  const number = clean(course.number);
  const title = course.title.trim();
  const candidates = [
    [head, number, title],
    [head, number, ''],
    [head, '', ''],
  ];
  for (const parts of candidates) {
    const text = parts.join(SEPARATOR);
    if (text.length <= COURSE_CLOUD_TITLE_MAX) return text;
  }
  return null;
}

/** The course in a note title; null for any note AutoSlides did not write. */
export function decodeCourseTitle(text: string): CloudCourse | null {
  const parts = String(text ?? '').split(SEPARATOR);
  if (parts.length < 6 || parts[0] !== PREFIX) return null;
  const [, yanhektId, yanhe2Id, term, number] = parts;
  if (!yanhektId && !yanhe2Id) return null;
  if ((yanhektId && !ID.test(yanhektId)) || (yanhe2Id && !ID.test(yanhe2Id))) return null;
  const split = term.lastIndexOf('-');
  return {
    yanhektId,
    yanhe2Id,
    school_year: split > 0 ? term.slice(0, split) : '',
    semester: split > 0 ? term.slice(split + 1) : '',
    number,
    // A course title may itself contain the separator.
    title: parts.slice(5).join(SEPARATOR),
  };
}
