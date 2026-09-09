import { onBeforeUnmount, ref, watch, type Ref } from 'vue'

/**
 * Anything that can change whether an element has a frame to show. Deliberately
 * broad: the point is that no wait goes unreported, and re-evaluating is cheap.
 */
const WATCHED_EVENTS = [
  'loadstart',
  'emptied',
  'loadedmetadata',
  'loadeddata',
  'canplay',
  'canplaythrough',
  'progress',
  'waiting',
  'stalled',
  'suspend',
  'seeking',
  'seeked',
  'play',
  'playing',
  'pause',
  'timeupdate',
  'ended',
  'error',
  'abort',
  'ratechange',
] as const

/** `HAVE_FUTURE_DATA` — below this the element has nothing to render forward. */
const HAVE_FUTURE_DATA = 3

/**
 * HLS dips in and out of `waiting` on fragment boundaries, so a spinner wired
 * straight to the events strobes. Only a wait that outlasts this shows;
 * recovery hides it at once.
 */
const SHOW_DELAY_MS = 250

export interface BufferingIndicatorOptions {
  /**
   * Force the ring off — for a player that is showing an error instead, where
   * an element left holding no data would otherwise spin forever.
   */
  suppress?: () => boolean
}

/**
 * Is any of these media elements unable to show a frame right now?
 *
 * Event-driven but **state-based**: an element counts as buffering whenever it
 * has a source attached and `readyState < HAVE_FUTURE_DATA`, not merely when it
 * fired `waiting`. That is what makes this generic — the same ring covers the
 * silent black-screen waits that never fire a stall event at all: the gap
 * between attaching HLS and the first decoded frame, a stream switch tearing
 * the source down and rebuilding it, a seek into an unbuffered region, and a
 * mid-lecture stall. An element with no source yet is *not* buffering, so a
 * player that has not loaded anything does not spin forever.
 *
 * Takes several refs because every player here has more than one element: the
 * playback page swaps between a single `<video>` and a synced camera+screen
 * pair, and the Lectures player adds its own. In dual mode either stream
 * starving holds up both, so one overlay covers the pair.
 */
export function useBufferingIndicator(
  elements: Array<Ref<HTMLMediaElement | null>>,
  options: BufferingIndicatorOptions = {},
) {
  const isBuffering = ref(false)
  let showTimer: ReturnType<typeof setTimeout> | null = null

  const isStarving = (el: HTMLMediaElement): boolean => {
    // No source attached yet (or just torn down) — nothing is being waited for.
    // hls.js sets a blob src on attachMedia, so the manifest wait *is* counted.
    if (!el.currentSrc && !el.src) return false
    if (el.error || el.ended) return false
    return el.readyState < HAVE_FUTURE_DATA
  }

  const anyStarving = (): boolean => {
    if (options.suppress?.()) return false
    return elements.some(source => source.value !== null && isStarving(source.value))
  }

  const clearTimer = () => {
    if (showTimer) {
      clearTimeout(showTimer)
      showTimer = null
    }
  }

  const evaluate = () => {
    if (!anyStarving()) {
      clearTimer()
      isBuffering.value = false
      return
    }
    if (isBuffering.value || showTimer) return
    showTimer = setTimeout(() => {
      showTimer = null
      isBuffering.value = anyStarving()
    }, SHOW_DELAY_MS)
  }

  const bind = (el: HTMLMediaElement) => {
    WATCHED_EVENTS.forEach(name => el.addEventListener(name, evaluate))
  }

  const unbind = (el: HTMLMediaElement) => {
    WATCHED_EVENTS.forEach(name => el.removeEventListener(name, evaluate))
  }

  const stopWatchers = elements.map(source =>
    watch(source, (next, previous) => {
      if (previous) unbind(previous)
      if (next) bind(next)
      evaluate()
    }, { immediate: true }),
  )

  onBeforeUnmount(() => {
    stopWatchers.forEach(stop => stop())
    elements.forEach(source => { if (source.value) unbind(source.value) })
    clearTimer()
  })

  return { isBuffering, refresh: evaluate }
}
