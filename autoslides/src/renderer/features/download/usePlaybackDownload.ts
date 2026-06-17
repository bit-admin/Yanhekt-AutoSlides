import { computed, type Ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { DownloadService } from '@shared/services/downloadService'
import type { Course, Session } from '@features/video/useSlideExtraction'

export interface UsePlaybackDownloadOptions {
  mode: 'live' | 'recorded'
  course: Ref<Course | null>
  session: Ref<Session | null>
  sessionId?: string
  isDualStreamSelected: Ref<boolean>
  isScreenRecordingSelected: Ref<boolean>
}

export interface UsePlaybackDownloadReturn {
  canDownload: Ref<boolean>
  downloadCurrentStream: () => void
}

// Download the recording shown in a playback tab, so the user no longer has to
// go back to the session list to start a download. Mirrors the session-list
// path (DownloadService.addToQueue keyed by sessionId) — downloads the currently
// selected stream, or both streams when "Both Streams" is active. Recorded mode
// only; the session data is already in DataStore from when the tab was opened.
export function usePlaybackDownload(options: UsePlaybackDownloadOptions): UsePlaybackDownloadReturn {
  const { mode, course, session, sessionId, isDualStreamSelected, isScreenRecordingSelected } = options
  const { t } = useI18n()

  const canDownload = computed(() => mode === 'recorded')

  const downloadCurrentStream = (): void => {
    const currentSession = session.value
    if (mode !== 'recorded' || !currentSession) return

    const resolvedSessionId = sessionId || currentSession.session_id
    if (!resolvedSessionId) return

    const courseTitle = course.value?.title || t('sessions.unknownCourse')
    const videoTypes: Array<'camera' | 'screen'> = isDualStreamSelected.value
      ? ['camera', 'screen']
      : [isScreenRecordingSelected.value ? 'screen' : 'camera']

    let firstAddedId: string | undefined
    for (const videoType of videoTypes) {
      const result = DownloadService.addToQueue({
        name: `${videoType}_${courseTitle}_${currentSession.title}`,
        courseTitle,
        sessionTitle: currentSession.title,
        sessionId: String(resolvedSessionId),
        videoType
      })
      if (result.added && !firstAddedId) firstAddedId = result.item.id
    }

    if (!firstAddedId) {
      alert(videoTypes.length > 1
        ? t('sessions.allInDownloadQueue')
        : videoTypes[0] === 'screen'
          ? t('sessions.alreadyInDownloadQueueScreen')
          : t('sessions.alreadyInDownloadQueue'))
      return
    }

    // Surface the download queue (RightPanel listens for this window event).
    window.dispatchEvent(new CustomEvent('switchToDownload', { detail: firstAddedId }))
  }

  return { canDownload, downloadCurrentStream }
}
