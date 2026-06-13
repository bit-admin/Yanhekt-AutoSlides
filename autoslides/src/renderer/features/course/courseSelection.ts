import type { LiveStream } from '@shared/services/apiClient'
import { DataStore } from '@shared/services/dataStore'
import { i18n } from '@shared/i18n'
import { navigationStore } from './navigationStore'
import { openPlaybackTab } from './tabStore'
import type { Course } from './useCourseList'

// Surface a native dialog when the manual playback-tab limit is reached.
const notifyManualTabLimit = (): void => {
  const t = i18n.global.t
  void window.electronAPI?.dialog?.showMessageBox?.({
    type: 'info',
    title: t('tabs.limitTitle'),
    message: t('tabs.limitMessage'),
    buttons: [t('titlebar.ok')],
  })
}

// Single entry point for opening a course from any surface (course grid,
// Home page rows, Search page results). Live courses open a playback tab
// directly (their stream data is staged in DataStore first); recorded courses
// go to the sessions list inside the Info tab, where picking a session opens
// the playback tab.
export const openCourse = (mode: 'live' | 'recorded', course: Course) => {
  if (mode === 'live') {
    const streamData: LiveStream = {
      id: course.id,
      title: course.title,
      subtitle: course.subtitle,
      status: course.status || 0,
      schedule_started_at: course.schedule_started_at || '',
      schedule_ended_at: course.schedule_ended_at || '',
      participant_count: course.participant_count,
      session: course.session,
      target: course.target,
      target_vga: course.target_vga
    }
    DataStore.setStreamData(course.id, streamData)

    const result = openPlaybackTab({
      mode: 'live',
      course,
      streamId: String(course.id),
      title: course.title,
      origin: 'manual',
    })
    if (!result.ok) notifyManualTabLimit()
    return
  }

  navigationStore.requestCourseOpen(mode, course)
}
