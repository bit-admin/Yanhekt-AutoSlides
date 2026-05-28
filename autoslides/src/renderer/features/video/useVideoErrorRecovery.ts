import type { Ref, ShallowRef } from 'vue'
import type Hls from 'hls.js'
import type { ErrorData } from 'hls.js'
import { Events, ErrorTypes } from 'hls.js'

export interface FatalErrorContext {
  error: Ref<string | null>
  isRetrying: Ref<boolean>
  retryMessage: Ref<string>
  handleTaskError: (message: string) => void
}

/**
 * Report a terminal (unrecoverable) playback error. This 4-line block was
 * duplicated at six sites across the two single-stream HLS error handlers
 * (network-exhausted, media-exhausted, and default for each); it surfaces the
 * message, clears the retry UI, and notifies the task layer. Behavior is
 * identical at every former call site — only the message varies.
 */
export function createFatalErrorReporter(ctx: FatalErrorContext) {
  return (message: string): void => {
    ctx.error.value = message
    ctx.isRetrying.value = false
    ctx.retryMessage.value = ''
    ctx.handleTaskError(message)
  }
}

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

export interface SingleStreamHlsErrorOptions {
  /** The reactive HLS instance ref the handler operates on (read at fire time). */
  hls: ShallowRef<Hls | null>
  /** Report a terminal error (typically createFatalErrorReporter's result). */
  reportFatal: (message: string) => void
  /** Prefix for the top-level console.error log. */
  logLabel: string
  /** Prefix for the default (other-fatal) console.error log. */
  defaultErrorLabel: string
  /** Called at the start of every fatal error, before the type switch. */
  onFatalStart?: () => void
  /** Called for non-fatal errors. */
  onNonFatal?: (data: ErrorData) => void
  /**
   * Divergent media-error recovery body, invoked after the per-instance media
   * counter is incremented (`attempt` = the new count). Each caller supplies its
   * own recorded/restore recovery strategy (buffer-skip amounts, append-error
   * branch, position replay) — this is where the two single-stream handlers
   * genuinely differ.
   */
  recoverMediaError: (data: ErrorData, attempt: number) => void
}

/**
 * Build the ERROR handler for a single-stream HLS instance. Captures the parts
 * the two call sites (loadVideoSource / loadVideoSourceWithPosition) share
 * verbatim — the fatal/non-fatal gate, the identical NETWORK_ERROR linear-backoff
 * retry, the media-error count gate, and the default fatal report — while leaving
 * the divergent media recovery body to `opts.recoverMediaError`. Each call gets
 * its own private counters.
 */
export function createSingleStreamHlsErrorHandler(
  opts: SingleStreamHlsErrorOptions
): (event: Events.ERROR, data: ErrorData) => void {
  const counters = createRecoveryCounters()

  return (_event: Events.ERROR, data: ErrorData): void => {
    console.error(opts.logLabel, _event, data)

    if (!data.fatal) {
      opts.onNonFatal?.(data)
      return
    }

    opts.onFatalStart?.()

    switch (data.type) {
      case ErrorTypes.NETWORK_ERROR:
        if (counters.networkErrorRecoveryCount < counters.maxRecoveryAttempts) {
          counters.networkErrorRecoveryCount++
          setTimeout(() => {
            if (opts.hls.value) {
              opts.hls.value.startLoad()
            }
          }, 1000 * counters.networkErrorRecoveryCount)
        } else {
          opts.reportFatal('Network error: Unable to load video after multiple attempts')
        }
        break

      case ErrorTypes.MEDIA_ERROR:
        if (counters.mediaErrorRecoveryCount < counters.maxRecoveryAttempts) {
          counters.mediaErrorRecoveryCount++
          opts.recoverMediaError(data, counters.mediaErrorRecoveryCount)
        } else {
          opts.reportFatal('Video decoding error: Unable to decode video after multiple attempts')
        }
        break

      default:
        console.error(opts.defaultErrorLabel, data.details)
        opts.reportFatal('Video playback error: ' + data.details)
        break
    }
  }
}
