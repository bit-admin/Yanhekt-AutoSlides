// Demo bootstrap: the single place that turns demo mode on for a renderer.
//
// `installDemo()` is dynamically imported once per renderer entry
// (renderer.ts / tools.ts / addons.ts) behind `isDemoMode()`. It populates the
// generic override registry (@shared/overrideRegistry) from the demo data
// factories, paints the demo sidebar, and seeds the fake queues. Production code
// never imports this file — the dependency points inward (demo → shared), so
// deleting src/renderer/demo/ leaves the registry empty and the app on real
// behavior.

import { overrides } from '@shared/overrideRegistry'
import type { ApiTransport } from '@shared/services/apiClient'
import {
  DEMO_TOKEN,
  DEMO_DISPLAY_NAME,
  DEMO_EDIT_SLIDE_RECT,
  demoUser,
  demoSemesters,
  demoRecordedCourses,
  demoLiveCourses,
  demoCourseInfo,
  demoSavedSearchesLive,
  demoSavedSearchesRecorded,
  demoPosterDataUri,
  demoGallerySlides,
  demoResultImageDataUri,
  demoResultFolders,
  demoResultImages,
  demoTrashEntries,
  demoCropEntries,
} from './demoData'
import { seedDemoQueues } from './demoSeed'

const demoApiTransport: ApiTransport = {
  verifyToken: async () => ({ valid: true, userData: demoUser() }),
  getPersonalLiveList: async () => demoLiveCourses(),
  searchLiveList: async () => demoLiveCourses(),
  getCourseList: async () => demoRecordedCourses(),
  getPersonalCourseList: async () => demoRecordedCourses(),
  getCourseInfo: async (courseId: string) => demoCourseInfo(courseId),
  getAvailableSemesters: async () => demoSemesters(),
}

let installed = false

export function installDemo(): void {
  if (installed) return
  installed = true

  overrides.apiTransport = demoApiTransport
  overrides.authToken = () => DEMO_TOKEN
  overrides.greeting = () => `What's on your mind, ${DEMO_DISPLAY_NAME}?`
  overrides.savedSearches = {
    live: demoSavedSearchesLive,
    recorded: demoSavedSearchesRecorded,
  }
  overrides.resultsProvider = {
    getFolders: async () => demoResultFolders(),
    getImages: async (folderPath: string) => demoResultImages(folderPath),
    getTrashEntries: async () => demoTrashEntries(),
    getCropEntries: async () => demoCropEntries(),
  }
  overrides.resultImageSource = (item) => demoResultImageDataUri(item)
  overrides.cropDefaultRect = () => ({ ...DEMO_EDIT_SLIDE_RECT })
  overrides.playbackDemo = {
    poster: (kind) => demoPosterDataUri(kind),
    gallerySlides: () => demoGallerySlides(),
  }
  overrides.suppressRealWork = true

  // Demo disables macOS vibrancy (opaque window for clean captures); this class
  // lets CSS paint the sidebar a solid gray instead of the faint glass tint.
  document.documentElement.classList.add('demo-mode')

  // Fill the task/download right panel with finished fake items (no-op in the
  // tools/add-ons windows, which don't show those queues).
  seedDemoQueues()
}
