// Pure helpers for applying playback-rate and mute state to a single <video>
// element. Extracted from useVideoPlayer where the same two blocks were inlined
// in loadVideoSource, loadVideoSourceWithPosition, and switchStream. No Vue
// dependency — callers pass primitives and assign the returned value back to the
// reactive refs they own (currentPlaybackRate / isVideoMuted).

interface PlaybackRateSink {
  setPlaybackRate: (rate: number) => void
}

/**
 * Apply the effective playback rate for the current mode:
 * - recorded: use `desiredRate` (and forward it to the slide extractor)
 * - live: force 1× (the app never speeds up live playback)
 *
 * Returns the rate the caller should store into `currentPlaybackRate.value`.
 */
export function applyPlaybackRate(
  video: HTMLVideoElement,
  mode: 'live' | 'recorded',
  desiredRate: number,
  extractor?: PlaybackRateSink | null
): number {
  if (mode === 'recorded') {
    video.playbackRate = desiredRate
    if (extractor) {
      extractor.setPlaybackRate(Number(desiredRate))
    }
    return desiredRate
  }

  video.playbackRate = 1
  if (extractor) {
    extractor.setPlaybackRate(1)
  }
  return 1
}

/**
 * Apply mute state to a single <video>: volume 0 + `data-muted-by-app` marker
 * when muted, full volume otherwise. Returns the value the caller should store
 * into `isVideoMuted.value`.
 */
export function applyMute(video: HTMLVideoElement, shouldMute: boolean): boolean {
  if (shouldMute) {
    video.volume = 0
    video.setAttribute('data-muted-by-app', 'true')
    return true
  }

  video.volume = 1
  video.removeAttribute('data-muted-by-app')
  return false
}
