import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const lookup = vi.hoisted(() => vi.fn<(liveId: string, token: string) => Promise<string | null>>())
vi.mock('@shared/services/apiClient', () => ({
  ApiClient: class {
    getLiveSessionId = lookup
  },
}))
vi.mock('@shared/services/authService', () => ({ tokenManager: { getToken: () => 'tok' } }))

import {
  clearLiveSessionIds,
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
    lookup.mockResolvedValue('920698')
    expect(await resolveLiveSessionId(788727)).toBe('920698')
    expect(await resolveLiveSessionId('788727')).toBe('920698')
    expect(lookup).toHaveBeenCalledTimes(1)
    expect(knownLiveSessionId(788727)).toBe('920698')
  })

  it('skips the request when the payload already carried the id', async () => {
    rememberLiveSessionId('788727', 920698)
    expect(await resolveLiveSessionId('788727')).toBe('920698')
    expect(lookup).not.toHaveBeenCalled()
  })

  it('does not cache a failure', async () => {
    lookup.mockResolvedValueOnce(null).mockResolvedValueOnce('920698')
    expect(await resolveLiveSessionId('788727')).toBeUndefined()
    expect(await resolveLiveSessionId('788727')).toBe('920698')
  })

  it('gives up after the timeout, and notes keep what naming used', async () => {
    vi.useFakeTimers()
    let answer: (value: string) => void = () => {}
    lookup.mockReturnValue(new Promise((resolve) => { answer = resolve }))
    const naming = resolveLiveSessionId('788727')
    await vi.advanceTimersByTimeAsync(5000)
    expect(await naming).toBeUndefined()
    answer('920698')
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
