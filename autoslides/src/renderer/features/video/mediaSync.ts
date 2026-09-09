// Keeping several media elements playing as one.
//
// Both players already had to do this for their two video panes, and adding
// the classroom mic track makes it three elements in each. Rather than a third
// hand-rolled drift loop, the kernel lives here: one master element owns the
// clock, and every follower is dragged back to it.
//
// Deliberately NOT a "sync everything" helper — rate policy, audio routing and
// UI state differ per player, so each caller still writes its own tick and
// simply calls syncFollower for each follower it owns.

/** How often a running sync loop ticks. */
export const SYNC_INTERVAL_MS = 1500

/**
 * How far a follower may drift before it is snapped back.
 *
 * Loose enough that ordinary decode jitter does not cause constant reseeking
 * (each correction is audible on an audio track), tight enough that lip-sync
 * against the video never becomes distracting.
 */
export const DRIFT_THRESHOLD_S = 0.75

/**
 * Drag one follower back into line with the master: mirror its play/pause
 * state, then correct its position if it has drifted too far.
 *
 * A follower that has not buffered enough to seek is skipped rather than
 * forced — `readyState < 2` means `currentTime` writes are unreliable.
 */
export function syncFollower(
  master: HTMLMediaElement,
  follower: HTMLMediaElement,
  driftThresholdS: number = DRIFT_THRESHOLD_S,
): void {
  if (follower.readyState < 2) return

  if (!master.paused && follower.paused) {
    void follower.play().catch(() => { /* Ignore sync play errors */ })
  } else if (master.paused && !follower.paused) {
    follower.pause()
  }

  // Only correct while the master is actually advancing: snapping during a
  // pause fights the user's own scrubbing.
  const drift = Math.abs((follower.currentTime || 0) - (master.currentTime || 0))
  if (!master.paused && Number.isFinite(drift) && drift > driftThresholdS) {
    try {
      follower.currentTime = master.currentTime
    } catch {
      // Seek can throw while the element is re-buffering; the next tick retries.
    }
  }
}

export interface MediaSyncLoop {
  start(): void
  stop(): void
}

/** A restartable interval. `start` is idempotent — it never stacks timers. */
export function createMediaSyncLoop(onTick: () => void, intervalMs = SYNC_INTERVAL_MS): MediaSyncLoop {
  let handle: ReturnType<typeof setInterval> | null = null

  const stop = (): void => {
    if (handle) {
      clearInterval(handle)
      handle = null
    }
  }

  return {
    start(): void {
      stop()
      handle = setInterval(onTick, intervalMs)
    },
    stop,
  }
}
