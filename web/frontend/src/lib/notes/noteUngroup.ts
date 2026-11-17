/**
 * Moving a note to Ungrouped by recreating it.
 *
 * The server cannot clear a note's group in place, so the note is copied to a
 * new, ungrouped one and the original is deleted. That is four writes with no
 * transaction behind them, so the order is chosen for what a failure leaves:
 *
 * 1. Create the copy, title it, fill it. A failure here removes the copy (it
 *    is ours and unfinished) and reports the error. The original is untouched.
 * 2. Read the copy back. Only a copy that exists and holds content lets the
 *    original go: a write that answered "ok" is not proof of what was stored.
 * 3. Delete the original. If that fails there are two whole notes, which is
 *    reported as `UNGROUP_KEPT_BOTH` so the caller can show both; nothing is
 *    deleted to "tidy up", because both hold the user's content.
 *
 * Nothing is re-sent on a failure: a create that timed out may have arrived,
 * and repeating it would only add notes.
 *
 * Shared by the desktop notes service and the web notes client (identical
 * copies, see `scripts/check-drift.mjs`).
 */

/** Error code: the ungrouped copy was made, but the original could not be deleted. */
export const UNGROUP_KEPT_BOTH = 'ungroup-kept-both';

export interface UngroupOps {
  create(): Promise<number>;
  setTitle(id: number, title: string): Promise<void>;
  setContent(id: number, content: string): Promise<void>;
  /** The stored content of a note, for the read-back. */
  readContent(id: number): Promise<string>;
  remove(id: number): Promise<void>;
  /** Told about steps that could not be undone; never throws. */
  warn(message: string, detail: unknown): void;
}

export async function ungroupByRecreate(
  ops: UngroupOps,
  original: { id: number; title: string; content: string },
): Promise<number> {
  const copyId = await ops.create();
  try {
    await ops.setTitle(copyId, original.title);
    if (original.content) {
      await ops.setContent(copyId, original.content);
      const stored = await ops.readContent(copyId);
      if (!stored) throw new Error('the ungrouped copy came back empty');
    } else {
      // Nothing to fill: the read still proves the copy exists.
      await ops.readContent(copyId);
    }
  } catch (error) {
    try {
      await ops.remove(copyId);
    } catch (cleanup) {
      ops.warn(`could not remove the unfinished ungrouped copy ${copyId}`, cleanup);
    }
    throw error;
  }

  try {
    await ops.remove(original.id);
  } catch (error) {
    ops.warn(`ungrouped copy ${copyId} is complete but the original ${original.id} could not be deleted`, error);
    throw new Error(UNGROUP_KEPT_BOTH);
  }
  return copyId;
}
