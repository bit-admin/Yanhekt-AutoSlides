/**
 * Course index results on the Search page (main platform/courseIndex/: the
 * copy on this computer or the online AutoSlides Index, per Settings →
 * General → Search).
 *
 * The index knows a course's id, Chinese name, teachers, registrar code and
 * term, so each card starts from those and is then filled from Yanhekt's
 * `/v1/course` (English name, cover, college, teachers). Opening a card goes
 * through the usual course page, which loads the session list by id
 * (Yanhekt's lists, then the index's session ids).
 */

import type { ApiClient, CourseIndexRow } from '@shared/services/apiClient'
import { createLogger } from '@shared/utils/logger'
import type { Course } from './useCourseList'

const log = createLogger('CourseIndexSearch')

/** How many course lookups run at once, so a 16-card page does not burst. */
const FILL_CONCURRENCY = 4

/** A card for one index row, before Yanhekt fills it. */
export function indexRowToCourse(row: CourseIndexRow, term: string): Course {
  const [schoolYear = '', semester = ''] = /^(\d{4}-\d{4})-([12])$/.exec(row.term ?? term)?.slice(1) ?? []
  return {
    id: String(row.id),
    title: row.name,
    number: row.number ?? undefined,
    instructor: row.teachers.join(', '),
    professors: [...row.teachers],
    time: '',
    school_year: schoolYear,
    semester,
  }
}

/**
 * Fill cards in place from `/v1/course`. `courses` are the reactive rows the
 * grid renders, so each assignment re-renders its card. `isCurrent` turns
 * false once a newer search replaced these rows; the fill then stops. A failed
 * lookup leaves that card as the index made it.
 */
export async function fillIndexCourses(
  courses: Course[],
  api: ApiClient,
  token: string,
  isCurrent: () => boolean,
): Promise<void> {
  let next = 0
  const worker = async (): Promise<void> => {
    while (next < courses.length && isCurrent()) {
      const course = courses[next++]
      try {
        const detail = await api.getCourseDetail(course.id, token)
        if (!isCurrent()) return
        if (detail.title_en) course.titleEn = detail.title_en
        if (!course.number && detail.number) course.number = detail.number
        const cover = detail.image_url?.trim()
        if (cover) course.imageUrl = cover
        if (detail.college_name) course.college_name = detail.college_name
        if (detail.professors && detail.professors.length > 0) {
          course.professors = [...detail.professors]
          course.instructor = detail.professors.join(', ')
        }
      } catch (error: unknown) {
        log.debug(`course ${course.id} detail failed:`, error)
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(FILL_CONCURRENCY, courses.length) }, worker))
}
