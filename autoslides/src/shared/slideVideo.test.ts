import { describe, expect, it } from 'vitest'
import {
  DEFAULT_SLIDE_VIDEO_OPTIONS,
  lastFfmpegTime,
  parseFfmpegProbe,
  planSlideVideo,
  slideVideoCanvas,
  slideVideoConcatList,
  slideVideoFfmpegArgs,
  slideVideoMetadata,
  slideVideoOrigin,
  slideVideoSegments,
  sortSlideImages,
} from './slideVideo'
import type { SlideTimeline } from './sidecars/timeline'

const event = (id: string, changeAt: number, initialFile: string | null) => ({ id, changeAt, confirmedAt: changeAt + 1, initialFile })

function timeline(parts: Partial<SlideTimeline>): SlideTimeline {
  return { version: 1, extractor: 'builtin', createdAt: '', updatedAt: '', events: [], resolutions: {}, ...parts }
}

describe('slideVideoSegments', () => {
  it('holds the previous slide over gaps and missing files, follows duplicates, skips repeats', () => {
    const t = timeline({
      events: [
        event('e3', 30, 'Slide_3.png'),
        event('e1', 10, 'Slide_1.png'),
        event('e2', 20, 'Slide_2.png'),
        event('e4', 40, 'Slide_4.png'),
        event('e5', 50, 'Slide_5.png'),
        event('e6', 60, null),
      ],
      resolutions: {
        e1: { state: 'canonical', file: 'Slide_1.png' },
        e2: { state: 'gap', gapReason: 'ai_filtered' },
        e3: { state: 'duplicate', duplicateOf: 'Slide_1.png' },
        e4: { state: 'canonical', file: 'Slide_4.png' },
        e5: { state: 'canonical', file: 'Slide_gone.png' },
        e6: { state: 'gap', gapReason: 'unstable' },
      },
    })
    const present = new Set(['Slide_1.png', 'Slide_4.png'])
    expect(slideVideoSegments(t, (f) => present.has(f))).toEqual([
      { start: 10, file: 'Slide_1.png' },
      { start: 40, file: 'Slide_4.png' },
    ])
  })

  it('shows black until the first real slide when the opening ones were removed', () => {
    const t = timeline({
      events: [event('a', 5, 'Slide_a.png'), event('b', 25, 'Slide_b.png')],
      resolutions: { a: { state: 'gap', gapReason: 'exclusion' } },
    })
    expect(slideVideoSegments(t, () => true)).toEqual([
      { start: 5, file: null },
      { start: 25, file: 'Slide_b.png' },
    ])
  })
})

describe('slideVideoOrigin', () => {
  it('subtracts the Extractor 2.1.0 start time only for Extractor timelines', () => {
    expect(slideVideoOrigin(timeline({ extractor: 'qt', source: { path: '/v.mp4', startTime: 1.4 } }))).toBe(1.4)
    expect(slideVideoOrigin(timeline({ extractor: 'qt' }))).toBe(0)
    expect(slideVideoOrigin(timeline({ extractor: 'builtin', source: { startTime: 3 } }))).toBe(0)
  })
})

describe('planSlideVideo', () => {
  const pages = sortSlideImages(['Slide_10.png', 'Slide_2.png', 'notes.txt', 'Slide_1.png'])

  it('sorts pages naturally and keeps only slide images', () => {
    expect(pages).toEqual(['Slide_1.png', 'Slide_2.png', 'Slide_10.png'])
  })

  it('starts the first slide at 0, repeats held slides and ends with the audio', () => {
    const plan = planSlideVideo({
      segments: [{ start: 12, file: 'Slide_1.png' }, { start: 300, file: 'Slide_10.png' }],
      origin: 2,
      endSeconds: 400,
      pages,
      repeatSeconds: 120,
    })
    expect(plan.entries).toEqual([
      { segment: 0, startMs: 0, durationMs: 120_000 },
      { segment: 0, startMs: 120_000, durationMs: 120_000 },
      { segment: 0, startMs: 240_000, durationMs: 58_000 },
      { segment: 1, startMs: 298_000, durationMs: 102_000 },
    ])
    expect(plan.chapters).toEqual([
      { startMs: 0, endMs: 298_000, title: 'Slide 1' },
      { startMs: 298_000, endMs: 400_000, title: 'Slide 3' },
    ])
    expect(plan.durationSeconds).toBe(400)
  })

  it('drops slides after the audio ends and gives no chapter to black', () => {
    const plan = planSlideVideo({
      segments: [{ start: 0, file: null }, { start: 10, file: 'Slide_1.png' }, { start: 500, file: 'Slide_2.png' }],
      origin: 0,
      endSeconds: 60,
      pages,
      repeatSeconds: 0,
    })
    expect(plan.entries.map((e) => [e.segment, e.startMs, e.durationMs])).toEqual([[0, 0, 10_000], [1, 10_000, 50_000]])
    expect(plan.chapters).toEqual([{ startMs: 10_000, endMs: 60_000, title: 'Slide 1' }])
  })

  it('holds the last slide when the length is unknown', () => {
    const plan = planSlideVideo({ segments: [{ start: 30, file: 'Slide_1.png' }], origin: 0, endSeconds: null, pages, repeatSeconds: 0 })
    expect(plan.durationSeconds).toBe(40)
  })

  it('has nothing to encode without a slide', () => {
    expect(planSlideVideo({ segments: [{ start: 0, file: null }], origin: 0, endSeconds: 10, pages }).entries).toEqual([])
  })
})

describe('FFmpeg inputs', () => {
  it('lists the last image twice and quotes paths', () => {
    const text = slideVideoConcatList(
      [{ segment: 0, startMs: 0, durationMs: 1500 }, { segment: 1, startMs: 1500, durationMs: 250 }],
      (i) => (i === 0 ? "/out/slides_O'Brien/Slide_1.png" : '/out/b.png'),
    )
    expect(text).toBe([
      'ffconcat version 1.0',
      "file '/out/slides_O'\\''Brien/Slide_1.png'",
      'duration 1.500',
      "file '/out/b.png'",
      'duration 0.250',
      "file '/out/b.png'",
      '',
    ].join('\n'))
  })

  it('escapes metadata', () => {
    expect(slideVideoMetadata('a=b;c', [{ startMs: 0, endMs: 5, title: 'Slide 1' }])).toBe(
      ';FFMETADATA1\ntitle=a\\=b\\;c\n[CHAPTER]\nTIMEBASE=1/1000\nSTART=0\nEND=5\ntitle=Slide 1\n',
    )
  })

  it('takes the most common slide size, never upscales, keeps it even', () => {
    const sizes = [{ width: 1440, height: 1080 }, { width: 1440, height: 1080 }, { width: 1920, height: 1080 }]
    expect(slideVideoCanvas(sizes, '720')).toEqual({ width: 960, height: 720 })
    expect(slideVideoCanvas([{ width: 1281, height: 721 }], '1080')).toEqual({ width: 1280, height: 720 })
    expect(slideVideoCanvas([], 'source')).toEqual({ width: 1920, height: 1080 })
  })

  it('encodes H.264 slides with Opus speech audio and the metadata file', () => {
    const args = slideVideoFfmpegArgs({
      concatPath: '/t/s.ffconcat',
      audioPath: '/out/mic.aac',
      metadataPath: '/t/m.txt',
      outputPath: '/out/.x.partial.mp4',
      width: 1440,
      height: 1080,
      durationSeconds: 5400.25,
      options: DEFAULT_SLIDE_VIDEO_OPTIONS,
    })
    const after = (flag: string) => args[args.indexOf(flag) + 1]
    expect(args.filter((a, i) => args[i - 1] === '-i')).toEqual(['/t/s.ffconcat', '/out/mic.aac', '/t/m.txt'])
    expect(after('-map_chapters')).toBe('2')
    expect(after('-c:v')).toBe('libx264')
    expect(after('-crf')).toBe('23')
    expect(after('-c:a')).toBe('libopus')
    expect(after('-b:a')).toBe('16k')
    expect(after('-af')).toMatch(/speechnorm.*,aresample=async=1:min_hard_comp=0\.01:first_pts=0$/)
    expect(after('-t')).toBe('5400.250')
    expect(args.at(-1)).toBe('/out/.x.partial.mp4')
  })

  it('reads the probe header and progress', () => {
    const stderr = [
      "Input #0, mov,mp4,m4a,3gp,3g2,mj2, from 'x.mp4':",
      '  Duration: 01:39:00.12, start: 0.000000, bitrate: 400 kb/s',
      '  Stream #0:0[0x1](und): Video: h264 (High)',
      '  Stream #0:1[0x2](und): Audio: aac (LC) (mp4a / 0x6134706D), 44100 Hz, mono',
    ].join('\n')
    expect(parseFfmpegProbe(stderr)).toEqual({ durationSeconds: 5940.12, hasAudio: true })
    expect(parseFfmpegProbe('Duration: N/A\n  Stream #0:0: Video: png')).toEqual({ durationSeconds: null, hasAudio: false })
    expect(lastFfmpegTime('size=1kB time=00:00:01.00 x\rsize=2kB time=01:02:03.50 x')).toBe(3723.5)
  })
})
