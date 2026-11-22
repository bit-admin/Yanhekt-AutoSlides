/**
 * The saves of one open note, in order.
 *
 * A note is written by replacing its whole content, so two saves in flight at
 * once can land in either order and leave the older text on the server. Here
 * one write runs at a time; while it runs only the newest unsent snapshot is
 * kept (an older one it replaces would have been overwritten anyway).
 *
 * The baseline (the content the server is known to hold) belongs to this
 * chain: an editor makes a new chain for each note it opens, so a save of the
 * note just left that finishes late cannot pass for the new note's baseline.
 *
 * A failed write keeps the note dirty: the baseline does not move, so the
 * same content saved again is sent again, and `save` answers false.
 *
 * One chain is one note of one account on one device; it orders this editor's
 * own writes and nothing else.
 */
export interface NoteSnapshot {
  /** The serialized blocks alone: what tells an edit from no edit (the full content carries a save time). */
  blocks: string
  /** The whole document, as it is sent. */
  content: string
}

export interface NoteSaveChain {
  /** The content the editor loaded, before any edit. */
  setBaseline(blocks: string): void
  /**
   * Save this snapshot, after whatever is being written. Resolves once it has
   * been written (or replaced by a newer snapshot that has): true when the
   * server holds the newest content given so far.
   */
  save(snapshot: NoteSnapshot): Promise<boolean>
  /** True when content given to `save` is not on the server (unsent, in flight, or failed). */
  readonly dirty: boolean
  /** Send nothing more. A write already out finishes, with no effect here. */
  close(): void
}

export interface NoteSaveChainHooks {
  /** A write is about to go out. */
  onWriteStart?: () => void
  /** The chain has nothing left to send; `saved` is whether the last write succeeded. */
  onSettled?: (saved: boolean) => void
}

const SAVE_RETRY_DELAYS_MS = [30_000, 60_000, 120_000, 300_000]

/**
 * How long autosave waits after this many failures in a row. Yanhekt's content
 * write is often down, so new edits must not send a request every second.
 */
export function saveRetryDelayMs(failures: number): number {
  if (failures <= 0) return 0
  return SAVE_RETRY_DELAYS_MS[Math.min(failures, SAVE_RETRY_DELAYS_MS.length) - 1]
}

export function createNoteSaveChain(
  write: (content: string) => Promise<boolean>,
  hooks: NoteSaveChainHooks = {},
): NoteSaveChain {
  let baseline: string | null = null
  let pending: NoteSnapshot | null = null
  let draining: Promise<boolean> | null = null
  /** The newest snapshot handed in differs from the baseline and has not been written. */
  let failed = false
  let closed = false

  async function drain(): Promise<boolean> {
    let saved = true
    while (pending && !closed) {
      const next = pending
      pending = null
      if (next.blocks === baseline) {
        // Edited back to what is saved: nothing to send.
        failed = false
        saved = true
        continue
      }
      hooks.onWriteStart?.()
      let ok = false
      try {
        ok = await write(next.content)
      } catch {
        ok = false
      }
      if (closed) return false
      if (ok) baseline = next.blocks
      failed = !ok
      saved = ok
    }
    if (!closed) hooks.onSettled?.(saved)
    return saved
  }

  return {
    setBaseline(blocks) {
      baseline = blocks
      failed = false
    },
    save(snapshot) {
      if (closed) return Promise.resolve(false)
      if (!draining && !pending && snapshot.blocks === baseline) {
        // Edited back to what is saved after a failure: the note is in sync again.
        if (failed) {
          failed = false
          hooks.onSettled?.(true)
        }
        return Promise.resolve(true)
      }
      pending = snapshot
      if (!draining) {
        draining = drain().finally(() => {
          draining = null
        })
      }
      return draining
    },
    get dirty() {
      return failed || pending !== null || draining !== null
    },
    close() {
      closed = true
      pending = null
    },
  }
}
