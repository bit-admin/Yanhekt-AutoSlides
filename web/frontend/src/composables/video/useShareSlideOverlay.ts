// In-memory share-link slides overlay for the recorded web player.
// Resolves images against public COSS in the browser; never writes IndexedDB
// and never calls our Workers. Session-scoped: dies with the playback page.

import {
  computed,
  onUnmounted,
  ref,
  toValue,
  watch,
  type MaybeRefOrGetter,
} from 'vue'
import type { ExtractedSlide } from '../../lib/processing'
import {
  decodeSharePayload,
  decodeShareTimeline,
  parseShareLink,
  payloadHasTimeline,
  precheckShareLinkTimeline,
} from '../../lib/notes/shareLink'
import { fetchShareFragment, resolveShareImages } from '../../lib/notes/shareResolve'
import type { Course } from '../useCourseList'
import type { SessionData } from '../../lib/api'

/** Prefer the later chapter when currentTime is within this of a shared boundary. */
const ACTIVE_BOUNDARY_EPS = 0.12
/** Seek slightly into the chapter so keyframe-early lands still match it. */
export const SHARE_SEEK_INSET_SEC = 0.05
/** HLS currentTime often lags until the seek lands — treat this as "we're there". */
const SEEK_CATCH_SEC = 0.6
const SEEK_PIN_TIMEOUT_MS = 20_000

export type ShareOverlayError =
  | 'invalid'
  | 'no-timeline'
  | 'mismatch'
  | 'empty-images'
  | 'failed'
  | 'not-found'
  | 'unavailable'

export interface SlideChapterCard {
  id: string
  index: number
  slideIndex: number
  startTime: number
  endTime: number
  imageUrl: string
}

function sameDigitId(
  a: string | number | null | undefined,
  b: string | number | null | undefined,
): boolean {
  if (a === null || a === undefined || b === null || b === undefined) return false
  const left = String(a).trim()
  const right = String(b).trim()
  return left.length > 0 && left === right
}

function formatMediaClock(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00'
  const s = Math.floor(seconds)
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const r = s % 60
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`
  return `${m}:${String(r).padStart(2, '0')}`
}

function slideFilename(index: number, count: number): string {
  const width = Math.max(3, String(count).length)
  return `Slide_${String(index + 1).padStart(width, '0')}.png`
}

/** Merge adjacent cues that show the same slide index. */
function coalesceCues(
  cues: Array<readonly [number, number]>,
): Array<{ slideIndex: number; startTime: number; endTime: number }> {
  if (cues.length === 0) return []
  const sorted = [...cues].sort((a, b) => a[1] - b[1] || a[0] - b[0])
  const out: Array<{ slideIndex: number; startTime: number; endTime: number }> = []
  for (const [slideIndex, startTime] of sorted) {
    const last = out[out.length - 1]
    if (last && last.slideIndex === slideIndex) continue
    if (last) last.endTime = startTime
    out.push({ slideIndex, startTime, endTime: Number.POSITIVE_INFINITY })
  }
  return out
}

export function useShareSlideOverlay(opts: {
  course: MaybeRefOrGetter<Course | null>
  session: MaybeRefOrGetter<SessionData | null | undefined>
  currentTime: MaybeRefOrGetter<number>
}) {
  const chapters = ref<SlideChapterCard[]>([])
  const gallerySlides = ref<ExtractedSlide[]>([])
  const loading = ref(false)
  const hasOverlay = computed(() => gallerySlides.value.length > 0)
  const hasChapters = computed(() => chapters.value.length > 0)

  let loadGen = 0
  const pinnedChapterId = ref<string | null>(null)
  const pendingSeekTime = ref<number | null>(null)
  let pinTimer: ReturnType<typeof setTimeout> | null = null
  const hasPendingSeek = computed(() => pendingSeekTime.value != null)

  function chapterIdAt(time: number): string | null {
    if (!Number.isFinite(time) || chapters.value.length === 0) return null
    const matchTime = time + ACTIVE_BOUNDARY_EPS
    for (const card of chapters.value) {
      const end =
        Number.isFinite(card.endTime) && card.endTime > card.startTime
          ? card.endTime
          : Number.POSITIVE_INFINITY
      if (matchTime >= card.startTime && matchTime < end) return card.id
    }
    const last = chapters.value[chapters.value.length - 1]
    if (last && time >= last.startTime) return last.id
    return null
  }

  const activeChapterId = computed(() => {
    if (pinnedChapterId.value) return pinnedChapterId.value
    return chapterIdAt(toValue(opts.currentTime))
  })

  function clearSeekPin(): void {
    if (pinTimer != null) {
      clearTimeout(pinTimer)
      pinTimer = null
    }
    pinnedChapterId.value = null
    pendingSeekTime.value = null
  }

  /** Freeze Watching on the clicked slide until media time actually lands there. */
  function pinSeek(time: number): void {
    pendingSeekTime.value = time
    pinnedChapterId.value = chapterIdAt(time)
    if (pinTimer != null) clearTimeout(pinTimer)
    pinTimer = setTimeout(() => {
      pinTimer = null
      clearSeekPin()
    }, SEEK_PIN_TIMEOUT_MS)
  }

  /** Real media time from the `<video>` element — not the displayed clock. */
  function noteMediaTime(time: number): void {
    const pending = pendingSeekTime.value
    if (pending == null || !Number.isFinite(time)) return
    if (Math.abs(time - pending) <= SEEK_CATCH_SEC) clearSeekPin()
  }

  function clear(): void {
    loadGen += 1
    chapters.value = []
    gallerySlides.value = []
    loading.value = false
    clearSeekPin()
  }

  async function load(link: string): Promise<ShareOverlayError | null> {
    const pre = precheckShareLinkTimeline(link)
    if (pre === 'empty' || pre === 'invalid') return 'invalid'
    if (pre === 'no-timeline') return 'no-timeline'
    if (pre !== 'ok' && pre !== 'short') return 'invalid'

    const parsed = parseShareLink(link)
    let fragment = parsed?.fragment
    const gen = ++loadGen
    loading.value = true
    try {
      if (!fragment && parsed?.shortId) {
        const fetched = await fetchShareFragment(parsed.shortId)
        if (gen !== loadGen) return null
        if ('error' in fetched) return fetched.error
        fragment = fetched.fragment
      }
      if (!fragment) return 'invalid'

      const payload = decodeSharePayload(fragment)
      if (!payload || !payloadHasTimeline(payload) || !payload.t) return 'no-timeline'

      const course = toValue(opts.course)
      const session = toValue(opts.session)
      if (
        !payload.c ||
        !payload.s ||
        !course?.id ||
        !session?.session_id ||
        !sameDigitId(payload.c, course.id) ||
        !sameDigitId(payload.s, session.session_id)
      ) {
        return 'mismatch'
      }

      const resolved = await resolveShareImages(payload)
      if (gen !== loadGen) return null

      const urlByIndex = new Map<number, string>()
      for (const img of resolved) {
        if (img.url) urlByIndex.set(img.index, img.url)
      }
      if (urlByIndex.size === 0) return 'empty-images'

      const rawCues = decodeShareTimeline(payload.t)
      if (!rawCues) return 'no-timeline'
      const usable = rawCues.filter(([idx]) => urlByIndex.has(idx))
      const spans = coalesceCues(usable)
      const nextChapters: SlideChapterCard[] = spans.map((span, index) => ({
        id: `share_${index}_${span.slideIndex}_${span.startTime}`,
        index,
        slideIndex: span.slideIndex,
        startTime: span.startTime,
        endTime: span.endTime,
        imageUrl: urlByIndex.get(span.slideIndex) as string,
      }))

      const firstAt = new Map<number, number>()
      for (const [idx, start] of usable) {
        if (!firstAt.has(idx)) firstAt.set(idx, start)
      }
      const count = Math.max(...urlByIndex.keys(), -1) + 1
      const slides: ExtractedSlide[] = []
      for (const [index, url] of [...urlByIndex.entries()].sort((a, b) => a[0] - b[0])) {
        slides.push({
          id: `share-slide-${index}`,
          title: slideFilename(index, Math.max(count, urlByIndex.size)),
          timestamp: formatMediaClock(firstAt.get(index) ?? 0),
          imageData: null,
          dataUrl: url,
        })
      }
      if (slides.length === 0) return 'empty-images'

      chapters.value = nextChapters
      gallerySlides.value = slides
      return null
    } catch {
      if (gen !== loadGen) return null
      return 'failed'
    } finally {
      if (gen === loadGen) loading.value = false
    }
  }

  watch(
    () => {
      const course = toValue(opts.course)
      const session = toValue(opts.session)
      return `${course?.id ?? ''}::${session?.session_id ?? ''}`
    },
    () => {
      if (hasOverlay.value || loading.value) clear()
    },
  )

  onUnmounted(() => {
    clear()
  })

  return {
    chapters,
    gallerySlides,
    loading,
    hasOverlay,
    hasChapters,
    activeChapterId,
    hasPendingSeek,
    pinSeek,
    clearSeekPin,
    noteMediaTime,
    load,
    clear,
  }
}

export type UseShareSlideOverlayReturn = ReturnType<typeof useShareSlideOverlay>
