import { describe, expect, it } from 'vitest'
import {
  formatEmptyRecording,
  formatSegmentsMissing,
  isEmptyMediaPlaylist,
  parseRecordingProblem,
  queueErrorText,
} from './recordingProblems'

// Verbatim shape of a broken Yanhekt screen stream (session 828284).
const EMPTY = '#EXTM3U\n#EXT-X-VERSION:3\n#EXT-X-TARGETDURATION:0\n#EXT-X-MEDIA-SEQUENCE:0\n#EXTINF:0.000000,\n0.ts\n#EXT-X-ENDLIST\n'

describe('recordingProblems', () => {
  it('flags a finished playlist with zero total duration', () => {
    expect(isEmptyMediaPlaylist(EMPTY)).toBe(true)
    expect(isEmptyMediaPlaylist('#EXTM3U\n#EXT-X-TARGETDURATION:0\n#EXT-X-ENDLIST\n')).toBe(true)
  })

  it('leaves real, live and master playlists alone', () => {
    expect(isEmptyMediaPlaylist(EMPTY.replace('#EXTINF:0.000000', '#EXTINF:10.0'))).toBe(false)
    expect(isEmptyMediaPlaylist(EMPTY.replace('#EXT-X-ENDLIST\n', ''))).toBe(false)
    expect(isEmptyMediaPlaylist('#EXTM3U\n#EXT-X-STREAM-INF:BANDWIDTH=1\nv.m3u8\n#EXT-X-ENDLIST\n')).toBe(false)
    expect(isEmptyMediaPlaylist('<html>nope</html>')).toBe(false)
  })

  it('round-trips both problems through the IPC wrapper', () => {
    const wrap = (m: string) => `Error invoking remote method 'download:start': Error: ${m}`
    expect(parseRecordingProblem(new Error(wrap(formatEmptyRecording())))).toEqual({ kind: 'empty' })
    expect(parseRecordingProblem(wrap(formatSegmentsMissing(3, 120)))).toEqual({
      kind: 'segments_missing',
      missing: 3,
      total: 120,
    })
    expect(parseRecordingProblem('FFmpeg conversion failed with code 1')).toBeNull()
  })

  it('turns markers into readable English for the queues', () => {
    expect(queueErrorText(`Task initialization failed after 1 attempts: ${formatEmptyRecording()}`)).toMatch(/^Yanhekt's server has no video/)
    expect(queueErrorText(formatSegmentsMissing(3, 120))).toBe('3 of 120 video segments failed to download. Try again.')
    expect(queueErrorText('FFmpeg conversion failed')).toBe('FFmpeg conversion failed')
    expect(queueErrorText(undefined)).toBeUndefined()
  })
})
