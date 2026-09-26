// Recorded streams that Yanhekt serves "successfully" but that hold no video.
//
// A failed server-side transcode does not surface as an HTTP error: the
// playlist answers 200 with `#EXT-X-TARGETDURATION:0`, a single
// `#EXTINF:0.000000` segment and `#EXT-X-ENDLIST`, and that segment answers 200
// with an empty body. hls.js raises no error on it (the player just never gets
// ready) and FFmpeg only fails later with an opaque exit code, so we recognise
// the shape ourselves and report it as its own problem. The players check the
// same thing on hls.js level details (`attachEmptyRecordingGuard` in
// useVideoErrorRecovery).
//
// Download errors cross IPC as a plain message, so main throws a stable marker
// in the message and the renderer parses it back (same scheme as
// `outputDirAccess.ts`). Queue errors stay in English like every other error
// the queues show; only the playback page's notice is translated.

const EMPTY_MARKER = 'AUTOSLIDES_EMPTY_RECORDING'
const SEGMENTS_MARKER = 'AUTOSLIDES_SEGMENTS_MISSING'

/**
 * True for a finished (`#EXT-X-ENDLIST`) media playlist whose segments add up to
 * no playable time. A master playlist or a live window is never "empty" here.
 */
export function isEmptyMediaPlaylist(text: string): boolean {
  if (!text.includes('#EXTM3U') || text.includes('#EXT-X-STREAM-INF')) return false
  if (!text.includes('#EXT-X-ENDLIST')) return false
  let total = 0
  for (const match of text.matchAll(/#EXTINF:\s*([0-9.]+)/g)) {
    total += Number(match[1]) || 0
  }
  return total <= 0
}

export type RecordingProblem =
  | { kind: 'empty' }
  | { kind: 'segments_missing'; missing: number; total: number }

export function formatEmptyRecording(): string {
  return `${EMPTY_MARKER}: the server returned a recording with no video`
}

export function formatSegmentsMissing(missing: number, total: number): string {
  return `${SEGMENTS_MARKER}:${missing}/${total}: some video segments failed to download`
}

/** The problem an error (raw, IPC-wrapped, or a plain message) carries, if any. */
export function parseRecordingProblem(error: unknown): RecordingProblem | null {
  const message = error instanceof Error ? error.message : typeof error === 'string' ? error : ''
  if (message.includes(EMPTY_MARKER)) return { kind: 'empty' }
  const match = message.match(new RegExp(`${SEGMENTS_MARKER}:(\\d+)/(\\d+)`))
  if (match) return { kind: 'segments_missing', missing: Number(match[1]), total: Number(match[2]) }
  return null
}

/**
 * Queue display text: a recording problem as a plain English sentence (the
 * marker is not for people), anything else unchanged.
 */
export function queueErrorText(error: string | undefined): string | undefined {
  const problem = error ? parseRecordingProblem(error) : null
  if (!problem) return error
  if (problem.kind === 'empty') {
    return "Yanhekt's server has no video for this recording. Check whether it plays on the Yanhekt website."
  }
  return `${problem.missing} of ${problem.total} video segments failed to download. Try again.`
}
