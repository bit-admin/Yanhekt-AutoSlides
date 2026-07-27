// Hardcoded session defaults for Lectures modals — same convention as Slides PDF
// export settings (usePdfMaker): options live only while the modal/session is open
// and are NOT persisted to localStorage or AppConfig.

import type { LectureCompressDefaults, LectureRenameOptions } from '@common/types'

export const DEFAULT_COMPRESS: LectureCompressDefaults = {
  preset: 'small',
  audioPreset: 'mid',
  audioFilterPreset: 'speech',
  cropMode: 'none',
  filterMode: 'none',
  scaler: 'lanczos',
  container: 'mp4',
  opusVbr: 'constrained',
  opusFrameDuration: 60,
  keepAac: false,
  x265Params: 'aq-mode=1',
}

export const DEFAULT_RENAME: LectureRenameOptions = {
  includeInstructor: false,
  includeSchoolYear: false,
  includeCollege: false,
  includeClassrooms: false,
}
