import { describe, expect, it } from 'vitest'
import { formatLectureVideoDisplayName, isLectureSubtitleExt, parseLectureVideoName } from '@common/lectureVideoNaming'
import { buildLectureListGroups } from './lectureListModel'

const file = (name: string) => {
  const parsed = parseLectureVideoName(name)
  return {
    ...parsed,
    name,
    path: `/lectures/${name}`,
    displayName: formatLectureVideoDisplayName(name),
    size: 1,
    mtimeMs: 1,
    isSubtitle: isLectureSubtitleExt(parsed.ext),
  }
}

const stem = '测试_课程_第1周_星期三_第2大节'
const legacy = (prefix: string, tail: string) => file(`${prefix}${stem}__c101s201${tail}`)

describe('buildLectureListGroups', () => {
  it('keeps every file in a fixed order within its session, independent of scan order', () => {
    const screen = legacy('screen_', '.mp4')
    const copy = legacy('screen_', '.mkv')
    const slideVideo = legacy('slides_', '.mp4')
    const camera = legacy('camera_', '.mp4')
    const mic = legacy('', '.aac')
    const subtitles = legacy('screen_', '.srt')
    const slides = { ...legacy('slides_', ''), slidesFolder: { imageCount: 4, hasTimeline: true } }
    const other = legacy('', '.mp4')
    const files = [mic, slides, copy, subtitles, other, slideVideo, camera, screen]
    const expected = [copy, screen, slideVideo, camera, mic, subtitles, slides, other]

    for (const rows of [files, [...files].reverse()]) {
      const [group] = buildLectureListGroups(rows, true)
      expect(group.courseName).toBe('测试 课程')
      expect(group.sections).toEqual([{
        items: expected,
        paths: expected.map((item) => item.path),
        session: { id: '201', title: '第1周 星期三 第2大节', displayName: stem },
      }])
    }
    expect(files[0]).toBe(mic)
  })

  it('groups by both IDs even when filenames use different styles or share a session ID', () => {
    const screen = legacy('screen_', '.mp4')
    const renamed = file('测试课程 - S01E01 - 第一讲 [yhid=c101s201] [vtype=camera].mp4')
    const later = file('测试课程 - S01E02 - 第二讲 [yhid=c101s202] [vtype=screen].mp4')
    const other = file('另一门课 - S01E01 - 第一讲 [yhid=c102s201] [vtype=screen].mp4')
    const groups = buildLectureListGroups([other, renamed, later, screen], true)
    const course = groups.find((g) => g.courseId === '101')!

    expect(course.sections).toHaveLength(2)
    expect(course.sections.find((s) => s.session?.id === '201')?.paths).toEqual([screen.path, renamed.path])
    expect(course.sections.find((s) => s.session?.id === '202')?.session?.title).toBe('S01E02 - 第二讲')
    expect(course.paths).toHaveLength(3)
    expect(groups.find((g) => g.courseId === '102')?.paths).toEqual([other.path])
  })

  it('leaves missing IDs outside session boxes and preserves the flat view', () => {
    const known = legacy('screen_', '.mp4')
    const courseOnly = file('screen_test__c101.mp4')
    const unknown = file('random.mp4')
    const files = [known, courseOnly, unknown]

    const grouped = buildLectureListGroups(files, true)
    expect(grouped.at(-1)?.key).toBe('unrecognised')
    expect(grouped.at(-1)?.sections[0]).toEqual({ items: [unknown, courseOnly], paths: [unknown.path, courseOnly.path] })

    const flat = buildLectureListGroups(files, false)
    expect(flat.map((g) => g.key)).toEqual(['all-recognised', 'unrecognised'])
    expect(flat.flatMap((g) => g.sections).every((s) => !s.session)).toBe(true)
    expect(flat.flatMap((g) => g.paths)).toEqual(files.map((item) => item.path))
  })
})
