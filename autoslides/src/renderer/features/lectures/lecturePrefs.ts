// Session defaults for the Lectures rename modal. Not persisted to localStorage or AppConfig.

import type { LectureRenameOptions } from '@common/types'

export const DEFAULT_RENAME: LectureRenameOptions = {
  includeInstructor: false,
  includeSchoolYear: false,
  includeCollege: false,
  includeClassrooms: false,
}
