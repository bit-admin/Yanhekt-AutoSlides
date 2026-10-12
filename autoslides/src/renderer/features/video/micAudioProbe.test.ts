import { describe, expect, it } from 'vitest'
import { findAdtsFrame, hasSpeechLikeSound, laterSliceOffsets, levelRange, totalFromContentRange } from './micAudioProbe'

/** One ADTS frame of `length` bytes (header included), payload filled with `fill`. */
function frame(length: number, fill = 0x11): number[] {
  const header = [0xff, 0xf1, 0x4c, 0x80 | ((length >> 11) & 0x03), (length >> 3) & 0xff, ((length & 0x07) << 5) | 0x1f, 0xfc]
  return [...header, ...new Array(length - 7).fill(fill)]
}

describe('findAdtsFrame', () => {
  it('skips the cut-off frame a mid-file slice starts with', () => {
    const tail = [0x22, 0x33, 0x44, 0x55, 0x66]
    const bytes = new Uint8Array([...tail, ...frame(40), ...frame(52), ...frame(40)])
    expect(findAdtsFrame(bytes)).toBe(tail.length)
  })

  it('ignores a sync pattern inside a payload', () => {
    // FF F1 inside the garbage, but no header where its length points.
    const bytes = new Uint8Array([0xff, 0xf1, 0x4c, 0x80, 0x02, 0x1f, 0xfc, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, ...frame(30), ...frame(30)])
    expect(findAdtsFrame(bytes)).toBe(17)
  })

  it('finds nothing in something that is not AAC', () => {
    expect(findAdtsFrame(new Uint8Array(200))).toBe(-1)
    expect(findAdtsFrame(new Uint8Array(frame(40)))).toBe(-1)
  })
})

const RATE = 48_000

/** `seconds` of noise whose level follows `gainAt(second)`. Deterministic. */
function noise(seconds: number, gainAt: (second: number) => number): Float32Array {
  const out = new Float32Array(seconds * RATE)
  let seed = 1
  for (let i = 0; i < out.length; i++) {
    seed = (seed * 1664525 + 1013904223) >>> 0
    out[i] = (seed / 0x80000000 - 1) * gainAt(i / RATE)
  }
  return out
}

const heard = (samples: Float32Array) => {
  const range = levelRange(samples, RATE)
  return range ? hasSpeechLikeSound(range) : null
}

describe('levelRange', () => {
  it('hears sound that comes and goes', () => {
    // Half a second on, half a second nearly off, like phrases and pauses.
    expect(heard(noise(10, (t) => (t % 1 < 0.5 ? 0.1 : 0.002)))).toBe(true)
  })

  it('does not take a steady hiss for a voice, however loud', () => {
    // The dead track that got past a plain level check sat around -50 dBFS.
    expect(heard(noise(10, () => 0.005))).toBe(false)
    expect(heard(noise(10, () => 0.2))).toBe(false)
  })

  it('does not hear digital silence, or movement too faint to hear', () => {
    expect(heard(new Float32Array(10 * RATE))).toBe(false)
    expect(heard(noise(10, (t) => (t % 1 < 0.5 ? 0.0005 : 0.00001)))).toBe(false)
  })

  it('will not judge a fragment', () => {
    expect(levelRange(new Float32Array(RATE / 2), RATE)).toBeNull()
  })
})

describe('totalFromContentRange', () => {
  it('reads the size off a ranged answer and off a 416', () => {
    expect(totalFromContentRange('bytes 10000000-10499999/23456789')).toBe(23456789)
    expect(totalFromContentRange('bytes */8000000')).toBe(8000000)
  })

  it('gives null when the size is not there', () => {
    expect(totalFromContentRange(null)).toBeNull()
    expect(totalFromContentRange('bytes 0-9/*')).toBeNull()
  })
})

describe('laterSliceOffsets', () => {
  it('keeps the later slices inside a file of known size', () => {
    expect(laterSliceOffsets(24_000_000, true)).toEqual([12_000_000, 19_200_000])
  })

  it('cuts all three inside a file that ends before the first offset', () => {
    expect(laterSliceOffsets(8_000_000, false)).toEqual([1_600_000, 4_000_000, 6_400_000])
  })

  it('takes a tiny file whole', () => {
    expect(laterSliceOffsets(300_000, false)).toEqual([0])
  })

  it('falls back to fixed offsets when the size is unknown', () => {
    expect(laterSliceOffsets(null, true)).toEqual([30_000_000, 50_000_000])
    expect(laterSliceOffsets(null, false)).toEqual([])
  })
})
