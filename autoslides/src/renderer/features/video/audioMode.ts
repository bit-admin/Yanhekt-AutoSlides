// Settings → General → Audio Mode, as both players read it. Pure, so the
// Yanhekt and Yanhe 2.0 players cannot drift apart on what a mode silences.
import type { MuteMode } from '@common/types'

/** Whether the app's Audio Mode silences a player in this mode. */
export function isMutedByAudioMode(muteMode: MuteMode | undefined, mode: 'live' | 'recorded'): boolean {
  switch (muteMode) {
    case 'mute_all':
      return true
    case 'mute_live':
      return mode === 'live'
    case 'mute_recorded':
      return mode === 'recorded'
    case 'normal':
    default:
      return false
  }
}

/** Label shown in place of the volume slider while Audio Mode silences the player. */
export function audioModeLabelKey(muteMode: MuteMode | undefined): string {
  if (muteMode === 'mute_live') return 'playback.liveMuted'
  if (muteMode === 'mute_recorded') return 'playback.recordedMuted'
  return 'playback.mutedByApp'
}
