import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Yanhe2ReadResult } from '@common/yanhe2Calendar'
import { invalidateAll } from '@shared/services/requestCache'
import { readThroughCache } from './yanhe2Reads'

const ok = (data: number): Yanhe2ReadResult<number> => ({ kind: 'ok', data })

afterEach(() => invalidateAll())

describe('readThroughCache', () => {
  it('joins an identical read that is still in flight', async () => {
    let release: (value: Yanhe2ReadResult<number>) => void = () => undefined
    const fn = vi.fn(() => new Promise<Yanhe2ReadResult<number>>((resolve) => { release = resolve }))
    const first = readThroughCache('k', 0, fn)
    const second = readThroughCache('k', 0, fn)
    release(ok(1))
    expect(await first).toEqual(ok(1))
    expect(await second).toEqual(ok(1))
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('reuses an ok answer within its ttl, and never with ttl 0', async () => {
    const fn = vi.fn(async () => ok(1))
    await readThroughCache('memo', 60_000, fn)
    await readThroughCache('memo', 60_000, fn)
    expect(fn).toHaveBeenCalledTimes(1)

    await readThroughCache('join-only', 0, fn)
    await readThroughCache('join-only', 0, fn)
    expect(fn).toHaveBeenCalledTimes(3)
  })

  it('hands back a non-ok answer without memoizing it', async () => {
    const fn = vi.fn<() => Promise<Yanhe2ReadResult<number>>>()
      .mockResolvedValueOnce({ kind: 'network' })
      .mockResolvedValueOnce({ kind: 'signed_out' })
      .mockResolvedValueOnce(ok(2))
    expect(await readThroughCache('k', 60_000, fn)).toEqual({ kind: 'network' })
    expect(await readThroughCache('k', 60_000, fn)).toEqual({ kind: 'signed_out' })
    expect(await readThroughCache('k', 60_000, fn)).toEqual(ok(2))
    expect(fn).toHaveBeenCalledTimes(3)
  })

  it('still rejects when the call itself throws', async () => {
    await expect(readThroughCache('k', 60_000, async () => { throw new Error('ipc') })).rejects.toThrow('ipc')
  })
})
