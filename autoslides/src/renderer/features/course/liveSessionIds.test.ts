import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const lookup = vi.hoisted(() => vi.fn<(liveId: string, token: string) => Promise<{ sessionId: string | null; courseNumber: string | null } | null>>())
vi.mock('@shared/services/apiClient', () => ({
  ApiClient: class {
    getLiveDetail = lookup
  },
}))
vi.mock('@shared/services/authService', () => ({ tokenManager: { getToken: () => 'tok' } }))

import {
  clearLiveSessionIds,
  knownLiveCourseNumber,
  knownLiveSessionId,
  rememberLiveSessionId,
  resolveLiveSessionId,
} from './liveSessionIds'

beforeEach(() => {
  clearLiveSessionIds()
  lookup.mockReset()
})
afterEach(() => vi.useRealTimers())

describe('liveSessionIds', () => {
  it('looks a broadcast up once and caches the answer', async () => {
    lookup.mockResolvedValue({ sessionId: '920698', courseNumber: 'K-0001' })
    expect(await resolveLiveSessionId(788727)).toBe('920698')
    expect(await resolveLiveSessionId('788727')).toBe('920698')
    expect(lookup).toHaveBeenCalledTimes(1)
    expect(knownLiveSessionId(788727)).toBe('920698')
  })

  it('reads the detail once even when the row carried the id, for the course number', async () => {
    rememberLiveSessionId('788727', 920698)
    lookup.mockResolvedValue({ sessionId: '920698', courseNumber: 'K-0001' })
    expect(await resolveLiveSessionId('788727')).toBe('920698')
    expect(knownLiveCourseNumber('788727')).toBe('K-0001')
    expect(await resolveLiveSessionId('788727')).toBe('920698')
    expect(lookup).toHaveBeenCalledTimes(1)
  })

  it("names with the row's id when the detail fails, and asks again next time", async () => {
    rememberLiveSessionId('788727', 920698)
    lookup.mockResolvedValueOnce(null)
    expect(await resolveLiveSessionId('788727')).toBe('920698')
    expect(knownLiveCourseNumber('788727')).toBeUndefined()
    lookup.mockResolvedValueOnce({ sessionId: '920698', courseNumber: 'K-0001' })
    await resolveLiveSessionId('788727')
    expect(lookup).toHaveBeenCalledTimes(2)
    expect(knownLiveCourseNumber('788727')).toBe('K-0001')
  })

  it('does not cache a failure', async () => {
    lookup.mockResolvedValueOnce(null).mockResolvedValueOnce({ sessionId: '920698', courseNumber: null })
    expect(await resolveLiveSessionId('788727')).toBeUndefined()
    expect(await resolveLiveSessionId('788727')).toBe('920698')
  })

  it('gives up after the timeout, and notes keep what naming used', async () => {
    vi.useFakeTimers()
    let answer: (value: { sessionId: string | null; courseNumber: string | null }) => void = () => {}
    lookup.mockReturnValue(new Promise((resolve) => { answer = resolve }))
    const naming = resolveLiveSessionId('788727')
    await vi.advanceTimersByTimeAsync(5000)
    expect(await naming).toBeUndefined()
    answer({ sessionId: '920698', courseNumber: 'K-0001' })
    await vi.runAllTimersAsync()
    // The folder was named without it, so the note must be too.
    expect(knownLiveSessionId('788727')).toBeUndefined()
    // The next extraction uses it.
    expect(await resolveLiveSessionId('788727')).toBe('920698')
    expect(knownLiveSessionId('788727')).toBe('920698')
  })

  it('ignores missing and non-numeric ids', async () => {
    rememberLiveSessionId('788727', 'abc')
    expect(knownLiveSessionId('788727')).toBeUndefined()
    expect(await resolveLiveSessionId(undefined)).toBeUndefined()
    expect(lookup).not.toHaveBeenCalled()
  })
})
