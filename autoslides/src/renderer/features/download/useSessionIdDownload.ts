import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { parseSessionInput } from '@common/sessionInput'
import { lectureLabel } from '@common/lectureNaming'
import { ApiClient } from '@shared/services/apiClient'
import { tokenManager } from '@shared/services/authService'
import { DataStore } from '@shared/services/dataStore'
import { DownloadService, type DownloadItem } from '@shared/services/downloadService'
import { createLogger } from '@shared/utils/logger'
const log = createLogger('SessionIdDownload')

export type SessionIdDownloadType = DownloadItem['videoType']

const apiClient = new ApiClient()

/**
 * The Download panel's "download by session id or URL" row.
 *
 * Signed-in only, like every download. A known session is enough to find
 * the recording: session detail by id and `GET /v1/video` are both
 * anonymous-ok, so this path never needs the course's session list. The resolved session is written to DataStore exactly as the
 * course page's `storeSessionData` does, and then queued through the ordinary
 * `DownloadService.addToQueue` — so dedupe, file naming, intranet host
 * rewriting, the "prefer anonymous" flag, auto-extraction and the queue UI all
 * behave as for a download started from a course page.
 */
export function useSessionIdDownload() {
  const { t } = useI18n()

  const input = ref('')
  const videoType = ref<SessionIdDownloadType>('screen')
  const busy = ref(false)

  // Same app dialog as the course page's queue notices.
  const notify = (message: string): void => {
    void window.electronAPI.dialog?.showMessageBox?.({ type: 'info', message })
  }

  const submit = async (): Promise<void> => {
    if (busy.value) return

    const parsed = parseSessionInput(input.value)
    if (parsed.kind === 'empty') return
    if (parsed.kind === 'course') {
      notify(t('downloads.bySession.courseNotSession'))
      return
    }
    if (parsed.kind === 'invalid') {
      notify(t('downloads.bySession.invalid'))
      return
    }

    // Downloading is a signed-in feature. The lookup hops may still go out
    // without a Bearer (Settings → Network "prefer anonymous"), but that is a
    // request-level choice, not permission to download while signed out.
    const token = tokenManager.getToken()
    if (!token) {
      notify(t('downloads.bySession.signInRequired'))
      return
    }

    busy.value = true
    try {
      const info = await apiClient.getSessionDownloadInfo(parsed.sessionId, token)
      const { session, course } = info
      const type = videoType.value

      if (type === 'audio' && !info.audioUrl) {
        notify(t('sessions.noMicAudio'))
        return
      }
      if (type !== 'audio' && !(type === 'camera' ? session.main_url : session.vga_url)) {
        notify(t('downloads.bySession.noStream'))
        return
      }

      const courseTitle = course.title || t('sessions.unknownCourse')
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

      const result = DownloadService.addToQueue({
        name: `${type}_${lectureLabel(courseTitle, session.title)}`,
        courseTitle,
        sessionTitle: session.title,
        sessionId: session.session_id,
        courseId: course.id,
        videoType: type,
      })

      if (!result.added) {
        notify(type === 'screen'
          ? t('sessions.alreadyInDownloadQueueScreen')
          : type === 'audio'
            ? t('sessions.alreadyInDownloadQueueAudio')
            : t('sessions.alreadyInDownloadQueue'))
        window.dispatchEvent(new CustomEvent('switchToDownload', { detail: result.existingItem.id }))
        return
      }

      input.value = ''
      window.dispatchEvent(new CustomEvent('switchToDownload', { detail: result.item.id }))
    } catch (error) {
      // Not found, no recording yet and network failure all read the same to
      // the user; the detail goes to the log.
      log.warn('Session lookup failed:', error)
      notify(t('downloads.bySession.failed', { id: parsed.sessionId }))
    } finally {
      busy.value = false
    }
  }

  return { input, videoType, busy, submit }
}
