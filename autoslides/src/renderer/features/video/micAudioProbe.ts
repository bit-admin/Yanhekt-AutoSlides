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
/** Roughly 10, 31 and 51 minutes in: past the wait before class, short of where most lectures end. */
const SLICE_OFFSETS = [10_000_000, 30_000_000, 50_000_000]
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

/** Whether one slice has speech in it; null when the slice could not be judged. */
async function sliceHasSound(url: string, offset: number, signal: AbortSignal): Promise<boolean | null> {
  const response = await fetch(url, { headers: { Range: `bytes=${offset}-${offset + SLICE_BYTES - 1}` }, signal })
  // A short lecture ends before the later offsets.
  if (response.status !== 206) return null
  const bytes = new Uint8Array(await response.arrayBuffer())
  const start = findAdtsFrame(bytes)
  if (start < 0) return null
  const context = new OfflineAudioContext(1, 1, 48_000)
  const audio = await context.decodeAudioData(bytes.slice(start).buffer)
  const range = levelRange(audio.getChannelData(0), audio.sampleRate)
  return range ? hasSpeechLikeSound(range) : null
}

/**
 * False only when every slice that could be measured has nothing said in it. A track that
 * cannot be measured (network, decode) is offered: better a quiet option than
 * a hidden working one.
 */
export async function isMicAudioAudible(url: string, signal: AbortSignal): Promise<boolean> {
  let measured = 0
  for (const offset of SLICE_OFFSETS) {
    try {
      const heard = await sliceHasSound(url, offset, signal)
      if (heard === null) continue
      measured++
      if (heard) return true
    } catch (error) {
      if (signal.aborted) return false
      log.warn('Classroom mic slice could not be measured:', error)
    }
  }
  if (measured > 0) log.info('Classroom mic track has no speech on it; not offered')
  return measured === 0
}
