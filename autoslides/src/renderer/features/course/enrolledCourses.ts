import { configStore } from '@shared/services/configStore'
import type { EnrolledCourse, EnrolledRefreshResult } from '@common/types'
import type { Course } from './useCourseList'

// The Recorded page's enrolled courses, every term, newest term first. Main is
// the only writer: the current term from Yanhekt's enrolled list, earlier
// terms from Yanhe 2.0's My Courses matched to their Yanhekt twins
// (`EnrolledCoursesService`). Config is broadcast after each change, so the
// grid fills in as earlier terms are found.

// Arrays are copied: configStore rows are Vue proxies, and an opened course
// can reach IPC (Recurring #1).
const toCourse = (c: EnrolledCourse): Course => ({
  id: c.id,
  title: c.title,
  titleEn: c.titleEn,
  number: c.number,
  instructor: c.instructor ?? '',
  time: c.time ?? '',
  professors: c.professors ? [...c.professors] : undefined,
  classrooms: c.classrooms?.map(r => ({ name: r.name })),
  school_year: c.school_year,
  semester: c.semester,
  college_name: c.college_name,
  participant_count: c.participant_count,
  imageUrl: c.imageUrl,
})

/** The account's stored enrolled courses as grid cards. */
export const enrolledCoursesOf = (owner: string): Course[] =>
  (configStore.enrolledCourses ?? []).filter(c => c.owner === owner).map(toCourse)

/** Ask main to refresh the account's list; resolves once the current term is read. */
export const refreshEnrolledCourses = (owner: string): Promise<EnrolledRefreshResult> =>
  window.electronAPI.enrolled.refresh(owner)
