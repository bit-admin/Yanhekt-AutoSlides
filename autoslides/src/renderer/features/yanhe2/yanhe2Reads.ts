/**
 * The Yanhe 2.0 pages' reads, behind the same request cache the Yanhekt
 * transport uses (`@shared/services/requestCache`).
 *
 * Every read **coalesces**: a second identical call while one is in flight
 * joins it. The Curriculum's two lists are also reused for a minute, so going
 * back to the grid, or back into the same course, does not ask aita again. The
 * Calendar's day and week are join-only — their status chips (Live, Recorded)
 * change with the clock, and a revisit is meant to refresh them.
 *
 * Only an `ok` answer is ever memoized. `signed_out` / `network` / `failed`
 * resolve rather than reject, so they are carried out of the cache as a
 * rejection and turned back into the result here: Try Again always reaches
 * main, and a sign-in is never answered with a stale "signed out".
 *
 * Keys carry the account badge, and the main account's `tokenManager` clears
 * the whole cache on any identity change, so one account is never served
 * another's courses.
 */
import type {
  Yanhe2CalendarDay,
  Yanhe2DayQuery,
  Yanhe2ReadResult,
  Yanhe2ScheduleDay,
  Yanhe2WeekQuery,
} from '@common/yanhe2Calendar'
import type { Yanhe2Course, Yanhe2CourseDetail } from '@common/yanhe2Curriculum'
import { cached } from '@shared/services/requestCache'

const CURRICULUM_TTL_MS = 60 * 1000

/** Carries a non-`ok` result through `cached`, which only skips the memo on a rejection. */
class NotOk {
  constructor(readonly result: Yanhe2ReadResult<never>) {}
}

export async function readThroughCache<T>(
  key: string,
  ttlMs: number,
  fn: () => Promise<Yanhe2ReadResult<T>>,
): Promise<Yanhe2ReadResult<T>> {
  try {
    return await cached(`yanhe2|${key}`, ttlMs, async () => {
      const result = await fn()
      if (result.kind !== 'ok') throw new NotOk(result)
      return result
    })
  } catch (error) {
    if (error instanceof NotOk) return error.result
    throw error
  }
}

export const yanhe2Reads = {
  calendarDay: (account: string, query: Yanhe2DayQuery): Promise<Yanhe2ReadResult<Yanhe2CalendarDay>> =>
    readThroughCache(
      `day|${account}|${query.date}|${query.keyword ?? ''}|${query.periodId ?? ''}`,
      0,
      () => window.electronAPI.yanhe2.calendarDay(account, query),
    ),
  calendarWeek: (account: string, query: Yanhe2WeekQuery): Promise<Yanhe2ReadResult<Yanhe2ScheduleDay[]>> =>
    readThroughCache(
      `week|${account}|${query.startDate}|${query.endDate}`,
      0,
      () => window.electronAPI.yanhe2.calendarWeek(account, query),
    ),
  myCourses: (account: string): Promise<Yanhe2ReadResult<Yanhe2Course[]>> =>
    readThroughCache(`courses|${account}`, CURRICULUM_TTL_MS, () => window.electronAPI.yanhe2.myCourses(account)),
  courseDetail: (account: string, courseId: string): Promise<Yanhe2ReadResult<Yanhe2CourseDetail>> =>
    readThroughCache(
      `course|${account}|${courseId}`,
      CURRICULUM_TTL_MS,
      () => window.electronAPI.yanhe2.courseDetail(account, { courseId }),
    ),
}
