/**
 * Which pins stay and what to send each site, for one account's sync.
 *
 * A pin is one course with up to two ids: Yanhekt's and Yanhe 2.0's. Each
 * site's own list is compared with what that site held after the last sync
 * (its base), so a change on any side is told apart from "never had it":
 *
 * | in base | on site now | pinned here | signal                    |
 * |---------|-------------|-------------|---------------------------|
 * | yes     | no          | any         | removed on the site       |
 * | yes     | yes         | no          | removed here              |
 * | no      | yes         | any         | added on the site         |
 * | no      | no          | yes         | added here, not sent yet  |
 *
 * A course is kept when any side added it, or when it is pinned here and no
 * side removed it. Add wins a conflict, so nothing is lost by accident.
 * A site never synced (base null) has an empty base: the first sync is the
 * union of every side.
 *
 * Which site covers a course:
 * - Yanhe 2.0: every course it has an id for, any term.
 * - Yanhekt: a course it has an id for that is on its list now, was on it at
 *   the last sync, or is from the current term. Its list no longer returns
 *   earlier terms, so sending those would be retried forever.
 * A site that was not reached this time (signed out, failed) covers nothing:
 * its pins stay as they are and its base is left alone.
 *
 * Pure, so it can be tested without Electron.
 */
import { termKeyOf } from '@common/searchSources';
import { yanhektIdOf } from '@common/pins';
import type { PinnedCourse } from '@common/types';

export type PinSite = 'yanhekt' | 'yanhe2';

export interface PinSiteState {
  /** Course ids the site holds now; null when it was not reached this sync. */
  remote: ReadonlySet<string> | null;
  /** Course ids it held after the last sync; null when never synced. */
  base: ReadonlySet<string> | null;
}

export interface PinEntry {
  pin: PinnedCourse;
  /** Pinned here before this sync (not only brought in by a site's list). */
  local: boolean;
  /** The local keys this entry stands for (two when a twin joined two pins). */
  originKeys: string[];
}

export interface PinPush {
  site: PinSite;
  courseId: string;
  on: boolean;
  /** The pin's key, to skip a push whose pin changed while syncing. */
  key: string;
}

export interface PinSyncPlan {
  kept: PinEntry[];
  pushes: PinPush[];
}

const termOf = (pin: PinnedCourse): string | null =>
  pin.school_year && pin.semester ? termKeyOf(pin.school_year, pin.semester) : null;

function siteIdOf(site: PinSite, pin: PinnedCourse): string {
  return site === 'yanhekt' ? yanhektIdOf(pin) : (pin.yanhe2Id ?? '');
}

function covers(site: PinSite, state: PinSiteState, pin: PinnedCourse, currentTerm: string | null): boolean {
  const id = siteIdOf(site, pin);
  if (!id || !state.remote) return false;
  if (site === 'yanhe2') return true;
  return state.remote.has(id) || !!state.base?.has(id) || (!!currentTerm && termOf(pin) === currentTerm);
}

export function planPinSync(
  entries: PinEntry[],
  sites: Record<PinSite, PinSiteState>,
  currentTerm: string | null,
): PinSyncPlan {
  const kept: PinEntry[] = [];
  const pushes: PinPush[] = [];
  const siteNames: PinSite[] = ['yanhekt', 'yanhe2'];

  for (const entry of entries) {
    const covering = siteNames.filter((site) => covers(site, sites[site], entry.pin, currentTerm));
    let added = false;
    let removed = false;
    for (const site of covering) {
      const id = siteIdOf(site, entry.pin);
      const onSite = sites[site].remote!.has(id);
      const inBase = !!sites[site].base?.has(id);
      if (inBase && !onSite) removed = true;
      else if (inBase && onSite && !entry.local) removed = true;
      else if (!inBase && onSite) added = true;
    }
    const keep = added || (entry.local && !removed);
    if (keep) kept.push(entry);

    for (const site of covering) {
      const id = siteIdOf(site, entry.pin);
      const onSite = sites[site].remote!.has(id);
      if (keep !== onSite) pushes.push({ site, courseId: id, on: keep, key: entry.pin.id });
    }
  }
  return { kept, pushes };
}
