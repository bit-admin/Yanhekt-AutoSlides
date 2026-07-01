/**
 * Reconstruct slide metadata from the AutoSlides Index lecture data the Cloud
 * Index webview already fetched while the user browsed (captured client-side via
 * a fetch hook — see CloudIndexTab). No network call happens here: the lecture
 * JSON is exactly the `/v2/api/lecture` response the embedded page pulled to
 * render the lecture view, reused when the user drills into one of its versions.
 */

import type { SlideMetadata } from '@common/slideMetadataTypes'
import { SLIDE_METADATA_VERSION } from '@common/slideMetadataTypes'

/** The `lecture` object from a `/v2/api/lecture` response (all fields optional). */
export interface CapturedLecture {
  courseId?: unknown
  courseTitle?: unknown
  sessionId?: unknown
  sessionTitle?: unknown
  instructor?: unknown
  professors?: unknown
  semester?: unknown
  schoolYear?: unknown
  college?: unknown
  weekNumber?: unknown
  day?: unknown
}

/** One entry of the `versions` array from a `/v2/api/lecture` response. */
export interface CapturedVersion {
  shareId?: unknown
  reviewed?: unknown
  edited?: unknown
  createdAt?: unknown
}

/** A whole captured `/v2/api/lecture` payload. */
export interface CapturedLectureData {
  lecture?: CapturedLecture
  versions?: CapturedVersion[]
}

function str(v: unknown): string | undefined {
  return v === null || v === undefined || v === '' ? undefined : String(v)
}
function num(v: unknown): number | undefined {
  return typeof v === 'number' && Number.isFinite(v) ? v : undefined
}
function strArr(v: unknown): string[] | undefined {
  return Array.isArray(v) && v.length > 0 ? v.map(String) : undefined
}

/**
 * Build a best-effort `SlideMetadata` from a captured lecture + the specific
 * version identified by `shareId`. Identity (course/session/instructor/term/
 * college) and review flags come straight from the index; extraction and
 * post-processing provenance aren't recorded there, so `extraction` is a neutral
 * placeholder timestamped at the version's publish time, `cropped` is false (the
 * index folds crop into `edited`), and `postProcessing` is omitted. Returns null
 * when no captured lecture or no version matches the share id.
 */
export function buildIndexMetadata(
  data: CapturedLectureData | null,
  shareId: string,
): SlideMetadata | null {
  const lecture = data?.lecture
  if (!lecture || !shareId) return null
  const version = (data?.versions ?? []).find((v) => String(v.shareId) === shareId)
  if (!version) return null

  const stamp = str(version.createdAt) ?? new Date().toISOString()
  const reviewed = !!version.reviewed
  const edited = !!version.edited
  return {
    version: SLIDE_METADATA_VERSION,
    kind: 'recorded',
    source: {
      courseId: str(lecture.courseId),
      courseTitle: str(lecture.courseTitle),
      sessionId: str(lecture.sessionId),
      sessionTitle: str(lecture.sessionTitle),
      instructor: str(lecture.instructor),
      professors: strArr(lecture.professors),
      semester: str(lecture.semester),
      schoolYear: str(lecture.schoolYear),
      college: str(lecture.college),
      weekNumber: num(lecture.weekNumber),
      day: num(lecture.day),
    },
    // The index doesn't record which extractor ran; 'builtin' is a neutral
    // placeholder and the publish time approximates the extraction time.
    extraction: { extractor: 'builtin', extractedAt: stamp },
    review: {
      reviewed,
      reviewedAt: reviewed ? stamp : null,
      edited,
      editedAt: edited ? stamp : null,
      cropped: false,
    },
    createdAt: stamp,
    updatedAt: stamp,
  }
}
