/**
 * Which pins follow the Yanhekt subscription list and which stay local.
 *
 * Yanhekt's subscription list no longer returns courses from earlier terms, so
 * only current-term pins sync with it. A pin from an earlier term lives only in
 * the local list: it is never sent to Yanhekt, and a sync never drops it.
 *
 * Pins live in one config list shared by every saved account, so each pin
 * carries the badge of the account that pinned it (`owner`). A pin without an
 * owner predates this and belongs to whichever account syncs next.
 *
 * Pure, so it can be tested without Electron.
 */
import { termKeyOf } from '@common/searchSources'
import type { PinnedCourse } from '@common/types'

/** `2026-2027-1` for a pin or course, or null when its term is unknown. */
export const pinTermKey = (p: Pick<PinnedCourse, 'school_year' | 'semester'>): string | null =>
  p.school_year && p.semester ? termKeyOf(p.school_year, p.semester) : null

/**
 * True when the course is from an earlier term than `currentTerm`, so its pin
 * stays local. Unknown terms (either side) count as current: the pin then goes
 * through Yanhekt as before.
 */
export const isEarlierTermPin = (
  p: Pick<PinnedCourse, 'school_year' | 'semester'>,
  currentTerm: string | null,
): boolean => {
  if (!currentTerm) return false
  const term = pinTermKey(p)
  return term !== null && term < currentTerm
}

/** Whether a stored pin shows for `owner` (null: no account known, show all). */
export const belongsTo = (p: PinnedCourse, owner: string | null): boolean =>
  !owner || !p.owner || p.owner === owner

/**
 * The stored list after a subscription sync for `owner`:
 * - the subscription rows, which replace this account's current-term pins;
 * - this account's earlier-term pins that Yanhekt did not return (kept local);
 * - every other account's pins, untouched.
 *
 * A pin with an unknown term that Yanhekt did not return is kept too: we
 * cannot tell whether it was unpinned elsewhere, and dropping it could lose an
 * earlier-term pin. With `currentTerm` unknown, nothing of this account's is
 * dropped (the rows are only added and refreshed).
 */
export function mergeSyncedPins(
  stored: PinnedCourse[],
  serverPins: PinnedCourse[],
  owner: string,
  currentTerm: string | null,
): PinnedCourse[] {
  const fromServer = serverPins.map(p => ({ ...p, id: String(p.id), owner }))
  const serverIds = new Set(fromServer.map(p => p.id))
  const kept: PinnedCourse[] = []
  const others: PinnedCourse[] = []
  for (const p of stored) {
    if (p.owner && p.owner !== owner) {
      others.push(p)
      continue
    }
    if (serverIds.has(String(p.id))) continue
    const term = pinTermKey(p)
    const keep = !currentTerm || term === null || term < currentTerm
    if (keep) kept.push({ ...p, id: String(p.id), owner })
  }
  return [...fromServer, ...kept, ...others]
}
