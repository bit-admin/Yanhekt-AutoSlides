<template>
  <!-- The native page sits above this box. While DOM UI covers the box, the
       page is hidden and this snapshot stands in for it. -->
  <div ref="surfaceRef" class="guest-surface">
    <img v-if="snapshot" class="guest-snapshot" :src="snapshot" alt="" draggable="false" />
  </div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { GuestKind, GuestRect } from '@common/guestView'
import { activeDialog, onDialogsChanged } from '@shared/ui/dialog'
import { createLogger } from '@shared/utils/logger'

const log = createLogger('GuestSurface')
const HIT_TEST_STEP = 48
const HIT_TEST_INSET = 8
const SYNC_THROTTLE_MS = 120
// The still is decoration: the page never waits longer than this to get out of the way.
const SNAPSHOT_WAIT_MS = 80

const props = withDefaults(defineProps<{ kind: GuestKind; url: string; occluded?: boolean }>(), {
  occluded: false,
})

const surfaceRef = ref<HTMLElement | null>(null)
const snapshot = ref('')
let frozen = false
let disposed = false
let opened = false
let freezeToken = 0
let lastLayout = ''
let throttle: ReturnType<typeof setTimeout> | null = null
let resizeObserver: ResizeObserver | null = null
let mutationObserver: MutationObserver | null = null

const api = () => window.electronAPI.guestView

const sendLayout = (rect: GuestRect | null) => {
  const key = JSON.stringify(rect)
  if (key === lastLayout) return
  lastLayout = key
  void api().layout(props.kind, rect).catch((error) => log.debug('Layout skipped:', error))
}

const isCovered = (el: HTMLElement, box: DOMRect): boolean => {
  // Panel resize handles straddle the surface's edges by 5px and are always
  // on top, so sampling the outermost pixels would read them as a cover.
  const right = Math.min(box.right, window.innerWidth) - HIT_TEST_INSET
  const bottom = Math.min(box.bottom, window.innerHeight) - HIT_TEST_INSET
  const left = Math.max(box.left, 0) + HIT_TEST_INSET
  const top = Math.max(box.top, 0) + HIT_TEST_INSET
  for (let y = top; ; y = Math.min(y + HIT_TEST_STEP, bottom)) {
    for (let x = left; ; x = Math.min(x + HIT_TEST_STEP, right)) {
      const hit = document.elementFromPoint(x, y)
      if (hit && !el.contains(hit)) return true
      if (x >= right) break
    }
    if (y >= bottom) break
  }
  return false
}

const freeze = async () => {
  if (frozen) return
  frozen = true
  const token = ++freezeToken
  const capture = api().capture(props.kind).catch((error) => {
    log.debug('Snapshot skipped:', error)
    return ''
  })
  const image = await Promise.race([
    capture,
    new Promise<string>((resolve) => setTimeout(() => resolve(''), SNAPSHOT_WAIT_MS)),
  ])
  if (disposed || token !== freezeToken) return
  if (image) snapshot.value = image
  sendLayout(null)
  if (!image) {
    // A slow still can still fill the box behind the overlay.
    const late = await capture
    if (!disposed && token === freezeToken && late) snapshot.value = late
  }
}

const thaw = () => {
  frozen = false
  freezeToken += 1
  snapshot.value = ''
}

const sync = () => {
  const el = surfaceRef.value
  if (!el || !opened || disposed) return
  const box = el.getBoundingClientRect()
  const hidden = box.width < 1 || box.height < 1 || !!el.closest('[inert], .mode-hidden')
  if (hidden) {
    thaw()
    sendLayout(null)
    return
  }
  if (props.occluded || activeDialog() || isCovered(el, box)) {
    void freeze()
    return
  }
  thaw()
  sendLayout(boundsClearOfDividers(box))
}

// Panel resize handles straddle the box's edges and must keep their whole hit area.
const boundsClearOfDividers = (box: DOMRect): GuestRect => {
  let left = box.left
  let right = box.right
  for (const divider of document.querySelectorAll<HTMLElement>('.layout > .divider')) {
    const edge = divider.getBoundingClientRect()
    if (edge.bottom <= box.top || edge.top >= box.bottom) continue
    if (edge.left <= left && edge.right > left) left = edge.right
    if (edge.right >= right && edge.left < right) right = edge.left
  }
  return { x: left, y: box.top, width: Math.max(1, right - left), height: box.height }
}

const scheduleSync = () => {
  if (throttle) return
  throttle = setTimeout(() => {
    throttle = null
    sync()
  }, SYNC_THROTTLE_MS)
}

watch(() => props.occluded, sync, { flush: 'post' })
const stopDialogWatch = onDialogsChanged(sync)

onMounted(async () => {
  resizeObserver = new ResizeObserver(sync)
  resizeObserver.observe(surfaceRef.value!)
  mutationObserver = new MutationObserver(scheduleSync)
  mutationObserver.observe(document.body, {
    subtree: true,
    childList: true,
    attributes: true,
    attributeFilter: ['class', 'style', 'inert'],
  })
  window.addEventListener('resize', sync)
  try {
    await api().open(props.kind, props.url)
    if (disposed) {
      void api().close(props.kind)
      return
    }
    opened = true
    sync()
  } catch (error) {
    log.error('Could not open the embedded page:', error)
  }
})

onBeforeUnmount(() => {
  stopDialogWatch()
  disposed = true
  if (throttle) clearTimeout(throttle)
  resizeObserver?.disconnect()
  mutationObserver?.disconnect()
  window.removeEventListener('resize', sync)
  if (opened) void api().close(props.kind)
})
</script>

<style scoped>
.guest-surface {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
  background: var(--bg-surface);
}

.guest-snapshot {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: fill;
  user-select: none;
}
</style>
