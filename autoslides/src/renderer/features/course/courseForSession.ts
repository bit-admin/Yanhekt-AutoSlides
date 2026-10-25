import type { CourseInfoResponse, SessionDownloadInfo } from '@common/apiTypes'
import type { Course } from './useCourseList'

const termText = (schoolYear?: string, semester?: string): string =>
  schoolYear ? `${schoolYear} ${Number(semester) === 1 ? 'Fall' : 'Spring'}` : ''

/**
 * The course a session belongs to, as complete as the by-id calls allow:
 * `/v1/course` for teachers and term, the list lookup for classrooms (adaptive
 * SSIM reads them), and the session's nested course when both fail.
 */
export function courseForSession(
  base: SessionDownloadInfo['course'],
  info: CourseInfoResponse | null,
  list: Course | null,
): Course {
  const schoolYear = info?.school_year || list?.school_year || base.school_year
  const rawSemester = info?.semester ?? list?.semester ?? base.semester
  const semester = rawSemester != null && rawSemester !== '' ? String(rawSemester) : undefined
  return {
    id: base.id,
    title: info?.title || list?.title || base.title,
    titleEn: info?.title_en || list?.titleEn || base.titleEn,
    number: info?.number || list?.number || base.number,
    instructor: info?.professor || list?.instructor || '',
    time: termText(schoolYear, semester) || list?.time || '',
    professors: info?.professors?.length ? info.professors : list?.professors,
    college_name: info?.college_name || list?.college_name || base.college_name,
    school_year: schoolYear,
    semester,
    classrooms: list?.classrooms,
    participant_count: list?.participant_count,
  }
}
