// Which selected sessions can make a slide video (Lectures → Make Video).
//
// A slide video needs the session's slides (a `slides_*` folder with
// timeline.json, from the built-in extractor, the Extractor or Yanhe 2.0) and
// its sound: the screen recording or the classroom mic `.aac` on disk.
// Selecting any file of a session selects that session.

import { isLectureAudioExt, isLectureVideoExt } from '@common/lectureVideoNaming'
import type { SlideVideoTarget } from '@shared/services/slideVideoQueue'
import type { LectureVideoItem } from './useLecturesPage'

export type { SlideVideoTarget }

export interface SlideVideoSelection {
  targets: SlideVideoTarget[]
  /** Selected sessions without a slides folder that has a timeline. */
  missingSlides: number
  /** Selected sessions with slides but neither a screen recording nor mic audio. */
  missingAudio: number
  /** Selected files that cannot be matched to a lecture session. */
  unlinkedFiles: number
}

const newest = (a: LectureVideoItem | undefined, b: LectureVideoItem): LectureVideoItem =>
  !a || b.mtimeMs > a.mtimeMs ? b : a

/** A recorded extraction beats a live one (`…l<id>`) of the same session, then the newer wins. */
const betterFolder = (a: LectureVideoItem | undefined, b: LectureVideoItem): LectureVideoItem =>
  a && Boolean(a.liveId) !== Boolean(b.liveId) ? (a.liveId ? b : a) : newest(a, b)

const sessionKey = (item: LectureVideoItem): string | null =>
  item.recognised && item.courseId && item.sessionId ? `${String(item.courseId)}:${String(item.sessionId)}` : null

export function slideVideoTargets(files: LectureVideoItem[], selectedPaths: string[]): SlideVideoSelection {
  const selected = new Set(selectedPaths)
  const wanted = new Set<string>()
  let unlinkedFiles = 0
  for (const item of files) {
    if (!selected.has(item.path)) continue
    const key = sessionKey(item)
    if (key) wanted.add(key)
    else unlinkedFiles += 1
  }

  const sessions = new Map<string, { folder?: LectureVideoItem; screen?: LectureVideoItem; mic?: LectureVideoItem }>()
  for (const item of files) {
    const key = sessionKey(item)
    if (!key || !wanted.has(key)) continue
    const session = sessions.get(key) ?? {}
    sessions.set(key, session)
    if (item.slidesFolder) {
      if (!item.slidesFolder.hasTimeline) continue
      session.folder = betterFolder(session.folder, item)
    } else if (item.isSubtitle) {
      continue
    } else if (item.videoType === 'screen' && isLectureVideoExt(item.ext)) {
      session.screen = newest(session.screen, item)
    } else if (item.videoType === 'audio' || (!item.videoType && isLectureAudioExt(item.ext))) {
      session.mic = newest(session.mic, item)
    }
  }

  const result: SlideVideoSelection = { targets: [], missingSlides: 0, missingAudio: 0, unlinkedFiles }
  for (const [key, session] of sessions) {
    if (!session.folder) result.missingSlides += 1
    else if (!session.screen && !session.mic) result.missingAudio += 1
    else {
      result.targets.push({
        key,
        displayName: session.folder.displayName,
        slidesFolder: session.folder.path,
        screenPath: session.screen?.path ?? null,
        micPath: session.mic?.path ?? null,
      })
    }
  }
  return result
}
