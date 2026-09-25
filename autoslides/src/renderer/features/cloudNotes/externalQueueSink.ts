// The visible slide queue shared by providers that only receive images
// (Obsidian, Notion). Kept slides become reactive `entry.items`; they wait while
// the lecture has no target yet or the student paused appending, and are
// written one at a time, in capture order, otherwise. A failed write puts the
// slide back to `queued` and pauses, so nothing is skipped; Resume retries it.
//
// The provider supplies only how one slide is written and how its target is
// released. The full-size PNGs stay out of the reactive entry — the panel only
// needs thumbnails.
import { createLogger } from '@shared/utils/logger'
import type { ExternalWatchNoteEntry, KeptSlide } from './watchNotesTypes'

const log = createLogger('WatchNotesQueue')

/** Thumbnail width in device pixels (rows show it at about half that). */
const THUMB_WIDTH = 192

async function makeThumb(dataUrl: string): Promise<string | null> {
  try {
    const blob = await (await fetch(dataUrl)).blob()
    const bitmap = await createImageBitmap(blob, { resizeWidth: THUMB_WIDTH, resizeQuality: 'medium' })
    const canvas = document.createElement('canvas')
    canvas.width = bitmap.width
    canvas.height = bitmap.height
    canvas.getContext('2d')?.drawImage(bitmap, 0, 0)
    bitmap.close()
    return canvas.toDataURL('image/jpeg', 0.8)
  } catch (err) {
    log.debug('thumbnail failed', err)
    return null
  }
}

export interface ExternalQueueWriter<E extends ExternalWatchNoteEntry> {
  /**
   * Write one slide to the entry's target. Resolve null on success, or the
   * error code to show in the panel (the queue then pauses).
   */
  write(entry: E, bytes: ArrayBuffer, pngFilename: string): Promise<E['lastError']>
  /** Code to show when a write throws instead of resolving (e.g. IPC failure). */
  thrownError: NonNullable<E['lastError']>
  /** The tab closed: release the provider's per-tab target. */
  close(tabId: string): void
}

export interface ExternalQueue<E extends ExternalWatchNoteEntry> {
  deliver(entry: E, slides: KeptSlide[]): void
  /** Write whatever is queued, if the entry has a target and is not paused. */
  drain(entry: E): Promise<void>
  /** Pause or resume appending. Resuming retries a slide whose write failed. */
  setPaused(entry: E, paused: boolean): void
  /** The gallery was cleared: a write in flight finishes; the rest is dropped. */
  discardQueued(entry: E): void
  dispose(tabId: string): void
}

let nextItemId = 1

export function createExternalQueue<E extends ExternalWatchNoteEntry>(
  writer: ExternalQueueWriter<E>,
): ExternalQueue<E> {
  // Per tab, keyed by item id: data URLs of slides not yet written.
  const slideData = new Map<string, Map<number, string>>()
  const draining = new Set<string>()

  async function writeOne(entry: E, dataUrl: string, pngFilename: string): Promise<boolean> {
    let error: E['lastError']
    try {
      const bytes = await (await fetch(dataUrl)).arrayBuffer()
      error = await writer.write(entry, bytes, pngFilename)
    } catch (err) {
      log.warn(`${entry.provider} append threw`, err)
      error = writer.thrownError
    }
    entry.lastError = error
    return error === null
  }

  /**
   * One drain per tab at a time; it re-reads the queue each step, so slides
   * that arrive meanwhile and a pause mid-way are both honored.
   */
  async function drain(entry: E): Promise<void> {
    const tabId = entry.tabId
    if (draining.has(tabId)) return
    draining.add(tabId)
    try {
      while (entry.target && !entry.paused) {
        const data = slideData.get(tabId)
        if (!data) break // tab closed
        const item = entry.items.find((i) => i.status === 'queued')
        if (!item) break
        const dataUrl = data.get(item.id)
        if (dataUrl === undefined) {
          entry.items.splice(entry.items.indexOf(item), 1)
          continue
        }
        item.status = 'appending'
        if (await writeOne(entry, dataUrl, item.pngFilename)) {
          item.status = 'appended'
          data.delete(item.id)
        } else {
          item.status = 'queued'
          entry.paused = true
        }
      }
    } finally {
      draining.delete(tabId)
    }
  }

  return {
    deliver(entry, slides) {
      let data = slideData.get(entry.tabId)
      if (!data) {
        data = new Map()
        slideData.set(entry.tabId, data)
      }
      for (const slide of slides) {
        const id = nextItemId++
        data.set(id, slide.dataUrl)
        entry.items.push({
          id,
          index: (entry.items.at(-1)?.index ?? 0) + 1,
          pngFilename: slide.pngFilename,
          status: 'queued',
          thumb: null,
          queuedAt: Date.now(),
        })
        void makeThumb(slide.dataUrl).then((thumb) => {
          const item = entry.items.find((i) => i.id === id)
          if (item) item.thumb = thumb
        })
      }
      void drain(entry)
    },

    drain,

    setPaused(entry, paused) {
      entry.paused = paused
      if (!paused) void drain(entry)
    },

    discardQueued(entry) {
      const data = slideData.get(entry.tabId)
      for (const item of entry.items) if (item.status === 'queued') data?.delete(item.id)
      entry.items = entry.items.filter((i) => i.status !== 'queued')
    },

    dispose(tabId) {
      slideData.delete(tabId)
      writer.close(tabId)
    },
  }
}
