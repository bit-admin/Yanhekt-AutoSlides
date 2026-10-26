import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ErrorData } from 'hls.js'
import { ErrorDetails, ErrorTypes } from 'hls.js'
import { isMissingMedia, isMissingPlaylist, pickPlayableStream, streamFallbackMessageKey } from './streamFallback'

describe('pickPlayableStream', () => {
  it('picks the screen first', () => {
    expect(pickPlayableStream(['camera', 'screen'], [])).toBe('screen')
  })

  it('moves to the camera when the screen failed (issue #39)', () => {
    expect(pickPlayableStream(['screen', 'camera'], ['screen'])).toBe('camera')
  })

  it('reaches the room camera only when it is offered', () => {
    expect(pickPlayableStream(['screen', 'camera'], ['screen', 'camera'])).toBeNull()
    expect(pickPlayableStream(['screen', 'camera', 'room'], ['screen', 'camera'])).toBe('room')
  })

  it('answers null when nothing is offered', () => {
    expect(pickPlayableStream([], [])).toBeNull()
  })
})

const hlsError = (fields: Partial<ErrorData>): ErrorData => ({
  type: ErrorTypes.NETWORK_ERROR,
  details: ErrorDetails.MANIFEST_LOAD_ERROR,
  fatal: true,
  ...fields,
} as ErrorData)

describe('isMissingPlaylist', () => {
  it('is true for a playlist that answered 404 or 410', () => {
    expect(isMissingPlaylist(hlsError({ response: { code: 404, text: '', url: '' } as ErrorData['response'] }))).toBe(true)
    expect(isMissingPlaylist(hlsError({
      details: ErrorDetails.LEVEL_LOAD_ERROR,
      response: { code: 410, text: '', url: '' } as ErrorData['response'],
    }))).toBe(true)
  })

  it('is false for other failures, which are worth retrying', () => {
    expect(isMissingPlaylist(hlsError({ response: { code: 403, text: '', url: '' } as ErrorData['response'] }))).toBe(false)
    expect(isMissingPlaylist(hlsError({ response: undefined }))).toBe(false)
    expect(isMissingPlaylist(hlsError({ fatal: false, response: { code: 404, text: '', url: '' } as ErrorData['response'] }))).toBe(false)
    expect(isMissingPlaylist(hlsError({
      details: ErrorDetails.FRAG_LOAD_ERROR,
      response: { code: 404, text: '', url: '' } as ErrorData['response'],
    }))).toBe(false)
  })
})

describe('isMissingMedia', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('reads the status of a one-byte request', async () => {
    const fetchMock = vi.fn(async () => new Response('', { status: 404 }))
    vi.stubGlobal('fetch', fetchMock)
    await expect(isMissingMedia('http://localhost:1/yanhe2?u=x')).resolves.toBe(true)
    expect(fetchMock).toHaveBeenCalledWith('http://localhost:1/yanhe2?u=x', expect.objectContaining({
      headers: { Range: 'bytes=0-0' },
    }))
  })

  it('is false for a file that is there, and for no answer', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('x', { status: 206 })))
    await expect(isMissingMedia('u')).resolves.toBe(false)
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('offline') }))
    await expect(isMissingMedia('u')).resolves.toBe(false)
  })
})

describe('streamFallbackMessageKey', () => {
  it('names the reason', () => {
    expect(streamFallbackMessageKey('missing')).toBe('playback.streamFallbackMissing')
    expect(streamFallbackMessageKey('empty')).toBe('playback.streamFallbackEmpty')
    expect(streamFallbackMessageKey('failed')).toBe('playback.streamFallback')
  })
})
