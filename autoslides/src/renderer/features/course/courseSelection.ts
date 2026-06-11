import type { LiveStream } from '@shared/services/apiClient'
import { DataStore } from '@shared/services/dataStore'
import { navigationStore } from './navigationStore'
import type { Course } from './useCourseList'

// Single entry point for opening a course from any surface (course grid,
// Home page rows, Search page results). Live courses need their stream data
// staged in DataStore before PlaybackPage mounts.
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
  }

  navigationStore.requestCourseOpen(mode, course)
}
