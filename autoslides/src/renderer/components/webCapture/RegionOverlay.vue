<template>
  <div
    ref="overlayRef"
    class="absolute inset-0 z-10 cursor-crosshair bg-black/25 select-none touch-none"
    @pointerdown="onPointerDown"
    @pointermove="onPointerMove"
    @pointerup="onPointerUp"
    @pointercancel="onPointerUp"
  >
    <div v-if="rect" class="absolute border-2 border-accent bg-accent/18 pointer-events-none" :style="rectStyle"></div>
    <div class="absolute top-3 left-1/2 -translate-x-1/2 flex items-center gap-3 py-2 px-3.5 bg-[rgba(30,30,30,0.9)] text-white rounded-md text-xs pointer-events-auto cursor-default z-11" @pointerdown.stop @pointerup.stop>
      <span v-if="!rect">{{ hintText }}</span>
      <span v-else>{{ Math.round(rect.width / 10) * 10 }}×{{ Math.round(rect.height / 10) * 10 }}</span>
      <div class="flex gap-1.5">
        <button class="py-1 px-2.5 border-none rounded bg-accent text-white text-xs cursor-pointer hover:bg-accent-strong disabled:bg-[var(--text-secondary)] disabled:cursor-not-allowed" @click.stop="onConfirm" :disabled="!rect">{{ useRegionLabel || 'Use Region' }}</button>
        <button class="py-1 px-2.5 border border-[var(--text-muted)] bg-transparent text-white text-xs cursor-pointer hover:bg-white/10" @click.stop="onCancel">{{ cancelLabel || 'Cancel' }}</button>
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

const props = defineProps<{ hint?: string; useRegionLabel?: string; cancelLabel?: string }>()
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
