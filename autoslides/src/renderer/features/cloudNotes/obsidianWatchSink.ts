// Obsidian watch-notes sink: appends kept slide images to a Markdown note. The
// main process (ObsidianNotesService) owns every path; this side passes a tab id,
// PNG bytes and the slide's file name.
//
// Kept slides go through a visible per-entry queue (`entry.items`): they wait
// while the lecture has no note yet or the student paused appending, and are
// written one at a time, in capture order, otherwise. A failed write pauses the
// queue so nothing is skipped; Resume retries it.
import { configStore } from '@shared/services/configStore'
import { createLogger } from '@shared/utils/logger'
import { buildManagedNoteTitle } from '@common/notesTypes'
import type { ObsidianTargetInfo } from '@common/obsidianNotesTypes'
import type { KeptSlide, ObsidianWatchNoteEntry, WatchNotesSink } from './watchNotesTypes'

const log = createLogger('WatchNotesObsidian')

/** Thumbnail width in device pixels (rows show it at about half that). */
const THUMB_WIDTH = 192

// Full-size PNG data URLs of slides not yet written, per tab, keyed by item id.
// Kept out of the reactive entry on purpose — the panel only needs thumbnails.
const slideData = new Map<string, Map<number, string>>()
const draining = new Set<string>()
let nextItemId = 1

function bridge() {
  return window.electronAPI.obsidianNotes
}

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

async function appendOne(entry: ObsidianWatchNoteEntry, dataUrl: string, pngFilename: string): Promise<boolean> {
  try {
    const bytes = await (await fetch(dataUrl)).arrayBuffer()
    const res = await bridge().append(entry.tabId, bytes, pngFilename)
    if (res.ok) {
      entry.lastError = null
      return true
    }
    log.warn('Obsidian append failed', res.error, res.message)
    entry.lastError = res.error
  } catch (err) {
    log.warn('Obsidian append threw', err)
    entry.lastError = 'io'
  }
  return false
}

/**
 * Write queued slides in order until the queue is empty, paused, or the entry
 * has no note. One drain per tab at a time; it re-reads the queue each step, so
 * slides that arrive meanwhile and a pause mid-way are both honored.
 */
async function drain(entry: ObsidianWatchNoteEntry): Promise<void> {
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
      if (await appendOne(entry, dataUrl, item.pngFilename)) {
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

function applyTarget(entry: ObsidianWatchNoteEntry, target: ObsidianTargetInfo): void {
  entry.target = target
  entry.status = 'ready'
  entry.lastError = null
  void drain(entry)
}

/**
 * Create (or reuse) the lecture's note in the configured vault. On failure the
 * entry goes back to `awaiting` with the reason, so Choose Note… still works.
 */
export async function createLectureNote(entry: ObsidianWatchNoteEntry): Promise<boolean> {
  entry.status = 'creating'
  const title = buildManagedNoteTitle(entry.displayName, entry.identity)
  try {
    const res = await bridge().openAuto(entry.tabId, title, entry.slidesFolderName)
    if (res.ok) {
      applyTarget(entry, res.data)
      return true
    }
    entry.lastError = res.error
  } catch (err) {
    log.warn('openAuto failed', err)
    entry.lastError = 'io'
  }
  entry.status = entry.target ? 'ready' : 'awaiting'
  return false
}

/** Main-side file dialog; resolves false when cancelled or refused. */
export async function chooseNote(entry: ObsidianWatchNoteEntry): Promise<boolean> {
  try {
    const res = await bridge().chooseNote(entry.tabId, entry.slidesFolderName)
    if (!res.ok) {
      entry.lastError = res.error
      return false
    }
    if (!res.data) return false
    applyTarget(entry, res.data)
    return true
  } catch (err) {
    log.warn('chooseNote failed', err)
    entry.lastError = 'io'
    return false
  }
}

/** Pause or resume appending. Resuming retries a slide whose write failed. */
export function setPaused(entry: ObsidianWatchNoteEntry, paused: boolean): void {
  entry.paused = paused
  if (!paused) void drain(entry)
}

export const obsidianWatchSink: WatchNotesSink<ObsidianWatchNoteEntry> = {
  async open(entry) {
    if (configStore.obsidianAutoCreateNote && configStore.obsidianVaultPath) {
      await createLectureNote(entry)
    } else {
      entry.status = 'awaiting'
    }
  },

  deliver(entry, slides: KeptSlide[]) {
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

  // A write already in flight finishes; everything still queued is dropped.
  discardQueued(entry) {
    const data = slideData.get(entry.tabId)
    for (const item of entry.items) if (item.status === 'queued') data?.delete(item.id)
    entry.items = entry.items.filter((i) => i.status !== 'queued')
  },

  dispose(tabId) {
    slideData.delete(tabId)
    void bridge().close(tabId).catch(() => undefined)
  },
}
