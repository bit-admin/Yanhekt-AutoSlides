/**
 * Is there anything to hear on a lecture's classroom-mic track?
 *
 * Yanhekt and Yanhe 2.0 serve the same mic files and both list one for every
 * recording that could have had a microphone. The file is
 * always there and always full length — but when the teacher's microphone was
 * off it holds nothing to hear, and nothing in the API says so. So a few short
 * slices of the file are decoded and listened to before the player offers it.
 *
 * Level alone does not tell them apart: one dead track measured -71 dBFS, but
 * another was a steady hiss at -50, louder than the quiet stretches of a real
 * one. What does is movement. Speech swings by 13–42 dB between its loud and
 * quiet tenths of a second; a dead track, whatever its level, moves 1–3 dB
 * (six recordings, 2026-10-12).
 */
import { createLogger } from '@shared/utils/logger'

const log = createLogger('MicAudioProbe')

/** ~30 seconds each at the file's ~130 kb/s. */
const SLICE_BYTES = 500_000
/** Where the first slice is cut: roughly 10 minutes in, past the wait before class. */
const FIRST_SLICE_OFFSET = 10_000_000
/** Where the others are cut when the file's size is not known: roughly 31 and 51 minutes in. */
const LATER_SLICE_OFFSETS = [30_000_000, 50_000_000]
/** Where they are cut when it is, as a share of the file. */
const LATER_SLICE_SHARES = [0.5, 0.8]
/** Where all of them are cut in a file that ends before the first offset. */
const SHORT_FILE_SHARES = [0.2, 0.5, 0.8]
/** The level is taken over windows this long. */
const WINDOW_SECONDS = 0.1
/** Loud-to-quiet swing that means something is being said. Dead tracks stay under 3 dB, speech starts at 13. */
const SPEECH_SWING_DB = 8
/** Below this even the loud moments are inaudible, whatever they do. */
const AUDIBLE_DBFS = -60

/**
 * Where the first whole ADTS frame starts in a slice cut from the middle of an
 * AAC file, or -1. A frame header is `FFF` + flags, and carries its own length;
 * a candidate counts only if another header follows right where it says.
 */
export function findAdtsFrame(bytes: Uint8Array): number {
  const isHeader = (i: number) => bytes[i] === 0xff && (bytes[i + 1] & 0xf6) === 0xf0
  for (let i = 0; i + 7 < bytes.length; i++) {
    if (!isHeader(i)) continue
    const length = ((bytes[i + 3] & 0x03) << 11) | (bytes[i + 4] << 3) | (bytes[i + 5] >> 5)
    if (length < 7) continue
    const next = i + length
    if (next + 1 < bytes.length && isHeader(next)) return i
  }
  return -1
}

/**
 * How loud the loud and the quiet moments of a recording are, in dBFS: the
 * 95th and 10th percentile of its level over short windows. Null when there is
 * too little to judge.
 */
export function levelRange(samples: Float32Array, sampleRate: number): { loud: number; quiet: number } | null {
  const size = Math.max(1, Math.round(sampleRate * WINDOW_SECONDS))
  const windows = Math.floor(samples.length / size)
  if (windows < 10) return null
  const levels = new Float64Array(windows)
  for (let w = 0; w < windows; w++) {
    let sum = 0
    for (let i = w * size, end = i + size; i < end; i++) sum += samples[i] * samples[i]
    // Floored so digital silence is a number, not -Infinity.
    levels[w] = 10 * Math.log10(sum / size + 1e-12)
  }
  levels.sort()
  const at = (fraction: number) => levels[Math.min(windows - 1, Math.floor(windows * fraction))]
  return { loud: at(0.95), quiet: at(0.1) }
}

/** Sound that rises and falls like someone talking, loud enough to hear. */
export function hasSpeechLikeSound(range: { loud: number; quiet: number }): boolean {
  return range.loud > AUDIBLE_DBFS && range.loud - range.quiet >= SPEECH_SWING_DB
}

// The file size out of `Content-Range: bytes 0-9/1234` (`bytes */1234` on a 416), or null.
export function totalFromContentRange(header: string | null): number | null {
  const total = Number(header?.match(/\/(\d+)\s*$/)?.[1])
  return Number.isFinite(total) && total > 0 ? total : null
}

/**
 * Where to cut the slices that follow the first one. `total` is the file's
 * size when the first answer told it, and `firstFit` whether the first offset
 * was inside the file.
 */
export function laterSliceOffsets(total: number | null, firstFit: boolean): number[] {
  if (total === null) return firstFit ? LATER_SLICE_OFFSETS : []
  const shares = firstFit ? LATER_SLICE_SHARES : SHORT_FILE_SHARES
  const last = total - SLICE_BYTES
  if (last <= 0) return [0]
  return shares.map((share) => Math.min(last, Math.floor(total * share)))
}

interface SliceResult {
  /** Whether the slice has speech in it; null when it could not be judged. */
  heard: boolean | null
  total: number | null
  /** The offset was inside the file. */
  fit: boolean
}

async function measureSlice(url: string, offset: number, signal: AbortSignal): Promise<SliceResult> {
  const response = await fetch(url, { headers: { Range: `bytes=${offset}-${offset + SLICE_BYTES - 1}` }, signal })
  const total = totalFromContentRange(response.headers.get('Content-Range'))
  // 416: the file ends before this offset.
  if (response.status !== 206) return { heard: null, total, fit: false }
  const bytes = new Uint8Array(await response.arrayBuffer())
  const start = findAdtsFrame(bytes)
  if (start < 0) return { heard: null, total, fit: true }
  const context = new OfflineAudioContext(1, 1, 48_000)
  const audio = await context.decodeAudioData(bytes.slice(start).buffer)
  const range = levelRange(audio.getChannelData(0), audio.sampleRate)
  return { heard: range ? hasSpeechLikeSound(range) : null, total, fit: true }
}

/**
 * False only when every slice that could be measured has nothing said in it. A track that
 * cannot be measured (network, decode) is offered: better a quiet option than
 * a hidden working one.
 */
export async function isMicAudioAudible(url: string, signal: AbortSignal): Promise<boolean> {
  let measured = 0
  const offsets = [FIRST_SLICE_OFFSET]
  for (let i = 0; i < offsets.length; i++) {
    try {
      const slice = await measureSlice(url, offsets[i], signal)
      // The first answer says how long the file is, and so where the rest go.
      if (i === 0) offsets.push(...laterSliceOffsets(slice.total, slice.fit))
      if (slice.heard === null) continue
      measured++
      if (slice.heard) return true
    } catch (error) {
      if (signal.aborted) return false
      log.warn('Classroom mic slice could not be measured:', error)
      if (i === 0) offsets.push(...LATER_SLICE_OFFSETS)
    }
  }
  if (measured > 0) log.info('Classroom mic track has no speech on it; not offered')
  return measured === 0
}
