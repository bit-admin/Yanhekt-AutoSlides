import { ref, watch } from 'vue'
import { ApiClient, type LiveListResponse, type CourseListResponse } from '@shared/services/apiClient'
import { tokenManager } from '@shared/services/authService'
import { transformLiveStreamToCourse, transformCourseDataToCourse, type Course } from './useCourseList'
import { hydrateLiveTitles } from './liveCourseTitles'
import { getCurrentLocale } from '@shared/i18n'
import { createLatest } from '@shared/utils/latest'
import { createLogger } from '@shared/utils/logger';
const log = createLogger('HomePage');

const ROW_PAGE_SIZE = 16

export function useHomePage() {
  const apiClient = new ApiClient()

  const liveStreams = ref<Course[]>([])
  const recordings = ref<Course[]>([])

  // Home only loads once per user, so a language switch would otherwise leave
  // the live row on its Chinese titles for the rest of the session.
  watch(getCurrentLocale, () => void hydrateLiveTitles(liveStreams.value))
  const isLoadingLive = ref(false)
  const isLoadingRecorded = ref(false)
  const liveError = ref('')
  const recordedError = ref('')

  // The rows belong to one load: the account they were asked for. A newer load
  // or a clear (account switch, sign-out) makes an older answer write nothing:
  // not its rows, not its error, not the end of a spinner that is not its own.
  const rowsLoad = createLatest()

  const loadLiveRow = async (token: string, current: () => boolean) => {
    isLoadingLive.value = true
    liveError.value = ''
    try {
      const response: LiveListResponse = await apiClient.getPersonalLiveList(token, 1, ROW_PAGE_SIZE)
      if (!current()) return
      liveStreams.value = (response?.data ?? []).map(transformLiveStreamToCourse)
      // Live rows have no name_en — fill it per course, in the background.
      void hydrateLiveTitles(liveStreams.value)
    } catch (error: unknown) {
      log.error('Failed to load personal live streams:', error)
      if (!current()) return
      liveError.value = (error instanceof Error && error.message) || 'Failed to load live streams'
      liveStreams.value = []
    } finally {
      if (current()) isLoadingLive.value = false
    }
  }

  const loadRecordedRow = async (token: string, current: () => boolean) => {
    isLoadingRecorded.value = true
    recordedError.value = ''
    try {
      const response: CourseListResponse = await apiClient.getPersonalCourseList(token, { page: 1, pageSize: ROW_PAGE_SIZE })
      if (!current()) return
      recordings.value = (response?.data ?? []).map(transformCourseDataToCourse)
    } catch (error: unknown) {
      log.error('Failed to load personal recordings:', error)
      if (!current()) return
      recordedError.value = (error instanceof Error && error.message) || 'Failed to load recordings'
      recordings.value = []
    } finally {
      if (current()) isLoadingRecorded.value = false
    }
  }

  const loadPersonalRows = async () => {
    const token = tokenManager.getToken()
    if (!token) return
    const current = rowsLoad.begin()
    await Promise.all([loadLiveRow(token, current), loadRecordedRow(token, current)])
  }

  const clearPersonalRows = () => {
    rowsLoad.cancel()
    liveStreams.value = []
    recordings.value = []
    liveError.value = ''
    recordedError.value = ''
    // The load that owned the spinners can no longer end them.
    isLoadingLive.value = false
    isLoadingRecorded.value = false
  }

  return {
    liveStreams,
    recordings,
    isLoadingLive,
    isLoadingRecorded,
    liveError,
    recordedError,
    loadPersonalRows,
    clearPersonalRows
  }
}
