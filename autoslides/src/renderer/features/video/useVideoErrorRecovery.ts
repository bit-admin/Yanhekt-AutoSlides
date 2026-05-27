import type Hls from 'hls.js'
import { Events, ErrorTypes } from 'hls.js'

/**
 * Error recovery counters used across the three HLS / video-element error
 * handlers in useVideoPlayer. Each error handler instance gets its own counters
 * via this factory — counters must be per-stream-instance, not shared.
 */
export interface RecoveryCounters {
  networkErrorRecoveryCount: number
  mediaErrorRecoveryCount: number
  maxRecoveryAttempts: number
}

export function createRecoveryCounters(maxRecoveryAttempts = 3): RecoveryCounters {
  return {
    networkErrorRecoveryCount: 0,
    mediaErrorRecoveryCount: 0,
    maxRecoveryAttempts
  }
}

export interface DualHlsErrorOptions {
  /** Mode determines whether currentTime nudge is applied on media-error recovery. */
  mode: 'live' | 'recorded'
  /** Set when an unrecoverable error happens — typically points to a reactive `error` ref. */
  onFatal: (message: string) => void
}

/**
 * Attach an error handler suitable for one of the two HLS instances in dual-stream
 * playback. Network errors retry with linear backoff up to `maxRecoveryAttempts`;
 * media errors call `hls.recoverMediaError()` with a small currentTime nudge in
 * recorded mode. Each call creates its own private counters.
 */
export function setupDualHlsErrorHandler(
  hlsInstance: Hls,
  video: HTMLVideoElement,
  label: string,
  opts: DualHlsErrorOptions
): void {
  const counters = createRecoveryCounters()

  hlsInstance.on(Events.ERROR, (_event, data) => {
    console.error(`Dual HLS error (${label}):`, _event, data)

    if (!data.fatal) {
      console.warn(`Non-fatal dual HLS error (${label}):`, data.details, data)
      return
    }

    switch (data.type) {
      case ErrorTypes.NETWORK_ERROR:
        if (counters.networkErrorRecoveryCount < counters.maxRecoveryAttempts) {
          counters.networkErrorRecoveryCount++
          setTimeout(() => {
            hlsInstance.startLoad()
          }, 1000 * counters.networkErrorRecoveryCount)
        } else {
          opts.onFatal(`Network error: Unable to load ${label} stream after multiple attempts`)
        }
        break

      case ErrorTypes.MEDIA_ERROR:
        if (counters.mediaErrorRecoveryCount < counters.maxRecoveryAttempts) {
          counters.mediaErrorRecoveryCount++
          const currentPosition = video.currentTime || 0
          setTimeout(() => {
            try {
              hlsInstance.recoverMediaError()
              if (currentPosition > 0 && opts.mode === 'recorded') {
                video.currentTime = currentPosition + 0.5
              }
            } catch (recoveryError) {
              console.error(`Dual media recovery failed (${label}):`, recoveryError)
            }
          }, 500 * counters.mediaErrorRecoveryCount)
        } else {
          opts.onFatal(`Video decoding error: Unable to decode ${label} stream after multiple attempts`)
        }
        break

      default:
        opts.onFatal(`Video playback error (${label}): ${data.details}`)
        break
    }
  })
}
