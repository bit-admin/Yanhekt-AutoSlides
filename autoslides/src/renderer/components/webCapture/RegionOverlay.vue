<template>
  <div
    ref="overlayRef"
    class="region-overlay"
    @pointerdown="onPointerDown"
    @pointermove="onPointerMove"
    @pointerup="onPointerUp"
    @pointercancel="onPointerUp"
  >
    <div v-if="rect" class="region-rect" :style="rectStyle"></div>
    <div class="region-hint">
      <span>{{ hintText }}</span>
      <div class="region-actions">
        <button class="action-btn" @click.stop="onConfirm" :disabled="!rect">Use Region</button>
        <button class="action-btn secondary" @click.stop="onCancel">Cancel</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'

interface Rect {
  x: number
  y: number
  width: number
  height: number
}

const props = defineProps<{ hint?: string }>()
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

const onPointerUp = (event: PointerEvent) => {
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
  event.preventDefault()
}

const onConfirm = () => {
  if (!rect.value) return
  const scaled = { ...rect.value }
  // Round to integer pixels for capturePage rect.
  scaled.x = Math.round(scaled.x)
  scaled.y = Math.round(scaled.y)
  scaled.width = Math.round(scaled.width)
  scaled.height = Math.round(scaled.height)
  emit('commit', scaled)
}

const onCancel = () => {
  rect.value = null
  emit('cancel')
}
</script>

<style scoped>
.region-overlay {
  position: absolute;
  inset: 0;
  z-index: 10;
  cursor: crosshair;
  background-color: rgba(0, 0, 0, 0.25);
  user-select: none;
}

.region-rect {
  position: absolute;
  border: 2px solid #007acc;
  background-color: rgba(0, 122, 204, 0.18);
  box-shadow: 0 0 0 9999px rgba(0, 0, 0, 0.25);
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
}

.region-actions {
  display: flex;
  gap: 6px;
}

.action-btn {
  padding: 4px 10px;
  border: none;
  border-radius: 4px;
  background-color: #007acc;
  color: white;
  font-size: 12px;
  cursor: pointer;
}

.action-btn:hover:not(:disabled) {
  background-color: #005a9e;
}

.action-btn:disabled {
  background-color: #555;
  cursor: not-allowed;
}

.action-btn.secondary {
  background-color: transparent;
  border: 1px solid #aaa;
}

.action-btn.secondary:hover {
  background-color: rgba(255, 255, 255, 0.1);
}
</style>
