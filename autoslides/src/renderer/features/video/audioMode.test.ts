import { describe, expect, it } from 'vitest'
import { audioModeLabelKey, isMutedByAudioMode } from './audioMode'

describe('isMutedByAudioMode', () => {
  it('follows each Audio Mode per playback mode', () => {
    expect(isMutedByAudioMode('normal', 'live')).toBe(false)
    expect(isMutedByAudioMode('normal', 'recorded')).toBe(false)
    expect(isMutedByAudioMode('mute_all', 'live')).toBe(true)
    expect(isMutedByAudioMode('mute_all', 'recorded')).toBe(true)
    expect(isMutedByAudioMode('mute_live', 'live')).toBe(true)
    expect(isMutedByAudioMode('mute_live', 'recorded')).toBe(false)
    expect(isMutedByAudioMode('mute_recorded', 'live')).toBe(false)
    expect(isMutedByAudioMode('mute_recorded', 'recorded')).toBe(true)
  })

  it('treats a missing setting as normal', () => {
    expect(isMutedByAudioMode(undefined, 'recorded')).toBe(false)
  })
})

describe('audioModeLabelKey', () => {
  it('names the mode that silenced the player', () => {
    expect(audioModeLabelKey('mute_live')).toBe('playback.liveMuted')
    expect(audioModeLabelKey('mute_recorded')).toBe('playback.recordedMuted')
    expect(audioModeLabelKey('mute_all')).toBe('playback.mutedByApp')
  })
})
