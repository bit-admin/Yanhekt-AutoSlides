/**
 * The server slides of one Yanhe 2.0 recording: the list aita detects on the
 * screen recording after class. Display only — nothing here extracts, saves
 * or post-processes.
 *
 * Asked for once the recording itself has loaded (a live lecture has none),
 * and again whenever the page reloads the session. The image URLs point at the
 * local proxy, which the player keeps running for as long as the tab is open.
 *
 * Each image is fetched exactly once, here, and held as a blob in memory: the
 * proxy answers `no-store`, so an `<img>` pointed at it would ask again for
 * the preview and again for Copy. The thumbnail, the preview and Copy all read
 * the one blob URL instead, and nothing reaches Chromium's disk cache.
 */
import { computed, onScopeDispose, ref, watch, type Ref } from 'vue'
import type { Yanhe2Playback } from '@common/yanhe2Playback'
import type { Yanhe2Slide } from '@common/yanhe2Slides'
import { createLogger } from '@shared/utils/logger'

const log = createLogger('Yanhe2Slides')

/** How many images are in flight at once; they are asked for in slide order. */
const IMAGE_CONCURRENCY = 6

export interface Yanhe2LoadedSlide {
  seconds: number
  /** A blob URL once the image has arrived; empty until then, or if it never does. */
  src: string
  /** The image did not arrive; Retry asks for it again. */
  failed?: boolean
}

/** `idle` = not a recording, so there is nothing to ask for. */
export type Yanhe2SlidesState = 'idle' | 'loading' | 'ready' | 'failed'

export function useYanhe2Slides(options: {
  account: string
  courseId: string
  subId: string
  playback: Ref<Yanhe2Playback | null>
}) {
  const { account, courseId, subId, playback } = options

  const slides = ref<Yanhe2LoadedSlide[]>([])
  const state = ref<Yanhe2SlidesState>('idle')
  let ticket = 0
  let blobUrls: string[] = []
  let imageRows: Yanhe2Slide[] = []

  const releaseImages = () => {
    for (const url of blobUrls) URL.revokeObjectURL(url)
    blobUrls = []
  }

  const loadImages = async (rows: Yanhe2Slide[], mine: number, only?: number[]) => {
    const wanted = only ?? rows.map((_, index) => index)
    let next = 0
    const worker = async () => {
      while (mine === ticket && next < wanted.length) {
        const index = wanted[next++]
        try {
          const response = await fetch(rows[index].url)
          if (!response.ok) throw new Error(`HTTP ${response.status}`)
          const blob = await response.blob()
          if (mine !== ticket) return
          const src = URL.createObjectURL(blob)
          blobUrls.push(src)
          slides.value[index].src = src
          slides.value[index].failed = false
        } catch (error) {
          if (mine === ticket) {
            log.warn(`Yanhe 2.0 slide ${index + 1} did not load:`, error)
            slides.value[index].failed = true
          }
        }
      }
    }
    await Promise.all(Array.from({ length: Math.min(IMAGE_CONCURRENCY, wanted.length) }, worker))
  }

  const load = async () => {
    const mine = ++ticket
    slides.value = []
    releaseImages()
    if (playback.value?.mode !== 'recorded') {
      state.value = 'idle'
      return
    }
    state.value = 'loading'
    try {
      const result = await window.electronAPI.yanhe2.slides(account, { courseId, subId })
      if (mine !== ticket) return
      if (result.kind === 'ok') {
        slides.value = result.data.map((slide) => ({ seconds: slide.seconds, src: '' }))
        state.value = 'ready'
        imageRows = result.data
        void loadImages(result.data, mine)
      } else {
        state.value = 'failed'
      }
    } catch (error) {
      if (mine !== ticket) return
      log.error('Yanhe 2.0 slides load failed:', error)
      state.value = 'failed'
    }
  }

  const failedCount = computed(() => slides.value.filter((slide) => slide.failed).length)

  /** Ask again for the images that failed, and only those. */
  const retryFailed = () => {
    const only = slides.value.flatMap((slide, index) => (slide.failed ? [index] : []))
    if (only.length === 0) return
    for (const index of only) slides.value[index].failed = false
    void loadImages(imageRows, ticket, only)
  }

  watch(playback, load, { immediate: true })

  onScopeDispose(() => {
    ticket++
    releaseImages()
  })

  return { slides, state, load, failedCount, retryFailed }
}
