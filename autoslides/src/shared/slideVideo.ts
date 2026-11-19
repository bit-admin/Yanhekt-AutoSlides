// Slide video: an MP4 made from a lecture's extracted slides and its audio.
//
// Replaces the old Lectures "compress" (re-encoding the screen recording at a
// low frame rate). A lecture's screen is mostly still slides, so the slides
// folder plus `timeline.json` already hold the picture: each slide is shown
// from the moment it appeared, with the lecture's audio underneath. Ported
// from the AutoSlides Extractor 2.1.0 video export (`VideoExporter`), with two
// differences: it runs the bundled FFmpeg as a process, and the audio is
// always Opus, through the same speech filters the old compress offered.
//
// Everything here is pure (no IO) so the plan can be tested; the main-process
// `SlideVideoService` reads the files, probes the audio and runs FFmpeg.

import { timelineOrigin, type SlideTimeline } from './sidecars/timeline'

export type SlideVideoResolution = '480' | '720' | '1080' | 'source'
export type SlideVideoAudioFilter = 'none' | 'clean' | 'speech' | 'strong' | 'loudnorm'
/** Which local file supplies the sound; the other is used when this one is missing. */
export type SlideVideoAudioSource = 'screen' | 'mic'

export interface SlideVideoOptions {
  resolution: SlideVideoResolution
  /** x264 constant quality (lower = sharper, larger). The picture is a tiny part of the file. */
  crf: SlideVideoCrf
  /** Show the current slide again this often (seconds); 0 = one frame per slide change. */
  repeatSeconds: SlideVideoRepeat
  /** Opus bitrate, mono. */
  audioBitrateKbps: 12 | 16 | 24 | 32
  audioFilter: SlideVideoAudioFilter
  audioSource: SlideVideoAudioSource
}

export const DEFAULT_SLIDE_VIDEO_OPTIONS: SlideVideoOptions = {
  resolution: '1080',
  crf: 23,
  repeatSeconds: 120,
  // Opus 16 kbps mono is clear speech (Extractor 2.1.0 default).
  audioBitrateKbps: 16,
  audioFilter: 'speech',
  audioSource: 'screen',
}

export const SLIDE_VIDEO_AUDIO_BITRATES = [12, 16, 24, 32] as const
/** Same choices as the Extractor 2.1.0 video export. */
export const SLIDE_VIDEO_RESOLUTIONS = ['source', '1080', '720', '480'] as const
export const SLIDE_VIDEO_CRFS = [18, 23, 28] as const
export const SLIDE_VIDEO_REPEATS = [0, 30, 60, 120, 300, 600] as const
export type SlideVideoCrf = (typeof SLIDE_VIDEO_CRFS)[number]
export type SlideVideoRepeat = (typeof SLIDE_VIDEO_REPEATS)[number]

/** The speech filters of the retired compress, unchanged. */
export const SLIDE_VIDEO_AUDIO_FILTERS: Record<SlideVideoAudioFilter, string> = {
  none: '',
  clean: 'highpass=f=80,afftdn=nr=6:nf=-35:tn=1',
  speech: 'highpass=f=80,afftdn=nr=8:nf=-35:tn=1,speechnorm=e=6.25:r=0.00001:l=1',
  strong: 'highpass=f=100,afftdn=nr=12:nf=-35:tn=1,speechnorm=e=12.5:r=0.0001:l=1',
  loudnorm: 'highpass=f=80,afftdn=nr=8:nf=-35:tn=1,loudnorm=I=-16:LRA=11:TP=-1.5',
}


/** Same images, in the same order, as the PDF and the Slides workspace. */
export const SLIDE_IMAGE_PATTERN = /^Slide_.*\.png$/i

const byPage = new Intl.Collator('en', { numeric: true })

export function sortSlideImages(names: string[]): string[] {
  return names.filter((name) => SLIDE_IMAGE_PATTERN.test(name)).sort(byPage.compare)
}

/** Output file beside the folder: `slides_X` → `slides_X.mp4` (type `slides` by its prefix). */
export function slideVideoFileName(folderName: string): string {
  return `${folderName}.mp4`
}

/** A slide (or black, `file: null`) shown from `start`, in timeline seconds. */
export interface SlideVideoSegment {
  start: number
  file: string | null
}

/**
 * What is on screen and when. An event shows its canonical file, or the slide
 * it duplicates. A gap (not a slide, excluded, trashed) or an image no longer on
 * disk keeps the previous slide up rather than going black; slides removed at
 * the very start show black until the first real one.
 */
export function slideVideoSegments(
  timeline: Pick<SlideTimeline, 'events' | 'resolutions'>,
  isPresent: (file: string) => boolean,
): SlideVideoSegment[] {
  const events = [...(timeline.events ?? [])]
    .filter((event) => Number.isFinite(event.changeAt))
    .sort((a, b) => a.changeAt - b.changeAt)
  const segments: SlideVideoSegment[] = []
  let current: string | null = null
  for (const event of events) {
    const resolution = timeline.resolutions?.[event.id]
    let shown: string | null | undefined
    if (!resolution) shown = event.initialFile
    else if (resolution.state === 'canonical') shown = resolution.file || event.initialFile
    else if (resolution.state === 'duplicate') shown = resolution.duplicateOf
    if (!shown || !isPresent(shown) || shown === current) continue
    segments.push({ start: event.changeAt, file: shown })
    current = shown
  }
  if (segments.length && events.length && segments[0].start > events[0].changeAt) {
    segments.unshift({ start: events[0].changeAt, file: null })
  }
  return segments
}

/** Second 0 of the recording on the timeline's clock (shared with the player's slides strip). */
export const slideVideoOrigin = timelineOrigin


export interface SlideVideoConcatEntry {
  /** Index into the segments; the file is that segment's (null = black). */
  segment: number
  /** Output milliseconds this frame is shown from. */
  startMs: number
  durationMs: number
}

export interface SlideVideoChapter {
  startMs: number
  endMs: number
  title: string
}

export interface SlideVideoPlan {
  entries: SlideVideoConcatEntry[]
  chapters: SlideVideoChapter[]
  /** Output length in seconds. */
  durationSeconds: number
}

/**
 * Frame schedule in output time. `endSeconds` is the output length (the audio's
 * length; null when unknown, then the last slide is held a while). `pages` is the
 * folder's slide list, so chapter N is PDF page N.
 */
export function planSlideVideo(input: {
  segments: SlideVideoSegment[]
  origin: number
  endSeconds: number | null
  pages: string[]
  repeatSeconds?: number
}): SlideVideoPlan {
  const { segments, origin, pages } = input
  const repeat = input.repeatSeconds ?? DEFAULT_SLIDE_VIDEO_OPTIONS.repeatSeconds
  if (!segments.some((segment) => segment.file)) return { entries: [], chapters: [], durationSeconds: 0 }

  // Unknown length: hold the last slide for a while. A known one (the audio)
  // wins even over slides after it, which are dropped.
  const known = input.endSeconds != null && Number.isFinite(input.endSeconds) && input.endSeconds > 0
  const end = known
    ? input.endSeconds!
    : Math.max(0, segments[segments.length - 1].start - origin) + Math.max(10, repeat)

  const frames: Array<{ t: number; segment: number }> = []
  for (let i = 0; i < segments.length; i++) {
    let t = i === 0 ? 0 : Math.max(0, segments[i].start - origin)
    const segEnd = i + 1 < segments.length ? Math.max(0, segments[i + 1].start - origin) : end
    const last = frames[frames.length - 1]
    if (last && t <= last.t) t = last.t + 0.001 // strictly increasing
    if (t >= end) break // after the audio ends
    if (t >= segEnd && i + 1 < segments.length) continue // zero length (before the audio starts)
    frames.push({ t, segment: i })
    if (repeat > 0) {
      for (let r = t + repeat; r < Math.min(segEnd, end) - 0.5; r += repeat) frames.push({ t: r, segment: i })
    }
  }

  const endMs = Math.round(end * 1000)
  const entries: SlideVideoConcatEntry[] = frames.map((frame, i) => {
    const startMs = Math.round(frame.t * 1000)
    const nextMs = i + 1 < frames.length ? Math.round(frames[i + 1].t * 1000) : endMs
    return { segment: frame.segment, startMs, durationMs: Math.max(1, nextMs - startMs) }
  })

  const chapters: SlideVideoChapter[] = []
  const starts = entries.filter((entry, i) => i === 0 || entries[i - 1].segment !== entry.segment)
  starts.forEach((entry, i) => {
    const file = segments[entry.segment].file
    if (!file) return // black lead-in: no chapter
    const page = pages.indexOf(file)
    chapters.push({
      startMs: entry.startMs,
      endMs: i + 1 < starts.length ? starts[i + 1].startMs : endMs,
      title: page >= 0 ? `Slide ${page + 1}` : file.replace(/\.[^.]+$/, ''),
    })
  })

  return { entries, chapters, durationSeconds: end }
}

const quoteConcatPath = (value: string): string => `'${value.replace(/'/g, "'\\''")}'`

/**
 * FFmpeg concat-demuxer list. The last image is listed twice: the demuxer
 * otherwise drops the last `duration`.
 */
export function slideVideoConcatList(entries: SlideVideoConcatEntry[], pathOf: (segment: number) => string): string {
  const lines = ['ffconcat version 1.0']
  for (const entry of entries) {
    lines.push(`file ${quoteConcatPath(pathOf(entry.segment))}`, `duration ${(entry.durationMs / 1000).toFixed(3)}`)
  }
  const last = entries[entries.length - 1]
  if (last) lines.push(`file ${quoteConcatPath(pathOf(last.segment))}`)
  return `${lines.join('\n')}\n`
}

const escapeMetadata = (value: string): string => value.replace(/[=;#\\\n]/g, (ch) => `\\${ch}`)

/** FFmpeg metadata file with the title and one chapter per slide shown. */
export function slideVideoMetadata(title: string, chapters: SlideVideoChapter[]): string {
  const lines = [';FFMETADATA1', `title=${escapeMetadata(title)}`]
  for (const chapter of chapters) {
    lines.push('[CHAPTER]', 'TIMEBASE=1/1000', `START=${chapter.startMs}`, `END=${chapter.endMs}`, `title=${escapeMetadata(chapter.title)}`)
  }
  return `${lines.join('\n')}\n`
}

/** The most common slide size among the segments, scaled to `resolution` (never up), even. */
export function slideVideoCanvas(
  sizes: Array<{ width: number; height: number }>,
  resolution: SlideVideoResolution,
): { width: number; height: number } {
  const counts = new Map<string, { width: number; height: number; n: number }>()
  let best: { width: number; height: number; n: number } | null = null
  for (const size of sizes) {
    if (!(size.width > 0 && size.height > 0)) continue
    const key = `${size.width}x${size.height}`
    const entry = counts.get(key) ?? { ...size, n: 0 }
    entry.n += 1
    counts.set(key, entry)
    if (!best || entry.n > best.n) best = entry
  }
  let width = best?.width ?? 1920
  let height = best?.height ?? 1080
  const target = resolution === 'source' ? 0 : Number(resolution)
  if (target > 0 && target < height) {
    width = Math.round((width * target) / height)
    height = target
  }
  return { width: Math.max(2, width & ~1), height: Math.max(2, height & ~1) }
}

export interface SlideVideoProbe {
  /** Container length in seconds, null when FFmpeg printed none. */
  durationSeconds: number | null
  hasAudio: boolean
}

const clock = (h: string, m: string, s: string): number => Number(h) * 3600 + Number(m) * 60 + Number(s)

/** Read `ffmpeg -i <file>` output (stderr): length and whether there is an audio track. */
export function parseFfmpegProbe(stderr: string): SlideVideoProbe {
  const duration = /Duration:\s*(\d+):(\d{2}):(\d{2}(?:\.\d+)?)/.exec(stderr)
  return {
    durationSeconds: duration ? clock(duration[1], duration[2], duration[3]) : null,
    hasAudio: /Stream #\d+:\d+.*?: Audio:/.test(stderr),
  }
}

/** Last `time=HH:MM:SS.xx` in FFmpeg's progress output, in seconds. */
export function lastFfmpegTime(text: string): number | null {
  const matches = [...text.matchAll(/time=(\d+):(\d{2}):(\d{2}(?:\.\d+)?)/g)]
  const last = matches[matches.length - 1]
  return last ? clock(last[1], last[2], last[3]) : null
}

/** FFmpeg arguments: inputs are the concat list, the audio (optional) and the metadata file. */
export function slideVideoFfmpegArgs(input: {
  concatPath: string
  audioPath: string | null
  metadataPath: string
  outputPath: string
  width: number
  height: number
  durationSeconds: number
  options: SlideVideoOptions
}): string[] {
  const { width: w, height: h, options } = input
  const metadataInput = input.audioPath ? 2 : 1
  const args = [
    '-hide_banner', '-nostdin', '-y', '-stats_period', '1',
    '-f', 'concat', '-safe', '0', '-i', input.concatPath,
  ]
  if (input.audioPath) args.push('-i', input.audioPath)
  args.push(
    '-f', 'ffmetadata', '-i', input.metadataPath,
    '-map', '0:v:0',
  )
  if (input.audioPath) args.push('-map', '1:a:0')
  args.push(
    '-map_metadata', String(metadataInput), '-map_chapters', String(metadataInput),
    // Letterbox every slide into one canvas, BT.709 limited range (what the stream is tagged as).
    '-vf', [
      `scale=${w}:${h}:force_original_aspect_ratio=decrease:flags=lanczos:out_color_matrix=bt709:out_range=tv`,
      `pad=${w}:${h}:(ow-iw)/2:(oh-ih)/2:color=black`,
      'setsar=1',
      'format=yuv420p',
    ].join(','),
    '-fps_mode', 'vfr',
    '-c:v', 'libx264', '-preset', 'slow', '-tune', 'stillimage', '-crf', String(options.crf),
    '-bf', '0',
    // Keyframes come from scene cuts (slide changes); repeats are tiny P-frames.
    '-x264-params', 'keyint=600:min-keyint=1:scenecut=40',
    '-color_primaries', 'bt709', '-color_trc', 'bt709', '-colorspace', 'bt709', '-color_range', 'tv',
  )
  if (input.audioPath) {
    // Follow the source timestamps, as the player and the timeline do: recorders
    // drop audio and stretch timestamps to the wall clock, so fill holes with
    // silence and drop overlaps (beyond 10 ms) instead of counting samples.
    const filters = [SLIDE_VIDEO_AUDIO_FILTERS[options.audioFilter], 'aresample=async=1:min_hard_comp=0.01:first_pts=0']
    args.push(
      '-af', filters.filter(Boolean).join(','),
      '-c:a', 'libopus', '-b:a', `${options.audioBitrateKbps}k`, '-ac', '1',
      '-vbr', 'constrained', '-compression_level', '10', '-application', 'voip',
      // 60 ms frames: MP4 stores one entry per packet, and 20 ms frames add ~5 kbps.
      '-frame_duration', '60',
    )
  }
  args.push('-t', input.durationSeconds.toFixed(3), '-movflags', '+faststart', input.outputPath)
  return args
}
