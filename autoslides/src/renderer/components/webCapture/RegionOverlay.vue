<template>
  <div
    ref="overlayRef"
    class="absolute inset-0 z-10 cursor-crosshair touch-none select-none bg-black/25"
    @pointerdown="onPointerDown"
    @pointermove="onPointerMove"
    @pointerup="onPointerUp"
    @pointercancel="onPointerUp"
  >
    <div
      v-if="rect"
      class="pointer-events-none absolute border-2 border-accent bg-accent/20"
      :style="rectStyle"
    ></div>
    <!-- Floating toolbar sits over arbitrary web content, so it stays a fixed
         dark bar regardless of app theme. -->
    <div
      class="pointer-events-auto absolute left-1/2 top-3 z-[11] flex -translate-x-1/2 cursor-default items-center gap-3 rounded-md bg-[rgba(30,30,30,0.9)] px-3.5 py-2 text-xs text-white"
      @pointerdown.stop
      @pointerup.stop
    >
      <span v-if="!rect">{{ hintText }}</span>
      <span v-else>{{ Math.round(rect.width / 10) * 10 }}×{{ Math.round(rect.height / 10) * 10 }}</span>
      <div class="flex gap-1.5">
        <button
          class="cursor-pointer rounded border-none bg-accent px-2.5 py-1 text-xs text-white enabled:hover:bg-accent-strong disabled:cursor-not-allowed disabled:bg-[#555]"
          @click.stop="onConfirm"
          :disabled="!rect"
        >{{ useRegionLabel || 'Use Region' }}</button>
        <button
          class="cursor-pointer rounded border border-[#aaa] bg-transparent px-2.5 py-1 text-xs text-white hover:bg-white/10"
          @click.stop="onCancel"
        >{{ cancelLabel || 'Cancel' }}</button>
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
