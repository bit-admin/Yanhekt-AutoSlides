/**
 * Yanhekt server-side watch progress — pure domain.
 *
 * Yanhekt stores one watch position per account per recorded session:
 *
 * - `GET /v1/course/session?session_id=` **with a Bearer** carries `user_progress`,
 *   which is `[]` when this account never played the session and an object once it
 *   has. `progress_current` / `progress_overall` are decimal *strings* of integer
 *   seconds (playhead / session duration).
 * - `PUT /v1/course/session/user/progress` takes `{ session_id, seconds }`. The
 *   official player sends it while playing, always on a multiple of 5 seconds.
 *
 * Everything here is pure so it can be unit-tested without a browser, Vue or the
 * network; the effectful half lives in `composables/video/useWatchProgress.ts`.
 *
 * Copied from autoslides/src/shared/watchProgress.ts (drift group `watchProgress`)
 * — the rules must match the desktop app exactly, since both write the same
 * server-side position for the same account.
 */

export interface SessionWatchProgress {
  /** Playhead in seconds. */
  current: number;
  /** Session duration in seconds, as the server knows it. */
  overall: number;
}

/** The official site only ever reports multiples of this. */
export const PROGRESS_BUCKET_SECONDS = 5;

/** Below this, resuming is not worth the surprise — start at the beginning. */
export const MIN_RESUME_SECONDS = 10;

/** Within this of the end the lecture counts as finished, so it reopens at 0. */
export const END_MARGIN_SECONDS = 15;

/** Decimal string or number → finite seconds, else null. */
function toSeconds(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * Read the `user_progress` field of a session-detail response.
 *
 * Returns null for every "no history" answer the API has: the `[]` an unwatched
 * session returns, a missing field, and anything whose numbers do not parse.
 */
export function parseUserProgress(raw: unknown): SessionWatchProgress | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;

  const row = raw as Record<string, unknown>;
  const current = toSeconds(row.progress_current);
  const overall = toSeconds(row.progress_overall);
  if (current === null || current < 0) return null;

  return { current, overall: overall !== null && overall > 0 ? overall : 0 };
}

/**
 * Where playback should start given the server's position, or null for "the
 * beginning". A position in the first {@link MIN_RESUME_SECONDS} is not worth
 * restoring, and one within {@link END_MARGIN_SECONDS} of the end means the
 * lecture was watched to completion — reopening it on the closing seconds would
 * be useless. `overall` of 0 means the server did not say, so only the low bound
 * applies.
 */
export function resumePositionFor(progress: SessionWatchProgress | null): number | null {
  if (!progress) return null;
  if (progress.current < MIN_RESUME_SECONDS) return null;
  if (progress.overall > 0 && progress.current >= progress.overall - END_MARGIN_SECONDS) return null;
  return progress.current;
}

/**
 * The value to report for a playhead: floored onto the 5-second grid the official
 * player uses, so our heartbeats are indistinguishable from its own.
 */
export function progressBucket(seconds: number): number {
  if (!Number.isFinite(seconds) || seconds <= 0) return 0;
  return Math.floor(seconds / PROGRESS_BUCKET_SECONDS) * PROGRESS_BUCKET_SECONDS;
}
