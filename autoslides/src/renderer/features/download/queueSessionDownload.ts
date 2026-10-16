import type { SessionDownloadInfo } from '@common/apiTypes'
import { lectureLabel } from '@common/lectureNaming'
import { DataStore } from '@shared/services/dataStore'
import { DownloadService, type DownloadItem, type DownloadQueueAddResult } from '@shared/services/downloadService'

/**
 * Queue one stream of a session resolved by id, exactly as a download started
 * from a course page: the session is written to DataStore as the course page's
 * `storeSessionData` does, then queued through `DownloadService.addToQueue` —
 * so dedupe, file naming, intranet host rewriting, the "prefer anonymous" flag,
 * auto-extraction and the queue UI all behave the same.
 *
 * Shared by the Download panel's session-id row and `autoslides download`.
 * `courseTitle` is the canonical Chinese title (it becomes the file name).
 */
export function queueSessionDownload(
  info: Pick<SessionDownloadInfo, 'session' | 'course'>,
  courseTitle: string,
  videoType: DownloadItem['videoType'],
): DownloadQueueAddResult {
  const { session, course } = info
  DataStore.setSessionDataWithCourse(session.session_id, session, {
    id: course.id,
    title: courseTitle,
    titleEn: course.titleEn,
    instructor: '',
    time: '',
    college_name: course.college_name,
    school_year: course.school_year,
    semester: course.semester != null ? String(course.semester) : undefined,
  })

  return DownloadService.addToQueue({
    name: `${videoType}_${lectureLabel(courseTitle, session.title)}`,
    courseTitle,
    sessionTitle: session.title,
    sessionId: session.session_id,
    courseId: course.id,
    videoType,
  })
}
