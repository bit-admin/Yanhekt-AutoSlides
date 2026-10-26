import { describe, it, expect } from 'vitest'
import type { PinnedCourse } from '@common/types'
import { belongsTo, isEarlierTermPin, mergeSyncedPins, pinTermKey } from './pinMerge'

const CURRENT = '2026-2027-1'

const pin = (id: string, term: [string, string] | null, owner?: string): PinnedCourse => ({
  id,
  title: `课程${id}`,
  ...(term ? { school_year: term[0], semester: term[1] } : {}),
  ...(owner ? { owner } : {}),
})

const ids = (pins: PinnedCourse[]) => pins.map(p => `${p.id}:${p.owner ?? '-'}`)

describe('pinTermKey / isEarlierTermPin', () => {
  it('reads both school-year shapes', () => {
    expect(pinTermKey({ school_year: '2025-2026', semester: '2' })).toBe('2025-2026-2')
    expect(pinTermKey({ school_year: '2026', semester: '1' })).toBe('2026-2027-1')
    expect(pinTermKey({})).toBeNull()
  })

  it('is true only for a known term before the current one', () => {
    expect(isEarlierTermPin({ school_year: '2025-2026', semester: '2' }, CURRENT)).toBe(true)
    expect(isEarlierTermPin({ school_year: '2026-2027', semester: '1' }, CURRENT)).toBe(false)
    expect(isEarlierTermPin({}, CURRENT)).toBe(false)
    expect(isEarlierTermPin({ school_year: '2025-2026', semester: '2' }, null)).toBe(false)
  })
})

describe('belongsTo', () => {
  it('shows own and ownerless pins, hides other accounts', () => {
    expect(belongsTo(pin('1', null, 'A'), 'A')).toBe(true)
    expect(belongsTo(pin('1', null), 'A')).toBe(true)
    expect(belongsTo(pin('1', null, 'B'), 'A')).toBe(false)
    expect(belongsTo(pin('1', null, 'B'), null)).toBe(true)
  })
})

describe('mergeSyncedPins', () => {
  it('lets the server decide current-term pins and keeps earlier-term pins', () => {
    const stored = [
      pin('1', ['2026-2027', '1'], 'A'), // current, unpinned elsewhere → dropped
      pin('2', ['2025-2026', '2'], 'A'), // earlier term → kept
      pin('3', ['2026-2027', '1'], 'A'), // current, still subscribed → server copy
    ]
    const server = [pin('3', ['2026-2027', '1']), pin('4', ['2026-2027', '1'])]
    expect(ids(mergeSyncedPins(stored, server, 'A', CURRENT))).toEqual(['3:A', '4:A', '2:A'])
  })

  it('prefers the server snapshot when an earlier-term course is still returned', () => {
    const stored = [{ ...pin('2', ['2025-2026', '2'], 'A'), number: undefined }]
    const server = [{ ...pin('2', ['2025-2026', '2']), number: 'X1' }]
    const out = mergeSyncedPins(stored, server, 'A', CURRENT)
    expect(out).toHaveLength(1)
    expect(out[0].number).toBe('X1')
  })

  it('leaves other accounts alone and adopts ownerless pins', () => {
    const stored = [
      pin('5', ['2024-2025', '1'], 'B'),
      pin('6', ['2026-2027', '1'], 'B'),
      pin('7', ['2024-2025', '1']),
    ]
    expect(ids(mergeSyncedPins(stored, [], 'A', CURRENT))).toEqual(['7:A', '5:B', '6:B'])
  })

  it('keeps pins of unknown term, and everything when the current term is unknown', () => {
    const stored = [pin('8', null, 'A'), pin('9', ['2026-2027', '1'], 'A')]
    expect(ids(mergeSyncedPins(stored, [], 'A', CURRENT))).toEqual(['8:A'])
    expect(ids(mergeSyncedPins(stored, [], 'A', null))).toEqual(['8:A', '9:A'])
  })

  it('normalizes numeric ids', () => {
    const stored = [{ ...pin('10', ['2026-2027', '1'], 'A') }]
    const server = [{ ...pin('10', ['2026-2027', '1']), id: 10 as unknown as string }]
    expect(ids(mergeSyncedPins(stored, server, 'A', CURRENT))).toEqual(['10:A'])
  })
})
