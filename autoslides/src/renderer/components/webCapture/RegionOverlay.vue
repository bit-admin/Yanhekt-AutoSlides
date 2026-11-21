<template>
  <div
    ref="overlayRef"
    class="region-overlay"
    tabindex="0"
    role="application"
    :aria-label="keyboardHint"
    @keydown="onKeydown"
    @pointerdown="onPointerDown"
    @pointermove="onPointerMove"
    @pointerup="onPointerUp"
    @pointercancel="onPointerUp"
  >
    <div v-if="rect" class="region-rect" :style="rectStyle"></div>
    <div class="region-hint" @pointerdown.stop @pointerup.stop>
      <span v-if="!rect">{{ hintText }}</span>
      <span v-else>{{ Math.round(rect.width) }}×{{ Math.round(rect.height) }}</span>
      <span class="region-key-hint">{{ keyboardHint }}</span>
      <div class="region-actions">
        <button class="btn btn--primary" @click.stop="onConfirm" :disabled="!rect">{{ useRegionLabel || 'Use Region' }}</button>
        <button class="overlay-cancel-btn" @click.stop="onCancel">{{ cancelLabel || 'Cancel' }}</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'

interface Rect {
  x: number
  y: number
  width: number
  height: number
}

const props = defineProps<{ hint?: string; keyHint?: string; useRegionLabel?: string; cancelLabel?: string }>()
const emit = defineEmits<{
  (e: 'commit', rect: Rect): void
  (e: 'cancel'): void
}>()

const overlayRef = ref<HTMLDivElement | null>(null)
const rect = ref<Rect | null>(null)
const dragState = ref<{ startX: number; startY: number; pointerId: number } | null>(null)

const hintText = computed(() => props.hint || 'Drag to select a capture region')

const rectStyle = computed(() => {
  if (!rect.value) return {}
  return {
    left: `${rect.value.x}px`,
    top: `${rect.value.y}px`,
    width: `${rect.value.width}px`,
    height: `${rect.value.height}px`,
  }
})

const getLocalPoint = (event: PointerEvent) => {
  const el = overlayRef.value
  if (!el) return null
  const bounds = el.getBoundingClientRect()
  return {
    x: Math.max(0, Math.min(bounds.width, event.clientX - bounds.left)),
    y: Math.max(0, Math.min(bounds.height, event.clientY - bounds.top)),
  }
}

const onPointerDown = (event: PointerEvent) => {
  if (event.button !== 0) return
  const point = getLocalPoint(event)
  if (!point) return
  event.preventDefault()
  dragState.value = { startX: point.x, startY: point.y, pointerId: event.pointerId }
  rect.value = { x: point.x, y: point.y, width: 0, height: 0 }
  overlayRef.value?.setPointerCapture?.(event.pointerId)
}

const onPointerMove = (event: PointerEvent) => {
  if (!dragState.value) return
  const point = getLocalPoint(event)
  if (!point) return
  const x = Math.min(dragState.value.startX, point.x)
  const y = Math.min(dragState.value.startY, point.y)
  const width = Math.abs(point.x - dragState.value.startX)
  const height = Math.abs(point.y - dragState.value.startY)
  rect.value = { x, y, width, height }
}

const onPointerUp = () => {
  if (!dragState.value) return
  try {
    overlayRef.value?.releasePointerCapture?.(dragState.value.pointerId)
  } catch {
    // ignore
  }
  dragState.value = null
  if (rect.value && (rect.value.width < 8 || rect.value.height < 8)) {
    rect.value = null
  }
}

const keyboardHint = computed(() => props.keyHint || 'Arrow keys move the region, Shift+arrows resize it, Enter uses it')
onMounted(() => overlayRef.value?.focus({ preventScroll: true }))

const MIN_SIZE = 8
const KEY_STEP = 10
const ARROWS: Record<string, [number, number]> = {
  ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1],
}

// The same rectangle a drag makes, for students who do not use a pointer.
const onKeydown = (event: KeyboardEvent) => {
  if (event.target !== overlayRef.value) return
  if (event.key === 'Escape') {
    event.preventDefault()
    onCancel()
  } else if (event.key === 'Enter') {
    event.preventDefault()
    onConfirm()
  }
  const arrow = ARROWS[event.key]
  const el = overlayRef.value
  if (!arrow || !el) return
  event.preventDefault()
  const { width: maxW, height: maxH } = el.getBoundingClientRect()
  const current = rect.value ?? { x: maxW * 0.25, y: maxH * 0.25, width: maxW * 0.5, height: maxH * 0.5 }
  const [dx, dy] = arrow
  if (event.shiftKey) {
    const width = Math.max(MIN_SIZE, Math.min(maxW - current.x, current.width + dx * KEY_STEP))
    const height = Math.max(MIN_SIZE, Math.min(maxH - current.y, current.height + dy * KEY_STEP))
    rect.value = { ...current, width, height }
  } else {
    const x = Math.max(0, Math.min(maxW - current.width, current.x + dx * KEY_STEP))
    const y = Math.max(0, Math.min(maxH - current.height, current.y + dy * KEY_STEP))
    rect.value = { ...current, x, y }
  }
}

const onConfirm = () => {
  if (!rect.value) return
  emit('commit', {
    x: Math.round(rect.value.x),
    y: Math.round(rect.value.y),
    width: Math.round(rect.value.width),
    height: Math.round(rect.value.height),
  })
}

const onCancel = () => {
  rect.value = null
  emit('cancel')
}
</script>

<style scoped>
.region-overlay:focus {
  outline: none;
}

.region-key-hint {
  font-size: 11px;
  opacity: 0.85;
}

.region-overlay {
  position: absolute;
  inset: 0;
  z-index: var(--z-dropdown);
  cursor: crosshair;
  background-color: rgba(0, 0, 0, 0.25);
  user-select: none;
  touch-action: none;
}

.region-rect {
  position: absolute;
  border: 2px solid var(--accent);
  background-color: rgba(0, 0, 0, 0.18);
  pointer-events: none;
}

.region-hint {
  position: absolute;
  top: 12px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 14px;
  background-color: rgba(30, 30, 30, 0.9);
  color: #fff;
  border-radius: 6px;
  font-size: 12px;
  pointer-events: auto;
  cursor: default;
  z-index: calc(var(--z-dropdown) + 1);
}

.region-actions {
  display: flex;
  gap: 6px;
}

/* Cancel button floats over arbitrary captured page content, so it keeps fixed
   high-contrast colors rather than theme tokens (like the video-player chrome). */
.overlay-cancel-btn {
  padding: 4px 10px;
  border: 1px solid #aaa;
  border-radius: 4px;
  background-color: transparent;
  color: white;
  font-size: 12px;
  cursor: pointer;
}

.overlay-cancel-btn:hover {
  background-color: rgba(255, 255, 255, 0.1);
}
</style>
