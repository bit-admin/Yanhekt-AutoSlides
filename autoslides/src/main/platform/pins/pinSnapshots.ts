/**
 * Pin snapshots: the course fields a pin keeps so it opens without a network
 * hop, built from each source a sync reads. Pure.
 */
import { yanhe2PinKey } from '@common/pins';
import type { CourseData, SubscriptionCourseRow } from '@common/apiTypes';
import type { PinnedCourse } from '@common/types';
import type { Yanhe2Course } from '@common/yanhe2Curriculum';

const text = (value: unknown): string | undefined => {
  const s = value === null || value === undefined ? '' : String(value).trim();
  return s || undefined;
};

/** `2026-2027 Fall`, the English term line older code still falls back to. */
const termLine = (schoolYear?: string, semester?: string): string | undefined =>
  schoolYear ? `${schoolYear} ${Number(semester) === 1 ? 'Fall' : 'Spring'}` : undefined;

function namesOf(list: Array<{ name?: string } | string> | undefined): string[] {
  if (!Array.isArray(list)) return [];
  return list
    .map((p) => (typeof p === 'string' ? p : (p?.name ?? '')))
    .map((s) => s.trim())
    .filter(Boolean);
}

/** A Yanhekt subscription list row. */
export function pinFromSubscriptionRow(row: SubscriptionCourseRow): PinnedCourse {
  const professors = Array.isArray(row.professor_names) && row.professor_names.length
    ? row.professor_names.map(String).map((s) => s.trim()).filter(Boolean)
    : namesOf(row.professors);
  const schoolYear = text(row.school_year);
  const semester = text(row.semester);
  return {
    id: String(row.id),
    title: row.name_zh ?? '',
    titleEn: text(row.name_en),
    number: text(row.number),
    instructor: professors.length ? professors.join(', ') : undefined,
    time: termLine(schoolYear, semester),
    classrooms: row.classrooms?.map((c) => ({ name: c.name })).filter((c) => !!c.name),
    participant_count: row.participant_count,
    college_name: text(row.college_name) ?? text(row.college?.name),
    professors: professors.length ? professors : undefined,
    school_year: schoolYear,
    semester,
    imageUrl: text(row.image_url) ?? text(row.college?.image_url),
  };
}

/** A Yanhekt course list row (a twin found by registrar number). */
export function pinFromCourseData(row: CourseData): PinnedCourse {
  const professors = namesOf(row.professors);
  const schoolYear = text(row.school_year);
  const semester = text(row.semester);
  return {
    id: String(row.id),
    title: row.name_zh ?? '',
    titleEn: text(row.name_en),
    number: text(row.number),
    instructor: professors.length ? professors.join(', ') : undefined,
    time: termLine(schoolYear, semester),
    classrooms: row.classrooms?.map((c) => ({ name: c.name })).filter((c) => !!c.name),
    participant_count: row.participant_count,
    college_name: text(row.college_name),
    professors: professors.length ? professors : undefined,
    school_year: schoolYear,
    semester,
    imageUrl: text(row.image_url),
  };
}

/** A Yanhe 2.0 course (its detail), as a pin only Yanhe 2.0 has. */
export function pinFromYanhe2Course(course: Yanhe2Course, teachers: string[] = []): PinnedCourse {
  const professors = teachers.length ? teachers : (course.teacher ? [course.teacher] : []);
  const schoolYear = text(course.schoolYear);
  const semester = text(course.semester);
  return {
    id: yanhe2PinKey(course.courseId),
    yanhe2Id: course.courseId,
    title: course.title,
    number: text(course.courseCode),
    instructor: professors.length ? professors.join(', ') : undefined,
    time: termLine(schoolYear, semester),
    college_name: text(course.college),
    professors: professors.length ? professors : undefined,
    school_year: schoolYear,
    semester,
  };
}

/**
 * `fresh` over `old`, field by field: a field `fresh` lacks keeps its old
 * value. Sync state (key, twin ids, checks, owner) comes from `fresh` when it
 * has it.
 */
export function mergePin(old: PinnedCourse, fresh: PinnedCourse): PinnedCourse {
  const out: PinnedCourse = { ...old };
  for (const [field, value] of Object.entries(fresh) as [keyof PinnedCourse, unknown][]) {
    if (value === undefined || value === null || value === '') continue;
    if (Array.isArray(value) && value.length === 0) continue;
    (out as unknown as Record<string, unknown>)[field] = value;
  }
  return out;
}

/** Plain JSON copy with the fields in a fixed order, so equal pins compare equal. */
export function plainPin(pin: PinnedCourse): PinnedCourse {
  return {
    id: String(pin.id),
    yanhe2Id: pin.yanhe2Id,
    yanhe2MissingAt: pin.yanhe2MissingAt,
    yanhektMissingAt: pin.yanhektMissingAt,
    title: pin.title ?? '',
    titleEn: pin.titleEn,
    number: pin.number,
    instructor: pin.instructor,
    time: pin.time,
    classrooms: pin.classrooms?.map((r) => ({ name: r.name })),
    participant_count: pin.participant_count,
    college_name: pin.college_name,
    professors: pin.professors ? [...pin.professors] : undefined,
    school_year: pin.school_year,
    semester: pin.semester,
    imageUrl: pin.imageUrl,
    owner: pin.owner,
  };
}
