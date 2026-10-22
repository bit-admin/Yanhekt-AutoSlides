import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { parseYanhektIdInput, type YanhektIdKind } from '@common/sessionInput'
import type { SessionDownloadInfo } from '@common/apiTypes'
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

/**
 * The Search page's "open by id" box (Yanhekt recorded). A course id opens
 * that course's sessions page, the same way a pin with only an id does. A
 * session id is looked up on its own (session detail + `/v1/video`, as the
 * Download panel's session box does), then opens its course's sessions page
 * with the session playing in a tab on top.
 */
export function useOpenById() {
  const { t } = useI18n()

  const kind = ref<YanhektIdKind>('course')
  const input = ref('')
  const busy = ref(false)

  const notify = (message: string): void => {
    void window.electronAPI.dialog?.showMessageBox?.({ type: 'info', message })
  }

  const openSession = async (sessionId: string): Promise<void> => {
    const token = tokenManager.getToken()
    if (!token) return
    busy.value = true
    try {
      let resolved: SessionDownloadInfo
      try {
        resolved = await apiClient.getSessionDownloadInfo(sessionId, token)
      } catch (error) {
        // Not found, no recording yet and a network failure read the same to
        // the user; the detail goes to the log.
        log.warn('Session lookup failed:', sessionId, error)
        notify(t('searchPage.openById.sessionFailed', { id: sessionId }))
        return
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
      input.value = ''
    } finally {
      busy.value = false
    }
  }

  const submit = async (): Promise<void> => {
    if (busy.value) return
    const parsed = parseYanhektIdInput(input.value, kind.value)
    if (parsed.kind === 'empty') return
    if (parsed.kind === 'invalid') {
      notify(t('searchPage.openById.invalid'))
      return
    }
    if (parsed.kind === 'course') {
      // A bare id; the sessions page fills in the rest, like an id-only pin.
      openCourse('recorded', { id: parsed.courseId, title: '', instructor: '', time: '' })
      input.value = ''
      return
    }
    await openSession(parsed.sessionId)
  }

  return { kind, input, busy, submit }
}
