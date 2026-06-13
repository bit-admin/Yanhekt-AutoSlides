import { reactive } from 'vue'
import { ApiClient } from '@shared/services/apiClient'
import { tokenManager } from '@shared/services/authService'
import type { Course } from './useCourseList'

// Lazy screen-recording previews for the Home page rows. Keyed by course id and
// shared across the module so a card only generates its preview once per session
// (re-scrolling doesn't refetch). Recorded previews are additionally cached to
// disk by the main process (keyed on the session video_id).
const apiClient = new ApiClient()
const thumbnails = reactive<Record<string, string>>({})
const inFlight = new Set<string>()

async function loadThumbnail(mode: 'live' | 'recorded', course: Course): Promise<void> {
  const id = course.id
  if (!id || thumbnails[id] || inFlight.has(id)) return

  const token = tokenManager.getToken()
  if (!token) return

  inFlight.add(id)
  try {
    let screenUrl: string | undefined
    let seekSeconds = 0
    let cacheKey = id

    if (mode === 'live') {
      // Only currently-live streams (status 1) have a fetchable frame. Upcoming
      // (2) / ended (0) still carry a target_vga url that 404s — fetching it
      // would also poison the intranet IP round-robin via markIPFailed.
      if (course.status !== 1) return
      screenUrl = course.target_vga
      seekSeconds = 0
      cacheKey = id
    } else {
      // Recorded: preview the latest session's screen recording at 1 min in.
      const info = await apiClient.getCourseInfo(id, token)
      const sessions = info.videos || []
      const last = sessions[sessions.length - 1]
      if (!last?.vga_url) return
      screenUrl = last.vga_url
      seekSeconds = 60
      cacheKey = last.video_id || id
    }

    if (!screenUrl) return

    const dataUrl = await window.electronAPI.video.getScreenThumbnail({
      kind: mode,
      screenUrl,
      seekSeconds,
      cacheKey,
      token
    })

    if (dataUrl) {
      thumbnails[id] = dataUrl
    }
  } catch (error) {
    console.warn('Failed to load home thumbnail:', error)
  } finally {
    inFlight.delete(id)
  }
}

function clearThumbnails(): void {
  for (const key of Object.keys(thumbnails)) delete thumbnails[key]
  inFlight.clear()
}

export function useHomeThumbnails() {
  return { thumbnails, loadThumbnail, clearThumbnails }
}
