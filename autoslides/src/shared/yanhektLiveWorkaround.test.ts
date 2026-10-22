import { describe, expect, it } from 'vitest'
import {
  defaultYanhektLiveWorkaround,
  identityYanhektLiveWorkaround,
  normalizeYanhektLiveWorkaround,
  reassignLiveWorkaround,
  relabelYanhektLiveStreams,
  yanhektLiveUrlsMatchContract,
} from './yanhektLiveWorkaround'

const streams = {
  screen: { type: 'screen' as const, name: '屏幕录制', url: 'vga' },
  camera: { type: 'camera' as const, name: '课堂摄像头', url: 'main' },
  room: { type: 'room' as const, name: '教室摄像头', url: 'room' },
}

describe('relabelYanhektLiveStreams', () => {
  it('plays each label from the server response the setting names', () => {
    const out = relabelYanhektLiveStreams(streams, { ...defaultYanhektLiveWorkaround(), enabled: true })
    expect(out.screen).toMatchObject({ type: 'screen', name: '屏幕录制', url: 'main' })
    expect(out.camera).toMatchObject({ type: 'camera', name: '课堂摄像头', url: 'room' })
    expect(out.room).toMatchObject({ type: 'room', name: '教室摄像头', url: 'vga' })
  })

  it('follows a custom order', () => {
    const swapped = { version: 2, enabled: true, screen: 'room' as const, camera: 'screen' as const, room: 'camera' as const }
    const out = relabelYanhektLiveStreams(streams, swapped)
    expect(out.screen?.url).toBe('room')
    expect(out.camera?.url).toBe('vga')
    expect(out.room?.url).toBe('main')
  })

  it('leaves a missing response missing', () => {
    const { room: _room, ...withoutRoom } = streams
    const out = relabelYanhektLiveStreams(withoutRoom, { ...defaultYanhektLiveWorkaround(), enabled: true })
    expect(out.camera).toBeUndefined()
    expect(out.screen?.url).toBe('main')
    expect(out.room?.url).toBe('vga')
  })

  it('does nothing for the identity order or when the checkbox is off', () => {
    expect(relabelYanhektLiveStreams(streams, identityYanhektLiveWorkaround())).toBe(streams)
    expect(relabelYanhektLiveStreams(streams, { ...defaultYanhektLiveWorkaround(), enabled: false })).toBe(streams)
  })
})

const CONTRACT = {
  target: 'https://clive13.yanhekt.cn/live/23375_Video1.m3u8',
  target_vga: 'https://clive13.yanhekt.cn/live/23375_VGA.m3u8',
  target_room: 'https://clive13.yanhekt.cn/live/23375_Video2.m3u8',
}

describe('yanhektLiveUrlsMatchContract', () => {
  it('accepts the documented Video1, VGA, and Video2 names', () => {
    expect(yanhektLiveUrlsMatchContract(CONTRACT)).toBe(true)
    expect(yanhektLiveUrlsMatchContract({ target: CONTRACT.target, target_vga: CONTRACT.target_vga })).toBe(true)
  })

  it('rejects a swapped or unnamed playlist', () => {
    expect(yanhektLiveUrlsMatchContract({ ...CONTRACT, target: CONTRACT.target_vga })).toBe(false)
    expect(yanhektLiveUrlsMatchContract({ target: 'https://clive13.yanhekt.cn/live/23375.m3u8' })).toBe(false)
    expect(yanhektLiveUrlsMatchContract({})).toBe(false)
  })
})

describe('normalizeYanhektLiveWorkaround', () => {
  it('reads the legacy number and a saved order', () => {
    expect(normalizeYanhektLiveWorkaround(1)).toEqual({ ...defaultYanhektLiveWorkaround(), enabled: true })
    expect(normalizeYanhektLiveWorkaround(0)).toEqual({ ...defaultYanhektLiveWorkaround(), enabled: false })
    expect(normalizeYanhektLiveWorkaround(undefined)).toEqual(defaultYanhektLiveWorkaround())
    const custom = { version: 2, enabled: false, screen: 'screen' as const, camera: 'room' as const, room: 'camera' as const }
    expect(normalizeYanhektLiveWorkaround(custom)).toEqual(custom)
    expect(normalizeYanhektLiveWorkaround({ ...custom, enabled: undefined })).toEqual({ ...custom, enabled: true })
  })

  it('rejects a duplicate or a version this build does not know', () => {
    expect(normalizeYanhektLiveWorkaround({ version: 2, screen: 'camera', camera: 'camera', room: 'room' })).toEqual(defaultYanhektLiveWorkaround())
    expect(normalizeYanhektLiveWorkaround({ version: 3, screen: 'room', camera: 'screen', room: 'camera' })).toEqual(defaultYanhektLiveWorkaround())
  })

  it('turns off the version-1 order that electron-store wrote as the old default (on)', () => {
    const oldDefault = { version: 1, enabled: true, screen: 'camera', camera: 'room', room: 'screen' }
    expect(normalizeYanhektLiveWorkaround(oldDefault)).toMatchObject({ version: 2, enabled: false })
  })
})

describe('reassignLiveWorkaround', () => {
  it('swaps the response the chosen label takes', () => {
    const next = reassignLiveWorkaround(defaultYanhektLiveWorkaround(), 'screen', 'screen')
    expect(next.screen).toBe('screen')
    expect(next.room).toBe('camera')
    expect(new Set([next.screen, next.camera, next.room]).size).toBe(3)
  })
})
