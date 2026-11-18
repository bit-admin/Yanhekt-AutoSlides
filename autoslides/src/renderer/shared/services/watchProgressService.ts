import { ApiClient } from './apiClient'
import { tokenManager } from './authService'
import { PROGRESS_BUCKET_SECONDS, progressBucket } from '@common/watchProgress'
import { createLogger } from '@shared/utils/logger'

const log = createLogger('WatchProgressService')

const apiClient = new ApiClient()

/** One heartbeat per 5 seconds of *wall clock* — see {@link createWatchProgressSync}. */
const HEARTBEAT_MS = PROGRESS_BUCKET_SECONDS * 1000

export interface WatchProgressSync {
  /** Server position to open at, or null for the beginning. Safe to call when disabled. */
  resume(): Promise<number | null>
  /** Begin reporting. Idempotent — a second call while running is a no-op. */
  start(): void
  /** Stop reporting and send one last position. */
  stop(): void
}

export interface WatchProgressSyncOptions {
  /** Recorded session id, or undefined when there is nothing to sync against. */
  sessionId: () => string | undefined
  /**
   * The session's course id, when known. Only used for an expired course,
   * whose session refuses by id and is read off the course's session list.
   */
  courseId?: () => string | undefined
  /** The user's opt-in for this surface, re-read on every call. */
  enabled: () => boolean
  /** Current playhead in seconds. */
  getCurrentTime: () => number
  /** False while paused, ended or not yet started — no heartbeat then. */
  isPlaying: () => boolean
}

/**
 * Yanhekt's per-account watch position for one recorded session: read it when a
 * lecture opens, report it back while it plays.
 *
 * Shared by the playback page (`useVideoPlayer`) and the Lectures player so the
 * rules live in one place. Everything is best-effort — a failure anywhere means
 * "start at 0" / "skip this heartbeat", never a visible error.
 *
 * **The heartbeat is wall-clock, not `timeupdate`.** A manual watch tab can run
 * at up to 16x, where a media-time trigger would fire several PUTs per second;
 * a 5s interval that reports `floor(currentTime / 5) * 5` reproduces the
 * official player's cadence at 1x and stays polite above it.
 */
export function createWatchProgressSync(opts: WatchProgressSyncOptions): WatchProgressSync {
  let timer: ReturnType<typeof setInterval> | null = null
  // Keyed by session: the Lectures player reuses one sync across episodes, and a
  // bucket carried over from the previous lecture would suppress reports for the
  // new one until it played past that point.
  // Keyed by account too: the position is per account, so what one account
  // reported must not suppress the next account's report of the same bucket.
  let lastReported: { sessionId: string; token: string; bucket: number } | null = null

  // A session id AND the opt-in AND a login token — the position is per account.
  const context = (): { sessionId: string; token: string } | null => {
    if (!opts.enabled()) return null
    const sessionId = opts.sessionId()
    const token = tokenManager.getToken()
    if (!sessionId || !token) return null
    return { sessionId, token }
  }

  const report = (): void => {
    const ctx = context()
    if (!ctx) return

    const bucket = progressBucket(opts.getCurrentTime())
    if (bucket <= 0) return
    if (
      lastReported?.sessionId === ctx.sessionId &&
      lastReported.token === ctx.token &&
      lastReported.bucket === bucket
    ) return

    lastReported = { ...ctx, bucket }
    void apiClient.reportWatchProgress(ctx.sessionId, bucket, ctx.token)
  }

  return {
    async resume() {
      const ctx = context()
      if (!ctx) return null

      const courseId = opts.courseId?.()
      const position = await apiClient.getResumePosition(
        ctx.sessionId,
        ctx.token,
        courseId != null && courseId !== '' ? String(courseId) : undefined,
      )
      // Answered for a lecture or an account that is no longer the one playing:
      // nothing to seek to and nothing to record.
      const now = context()
      if (now?.sessionId !== ctx.sessionId || now.token !== ctx.token) return null
      // The seek we are about to perform is already known to the server; a
      // fresh start clears the slate so the first heartbeat always lands.
      lastReported = position === null
        ? null
        : { ...ctx, bucket: progressBucket(position) }
      if (position !== null) log.debug('Resuming session', ctx.sessionId, 'at', position)
      return position
    },

    start() {
      if (timer) return
      timer = setInterval(() => {
        if (opts.isPlaying()) report()
      }, HEARTBEAT_MS)
    },

    stop() {
      if (timer) {
        clearInterval(timer)
        timer = null
      }
      // Final position, so closing a tab mid-lecture is not rounded away.
      report()
    },
  }
}
