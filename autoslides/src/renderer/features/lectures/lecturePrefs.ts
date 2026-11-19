// Hardcoded session defaults for Lectures modals (Make Video's are
// DEFAULT_SLIDE_VIDEO_OPTIONS in @common/slideVideo) — same convention as Slides PDF
// export settings (usePdfMaker): options live only while the modal/session is open
// and are NOT persisted to localStorage or AppConfig.

import type { LectureRenameOptions } from '@common/types'

export const DEFAULT_RENAME: LectureRenameOptions = {
  includeInstructor: false,
  includeSchoolYear: false,
  includeCollege: false,
  includeClassrooms: false,
  renameSubtitles: true,
}
