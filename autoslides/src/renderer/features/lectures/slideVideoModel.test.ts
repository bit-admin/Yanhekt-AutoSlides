import { describe, expect, it } from 'vitest'
import { formatLectureVideoDisplayName, isLectureSubtitleExt, parseLectureVideoName } from '@common/lectureVideoNaming'
import { slideVideoTargets } from './slideVideoModel'
import type { LectureVideoItem } from './useLecturesPage'

const file = (name: string, mtimeMs = 1): LectureVideoItem => {
  const parsed = parseLectureVideoName(name)
  return {
    ...parsed,
    name,
    path: `/out/${name}`,
    displayName: formatLectureVideoDisplayName(name),
    size: 1,
    mtimeMs,
    isSubtitle: isLectureSubtitleExt(parsed.ext),
  }
}
const folder = (name: string, hasTimeline = true, mtimeMs = 1): LectureVideoItem => ({
  ...file(name, mtimeMs),
  ext: '',
  slidesFolder: { imageCount: 3, hasTimeline },
})

describe('slideVideoTargets', () => {
  const slides = folder('slides_课程_第1周__c1s10')
  const screen = file('screen_课程_第1周__c1s10.mp4')
  const mic = file('课程_第1周__c1s10.aac')
  const subtitle = file('screen_课程_第1周__c1s10.srt')

  it('takes the session of any selected file, with its slides, screen and mic', () => {
    const files = [slides, screen, mic, subtitle]
    expect(slideVideoTargets(files, [subtitle.path])).toEqual({
      targets: [{
        key: '1:10',
        displayName: slides.displayName,
        slidesFolder: slides.path,
        screenPath: screen.path,
        micPath: mic.path,
      }],
      missingSlides: 0,
      missingAudio: 0,
    })
  })

  it('needs a timeline and some audio', () => {
    const noTimeline = folder('slides_课程_第2周__c1s20', false)
    const screen20 = file('screen_课程_第2周__c1s20.mp4')
    const slidesOnly = folder('slides_课程_第3周__c1s30')
    const cameraOnly = file('camera_课程_第3周__c1s30.mp4')
    const result = slideVideoTargets([noTimeline, screen20, slidesOnly, cameraOnly], [screen20.path, slidesOnly.path])
    expect(result.targets).toEqual([])
    expect(result).toMatchObject({ missingSlides: 1, missingAudio: 1 })
  })

  it('mic alone is enough, a slide video is not audio, and the recorded folder beats a live one', () => {
    const live = folder('slides_课程_第1周__c1s10l99', true, 5)
    const made = file('slides_课程_第1周__c1s10.mp4')
    const [target] = slideVideoTargets([live, slides, made, mic], [made.path]).targets
    expect(target).toMatchObject({ slidesFolder: slides.path, screenPath: null, micPath: mic.path })
  })
})
