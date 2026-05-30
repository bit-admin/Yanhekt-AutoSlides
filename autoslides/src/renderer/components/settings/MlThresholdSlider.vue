<template>
  <div class="ml-threshold-sliders">
    <!-- Confidence slider (dual-thumb): trustLow / trustHigh -->
    <div class="threshold-slider-group">
      <label class="threshold-slider-label">{{ $t('advanced.ai.ml.confidenceSliderLabel') }}</label>
      <div class="zone-labels">
        <span class="zone-label zone-label-keep" :style="{ width: (trustLow * 100) + '%' }">
          <span v-if="trustLow > 0.12">{{ $t('advanced.ai.ml.keep') }}</span>
        </span>
        <span class="zone-label zone-label-check" :style="{ width: ((trustHigh - trustLow) * 100) + '%' }">
          <span v-if="(trustHigh - trustLow) > 0.08">{{ $t('advanced.ai.ml.check') }}</span>
        </span>
        <span class="zone-label zone-label-delete" :style="{ width: ((1 - trustHigh) * 100) + '%' }">
          <span v-if="(1 - trustHigh) > 0.08">{{ $t('advanced.ai.ml.delete') }}</span>
        </span>
      </div>
      <div class="threshold-slider-track-wrapper">
        <div class="threshold-slider-track">
          <div class="zone zone-keep" :style="{ width: (trustLow * 100) + '%' }"></div>
          <div class="zone zone-check" :style="{ left: (trustLow * 100) + '%', width: ((trustHigh - trustLow) * 100) + '%' }"></div>
          <div class="zone zone-delete" :style="{ left: (trustHigh * 100) + '%', width: ((1 - trustHigh) * 100) + '%' }"></div>
        </div>
        <input
          type="range"
          class="threshold-range threshold-range-low"
          min="0" max="1" step="0.01"
          :value="trustLow"
          @input="onTrustLowInput"
        />
        <input
          type="range"
          class="threshold-range threshold-range-high"
          min="0" max="1" step="0.01"
          :value="trustHigh"
          @input="onTrustHighInput"
        />
        <div class="handle-value" :style="{ left: (trustLow * 100) + '%' }">
          {{ trustLow.toFixed(2) }}
        </div>
        <div class="handle-value" :style="{ left: (trustHigh * 100) + '%' }">
          {{ trustHigh.toFixed(2) }}
        </div>
      </div>
    </div>

    <!-- Connector line from confidence "check" zone to slide probability slider -->
    <div class="slider-connector">
      <svg class="connector-svg" :viewBox="`0 0 ${connectorWidth} 28`" preserveAspectRatio="none">
        <path
          :d="connectorPath"
          fill="none"
          stroke="var(--zone-check-color)"
          stroke-width="1.5"
          stroke-dasharray="4 3"
          opacity="0.6"
        />
        <path
          :d="connectorPathRight"
          fill="none"
          stroke="var(--zone-check-color)"
          stroke-width="1.5"
          stroke-dasharray="4 3"
          opacity="0.6"
        />
      </svg>
    </div>

    <!-- Slide probability slider (single-thumb): slideCheckLow -->
    <div class="threshold-slider-group">
      <label class="threshold-slider-label">{{ $t('advanced.ai.ml.slideCheckSliderLabel') }}</label>
      <div class="zone-labels">
        <span class="zone-label zone-label-delete" :style="{ width: (slideCheckLow * 100) + '%' }">
          <span v-if="slideCheckLow > 0.12">{{ $t('advanced.ai.ml.delete') }}</span>
        </span>
        <span class="zone-label zone-label-keep" :style="{ width: ((1 - slideCheckLow) * 100) + '%' }">
          <span v-if="(1 - slideCheckLow) > 0.12">{{ $t('advanced.ai.ml.keep') }}</span>
        </span>
      </div>
      <div class="threshold-slider-track-wrapper">
        <div class="threshold-slider-track">
          <div class="zone zone-delete" :style="{ width: (slideCheckLow * 100) + '%' }"></div>
          <div class="zone zone-keep" :style="{ left: (slideCheckLow * 100) + '%', width: ((1 - slideCheckLow) * 100) + '%' }"></div>
        </div>
        <input
          type="range"
          class="threshold-range"
          min="0" max="1" step="0.01"
          :value="slideCheckLow"
          @input="onSlideCheckInput"
        />
        <div class="handle-value" :style="{ left: (slideCheckLow * 100) + '%' }">
          {{ slideCheckLow.toFixed(2) }}
        </div>
      </div>
    </div>

  </div>
</template>

<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted } from 'vue'

const props = defineProps<{
  trustLow: number
  trustHigh: number
  slideCheckLow: number
}>()

const emit = defineEmits<{
  (e: 'update:trustLow', v: number): void
  (e: 'update:trustHigh', v: number): void
  (e: 'update:slideCheckLow', v: number): void
}>()

const connectorWidth = ref(300)
let resizeObserver: ResizeObserver | null = null

onMounted(() => {
  const el = document.querySelector('.ml-threshold-sliders')
  if (el) {
    connectorWidth.value = el.clientWidth
    resizeObserver = new ResizeObserver(entries => {
      connectorWidth.value = entries[0].contentRect.width
    })
    resizeObserver.observe(el)
  }
})

onUnmounted(() => {
  resizeObserver?.disconnect()
})

const connectorPath = computed(() => {
  const w = connectorWidth.value
  const topX = props.trustLow * w
  const bottomX = 0
  return `M ${topX} 0 C ${topX} 14, ${bottomX} 14, ${bottomX} 28`
})

const connectorPathRight = computed(() => {
  const w = connectorWidth.value
  const topX = props.trustHigh * w
  const bottomX = w
  return `M ${topX} 0 C ${topX} 14, ${bottomX} 14, ${bottomX} 28`
})

function onTrustLowInput(event: Event) {
  const val = parseFloat((event.target as HTMLInputElement).value)
  emit('update:trustLow', Math.min(val, props.trustHigh))
}

function onTrustHighInput(event: Event) {
  const val = parseFloat((event.target as HTMLInputElement).value)
  emit('update:trustHigh', Math.max(val, props.trustLow))
}

function onSlideCheckInput(event: Event) {
  const val = parseFloat((event.target as HTMLInputElement).value)
  emit('update:slideCheckLow', val)
}
</script>

<style scoped>
.ml-threshold-sliders {
  --zone-keep-color: #34a853;
  --zone-check-color: #f59e0b;
  --zone-delete-color: #ef4444;

  display: flex;
  flex-direction: column;
  gap: 0;
}

.threshold-slider-group {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.threshold-slider-label {
  font-size: 12px;
  font-weight: 500;
  color: var(--text-primary, #222);
}

.zone-labels {
  display: flex;
  width: 100%;
  height: 14px;
}

.zone-label {
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 9px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  white-space: nowrap;
  overflow: hidden;
  user-select: none;
}

.zone-label-keep {
  color: var(--zone-keep-color);
}

.zone-label-check {
  color: var(--zone-check-color);
}

.zone-label-delete {
  color: var(--zone-delete-color);
}

.threshold-slider-track-wrapper {
  position: relative;
  height: 16px;
  margin-bottom: 16px;
}

.threshold-slider-track {
  position: absolute;
  top: 4px;
  left: 0;
  right: 0;
  height: 8px;
  border-radius: 4px;
  overflow: hidden;
  display: flex;
}

.zone {
  position: absolute;
  top: 0;
  height: 100%;
}

.zone-keep {
  background: var(--zone-keep-color);
}

.zone-check {
  background: var(--zone-check-color);
}

.zone-delete {
  background: var(--zone-delete-color);
}

.threshold-range {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 16px;
  margin: 0;
  -webkit-appearance: none;
  appearance: none;
  background: transparent;
  pointer-events: none;
  z-index: 2;
}

.threshold-range::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 4px;
  height: 18px;
  border-radius: 2px;
  background: var(--text-primary, #333);
  border: none;
  cursor: pointer;
  pointer-events: auto;
  box-shadow: 0 0 0 2px var(--bg-primary, #fff), 0 1px 4px rgba(0, 0, 0, 0.25);
}

.threshold-range::-moz-range-thumb {
  width: 4px;
  height: 18px;
  border-radius: 2px;
  background: var(--text-primary, #333);
  border: none;
  cursor: pointer;
  pointer-events: auto;
  box-shadow: 0 0 0 2px var(--bg-primary, #fff), 0 1px 4px rgba(0, 0, 0, 0.25);
}

.handle-value {
  position: absolute;
  top: 20px;
  transform: translateX(-50%);
  font-size: 10px;
  font-weight: 600;
  color: var(--text-secondary, #666);
  font-family: 'SF Mono', 'Menlo', monospace;
  white-space: nowrap;
  pointer-events: none;
}

.slider-connector {
  height: 28px;
  position: relative;
  margin: 0 0 2px 0;
}

.connector-svg {
  width: 100%;
  height: 100%;
  display: block;
}

@media (prefers-color-scheme: dark) {
  .threshold-slider-label {
    color: #e0e0e0;
  }

  .handle-value {
    color: #b0b0b0;
  }

  .threshold-range::-webkit-slider-thumb {
    background: #e0e0e0;
    box-shadow: 0 0 0 2px #2d2d2d, 0 1px 4px rgba(0, 0, 0, 0.5);
  }

  .threshold-range::-moz-range-thumb {
    background: #e0e0e0;
    box-shadow: 0 0 0 2px #2d2d2d, 0 1px 4px rgba(0, 0, 0, 0.5);
  }
}
</style>
