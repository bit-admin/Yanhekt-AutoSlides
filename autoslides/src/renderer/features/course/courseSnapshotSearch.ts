/**
 * Temporary: earlier-term search on the Search page from the course snapshot
 * bundled with the app (main `platform/courseSnapshot.ts`).
 *
 * The snapshot only knows a course's id, Chinese name and teachers, so each
 * card starts from those and is then filled from Yanhekt's `/v1/course`
 * (English name, cover, college, teachers). Opening a card goes through the
 * usual course page, which loads the session list by id.
 *
 * Delete this file with the snapshot once the course index replaces it.
 */

import type { ApiClient, CourseSnapshotRow } from '@shared/services/apiClient'
import { createLogger } from '@shared/utils/logger'
import type { Course } from './useCourseList'

const log = createLogger('CourseSnapshotSearch')

/** How many course lookups run at once, so a 16-card page does not burst. */
const FILL_CONCURRENCY = 4

/**
 * The snapshot's term key for a Search-page picker id. Earlier terms carry
 * `-(schoolYear * 10 + semester)` (see `termsThrough` in useSearchPage), so
 * -20231 is `2023-2024-1`.
 */
export function snapshotTermKey(pickerId: number): string | null {
  if (!Number.isInteger(pickerId) || pickerId >= 0) return null
  const code = -pickerId
  const schoolYear = Math.floor(code / 10)
  const semester = code % 10
  if (semester !== 1 && semester !== 2) return null
  return `${schoolYear}-${schoolYear + 1}-${semester}`
}

/** A card for one snapshot row, before Yanhekt fills it. */
export function snapshotRowToCourse(row: CourseSnapshotRow, term: string): Course {
  const [schoolYear = '', semester = ''] = /^(\d{4}-\d{4})-([12])$/.exec(term)?.slice(1) ?? []
  return {
    id: String(row.id),
    title: row.name,
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
 * lookup leaves that card as the snapshot made it.
 */
export async function fillSnapshotCourses(
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
