import type { LiveStream } from '@shared/services/apiClient'
import { i18n } from '@shared/i18n'
import { navigationStore } from './navigationStore'
import { openPlaybackTab } from './tabStore'
import type { Course } from './useCourseList'

// Surface a native dialog when the manual playback-tab limit is reached.
export const notifyManualTabLimit = (): void => {
  const t = i18n.global.t
  void window.electronAPI?.dialog?.showMessageBox?.({
    type: 'info',
    title: t('tabs.limitTitle'),
    message: t('tabs.limitMessage'),
    buttons: [t('titlebar.ok')],
  })
}

/** The live stream a live course row stands for, as the player asks main to resolve it. */
export const liveStreamOf = (course: Course): LiveStream => ({
  id: course.id,
  title: course.title,
  subtitle: course.subtitle,
  status: course.status || 0,
  schedule_started_at: course.schedule_started_at || '',
  schedule_ended_at: course.schedule_ended_at || '',
  participant_count: course.participant_count,
  session: course.session,
  target: course.target,
  target_vga: course.target_vga,
  target_room: course.target_room,
})

// Single entry point for opening a course from any surface (course grid,
// Home page rows, Search page results). Live courses open a playback tab
// directly (the player builds the stream from the tab's course); recorded courses
// go to the sessions list inside the Info tab, where picking a session opens
// the playback tab.
export const openCourse = (mode: 'live' | 'recorded', course: Course) => {
  if (mode === 'live') {
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
