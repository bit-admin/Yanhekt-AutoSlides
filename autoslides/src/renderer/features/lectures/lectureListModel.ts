import { extractSessionLabel, SESSION_SUFFIX_PATTERN } from '@common/lectureNaming'
import { isLectureAudioExt } from '@common/lectureVideoNaming'
import type { LectureVideoItem } from './useLecturesPage'

interface LectureListSection {
  items: LectureVideoItem[]
  paths: string[]
  session?: { id: string; title: string; displayName: string }
}

export interface LectureListGroup {
  key: string
  courseId?: string
  courseName?: string
  paths: string[]
  sections: LectureListSection[]
}

const byName = new Intl.Collator('zh')
const byTitle = new Intl.Collator('zh', { numeric: true })

export type LectureListFileKind = 'screen' | 'slidesVideo' | 'camera' | 'audio' | 'subtitles' | 'slides' | 'other'

export function lectureListFileKind(item: LectureVideoItem): LectureListFileKind {
  if (item.slidesFolder) return 'slides'
  if (item.isSubtitle) return 'subtitles'
  if (item.videoType === 'slides') return 'slidesVideo'
  return item.videoType ?? (isLectureAudioExt(item.ext) ? 'audio' : 'other')
}

const fileOrder: Record<LectureListFileKind, number> = {
  screen: 0, slidesVideo: 1, camera: 2, audio: 3, subtitles: 4, slides: 5, other: 6,
}

function compareFiles(a: LectureVideoItem, b: LectureVideoItem): number {
  return fileOrder[lectureListFileKind(a)] - fileOrder[lectureListFileKind(b)]
    || byTitle.compare(a.name, b.name)
    || (a.path < b.path ? -1 : a.path > b.path ? 1 : 0)
}

function splitLectureLabel(displayName: string): { courseName: string; title: string } {
  const emby = displayName.match(/^(.+?) - ((?:S\d+(?:E\d+)?|E\d+)(?: - .+)?)$/i)
  if (emby) return { courseName: emby[1], title: emby[2] }
  const legacy = extractSessionLabel(displayName)
  if (legacy) {
    return {
      courseName: displayName.replace(SESSION_SUFFIX_PATTERN, '').replace(/_/g, ' '),
      title: legacy,
    }
  }
  const dash = displayName.indexOf(' - ')
  if (dash !== -1) return { courseName: displayName.slice(0, dash), title: displayName.slice(dash + 3) }
  return { courseName: displayName, title: displayName }
}

function flatGroup(key: string, items: LectureVideoItem[]): LectureListGroup {
  const paths = items.map((item) => item.path)
  return { key, paths, sections: [{ items, paths }] }
}

/** Unlike Library, List keeps every file, including multiple copies of one stream. */
export function buildLectureListGroups(files: LectureVideoItem[], groupByCourse: boolean): LectureListGroup[] {
  const recognised: LectureVideoItem[] = []
  const unrecognised: LectureVideoItem[] = []
  for (const file of files) {
    (file.recognised && file.courseId && file.sessionId ? recognised : unrecognised).push(file)
  }

  if (!groupByCourse) {
    return [
      ...(recognised.length ? [flatGroup('all-recognised', recognised.sort((a, b) =>
        byName.compare(a.displayName, b.displayName),
      ))] : []),
      ...(unrecognised.length ? [flatGroup('unrecognised', unrecognised)] : []),
    ]
  }

  const courses = new Map<string, Map<string, LectureVideoItem[]>>()
  for (const file of recognised) {
    const courseId = String(file.courseId)
    const sessionId = String(file.sessionId)
    let sessions = courses.get(courseId)
    if (!sessions) courses.set(courseId, (sessions = new Map()))
    let items = sessions.get(sessionId)
    if (!items) sessions.set(sessionId, (items = []))
    items.push(file)
  }

  const groups = Array.from(courses, ([courseId, sessions]): LectureListGroup => {
    const sections = Array.from(sessions, ([id, items]) => {
      items.sort(compareFiles)
      const displayName = items[0].displayName
      const { title } = splitLectureLabel(displayName)
      return { items, paths: items.map((item) => item.path), session: { id, title, displayName } }
    }).sort((a, b) => byTitle.compare(a.session.title, b.session.title)
      || byTitle.compare(a.session.id, b.session.id))

    return {
      key: `id:${courseId}`,
      courseId,
      courseName: splitLectureLabel(sections[0].session.displayName).courseName,
      paths: sections.flatMap(({ paths }) => paths),
      sections,
    }
  }).sort((a, b) => byName.compare(a.courseName ?? '', b.courseName ?? '')
    || byTitle.compare(a.key, b.key))

  if (unrecognised.length) {
    groups.push(flatGroup('unrecognised', unrecognised.sort((a, b) => byName.compare(a.name, b.name))))
  }
  return groups
}
