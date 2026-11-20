import { computed, ref } from 'vue'
import type { ShareImportResult } from '@common/notesTypes'
import { exportSlideFilenames } from '@common/notesContent'
import { appearancesForFile } from '@common/sidecars/timeline'
import { createLatest } from '@shared/utils/latest'
import { useShareLinkExport } from './useShareLinkExport'

export interface ViewerSlide {
  index: number
  url: string
  /** First appearance in the lecture (seconds), when the link has a timeline. */
  firstSeen: number | null
}

/** `m:ss` or `h:mm:ss`. */
export function formatClock(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const rest = String(s % 60).padStart(2, '0')
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${rest}` : `${m}:${rest}`
}

/**
 * Drive → Viewer: open a share link (long or short), show its lecture, slides
 * and slide times, and save it into the output folder like Lectures → Clone
 * from Share Link (a link without a timeline is fine here).
 */
export function useShareViewer() {
  const link = ref('')
  const resolving = ref(false)
  const error = ref<string | null>(null)
  const result = ref<ShareImportResult | null>(null)
  const latest = createLatest()
  const saver = useShareLinkExport()

  const slides = computed<ViewerSlide[]>(() => {
    const current = result.value
    if (!current) return []
    const names = exportSlideFilenames(current.urls.length, current.timeline)
    return current.urls.map((url, index) => {
      const spans = current.timeline ? appearancesForFile(current.timeline, names[index]) : []
      return { index, url, firstSeen: spans.length > 0 ? spans[0].startTime : null }
    })
  })

  async function open(value?: string): Promise<void> {
    if (value !== undefined) link.value = value
    const text = link.value.trim()
    if (!text) return
    const current = latest.begin()
    resolving.value = true
    error.value = null
    saver.reset()
    try {
      const answer = await window.electronAPI.cloudNotes.resolveShareLink(text)
      if (!current()) return
      if (answer.ok) {
        result.value = answer.data
      } else {
        result.value = null
        error.value = answer.error
      }
    } catch (e) {
      if (!current()) return
      result.value = null
      error.value = e instanceof Error ? e.message : String(e)
    } finally {
      if (current()) resolving.value = false
    }
  }

  function clear(): void {
    latest.cancel()
    link.value = ''
    result.value = null
    error.value = null
    resolving.value = false
    saver.reset()
  }

  async function save(): Promise<void> {
    const current = result.value
    if (!current) return
    // Plain copy: the result lives in a ref (Recurring #1).
    await saver.startExport(JSON.parse(JSON.stringify(current)) as ShareImportResult)
  }

  return { link, resolving, error, result, slides, open, clear, save, saver }
}
