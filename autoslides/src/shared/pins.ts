/**
 * Pinned courses: one pin is one course, on Yanhekt, on Yanhe 2.0, or both.
 *
 * A pin's `id` is its key. It is the Yanhekt course id when Yanhekt has the
 * course (every pin from before Yanhe 2.0 sync is one), else `yanhe2:<aita id>`
 * (a lab or practice course without recordings is on Yanhe 2.0 only).
 */
import type { PinnedCourse } from './types';

export const YANHE2_PIN_PREFIX = 'yanhe2:';

/** The Yanhekt course id of a pin, or '' when Yanhekt does not have it. */
export const yanhektIdOf = (pin: Pick<PinnedCourse, 'id'>): string => {
  const id = String(pin.id ?? '');
  return id.startsWith(YANHE2_PIN_PREFIX) ? '' : id;
};

/** The key of a pin that only Yanhe 2.0 has. */
export const yanhe2PinKey = (yanhe2Id: string): string => `${YANHE2_PIN_PREFIX}${yanhe2Id}`;

/** Whether a stored pin shows for `owner` (null: no account known, show all). */
export const belongsTo = (pin: Pick<PinnedCourse, 'owner'>, owner: string | null): boolean =>
  !owner || !pin.owner || pin.owner === owner;

/** What the renderer sends to pin a course: a Yanhekt id, a Yanhe 2.0 id, or both. */
export type PinRequest = Omit<PinnedCourse, 'id' | 'owner' | 'yanhe2MissingAt' | 'yanhektMissingAt'> & {
  /** The Yanhekt course id, or '' when pinning from Yanhe 2.0. */
  id: string;
};
