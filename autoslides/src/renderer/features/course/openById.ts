import type { SessionDownloadInfo } from '@common/apiTypes'
import { i18n } from '@shared/i18n'
import { ApiClient } from '@shared/services/apiClient'
import { tokenManager } from '@shared/services/authService'
import { createLogger } from '@shared/utils/logger'
import { courseForSession } from './courseForSession'
import { notifyManualTabLimit, openCourse } from './courseSelection'
import { lookupCourseById } from './lookupCourseById'
import { navigationStore } from './navigationStore'
import { openPlaybackTab } from './tabStore'

const log = createLogger('OpenById')
const apiClient = new ApiClient()

export const notifyOpenById = (message: string): void => {
  void window.electronAPI.dialog?.showMessageBox?.({ type: 'info', message })
}

/**
 * Open a Yanhekt recorded course by id alone. The sessions page fills in the
 * rest, as it does for a pin with only an id.
 */
export function openCourseById(courseId: string): void {
  openCourse('recorded', { id: String(courseId), title: '', instructor: '', time: '' })
}

/**
 * Open a Yanhekt recorded session by id alone: session detail + `/v1/video`
 * (as the Download panel's session box does), its course filled from
 * `/v1/course` and the list lookup, then the course's sessions page with the
 * session playing in a tab on top. Returns false when it could not, after
 * telling the user. Shared by the Search page's "open by id" box and
 * `autoslides://session/<id>` links.
 */
export async function openSessionById(sessionId: string): Promise<boolean> {
  const t = i18n.global.t
  const token = tokenManager.getToken()
  if (!token) return false

  let resolved: SessionDownloadInfo
  try {
    resolved = await apiClient.getSessionDownloadInfo(sessionId, token)
  } catch (error) {
    // Not found, no recording yet and a network failure read the same to
    // the user; the detail goes to the log.
    log.warn('Session lookup failed:', sessionId, error)
    notifyOpenById(t('searchPage.openById.sessionFailed', { id: sessionId }))
    return false
  }

  const courseId = resolved.course.id
  const [info, list] = await Promise.all([
    apiClient.getCourseInfo(courseId, token).catch((error: unknown) => {
      log.warn('Course detail failed:', courseId, error)
      return null
    }),
    lookupCourseById(token, courseId),
  ])
  const course = courseForSession(resolved.course, info, list)

  // The sessions page underneath, so closing the player lands on the course.
  navigationStore.requestCourseOpen('recorded', course)
  const result = openPlaybackTab({
    mode: 'recorded',
    course,
    session: resolved.session,
    streamId: course.id,
    sessionId: resolved.session.session_id,
    title: resolved.session.title || course.title || t('navigation.recorded'),
    origin: 'manual',
  })
  if (!result.ok) notifyManualTabLimit()
  return true
}
