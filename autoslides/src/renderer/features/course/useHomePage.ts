import { ref } from 'vue'
import { ApiClient, type LiveListResponse, type CourseListResponse } from '@shared/services/apiClient'
import { tokenManager } from '@shared/services/authService'
import { transformLiveStreamToCourse, transformCourseDataToCourse, type Course } from './useCourseList'

const ROW_PAGE_SIZE = 16

export function useHomePage() {
  const apiClient = new ApiClient()

  const liveStreams = ref<Course[]>([])
  const recordings = ref<Course[]>([])
  const isLoadingLive = ref(false)
  const isLoadingRecorded = ref(false)
  const liveError = ref('')
  const recordedError = ref('')

  const loadLiveRow = async (token: string) => {
    isLoadingLive.value = true
    liveError.value = ''
    try {
      const response: LiveListResponse = await apiClient.getPersonalLiveList(token, 1, ROW_PAGE_SIZE)
      liveStreams.value = response.data.map(transformLiveStreamToCourse)
    } catch (error: any) {
      console.error('Failed to load personal live streams:', error)
      liveError.value = error.message || 'Failed to load live streams'
      liveStreams.value = []
    } finally {
      isLoadingLive.value = false
    }
  }

  const loadRecordedRow = async (token: string) => {
    isLoadingRecorded.value = true
    recordedError.value = ''
    try {
      const response: CourseListResponse = await apiClient.getPersonalCourseList(token, { page: 1, pageSize: ROW_PAGE_SIZE })
      recordings.value = response.data.map(transformCourseDataToCourse)
    } catch (error: any) {
      console.error('Failed to load personal recordings:', error)
      recordedError.value = error.message || 'Failed to load recordings'
      recordings.value = []
    } finally {
      isLoadingRecorded.value = false
    }
  }

  const loadPersonalRows = async () => {
    const token = tokenManager.getToken()
    if (!token) return
    await Promise.all([loadLiveRow(token), loadRecordedRow(token)])
  }

  const clearPersonalRows = () => {
    liveStreams.value = []
    recordings.value = []
    liveError.value = ''
    recordedError.value = ''
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
