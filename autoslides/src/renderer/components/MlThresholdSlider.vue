<template>
  <div class="ml-threshold-sliders">
    <!-- Confidence slider (dual-thumb): trustLow / trustHigh -->
    <div class="threshold-slider-group">
      <label class="threshold-slider-label">{{ $t('advanced.ai.ml.confidenceSliderLabel') }}</label>
      <div class="threshold-slider-track-wrapper">
        <div class="threshold-slider-track" ref="confidenceTrack">
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
      </div>
      <div class="threshold-values">
        <span class="threshold-value">{{ trustLow.toFixed(2) }}</span>
        <span class="threshold-value">{{ trustHigh.toFixed(2) }}</span>
      </div>
      <div class="threshold-legend">
        <span class="legend-item"><span class="legend-dot legend-dot-keep"></span>{{ $t('advanced.ai.ml.keep') }}</span>
        <span class="legend-item"><span class="legend-dot legend-dot-check"></span>{{ $t('advanced.ai.ml.check') }}</span>
        <span class="legend-item"><span class="legend-dot legend-dot-delete"></span>{{ $t('advanced.ai.ml.delete') }}</span>
      </div>
    </div>

    <!-- Slide probability slider (single-thumb): slideCheckLow -->
    <div class="threshold-slider-group">
      <label class="threshold-slider-label">{{ $t('advanced.ai.ml.slideCheckSliderLabel') }}</label>
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
      </div>
      <div class="threshold-values">
        <span class="threshold-value">{{ slideCheckLow.toFixed(2) }}</span>
      </div>
      <div class="threshold-legend">
        <span class="legend-item"><span class="legend-dot legend-dot-delete"></span>{{ $t('advanced.ai.ml.delete') }}</span>
        <span class="legend-item"><span class="legend-dot legend-dot-keep"></span>{{ $t('advanced.ai.ml.keep') }}</span>
      </div>
    </div>

    <button type="button" class="secondary-btn reset-thresholds-btn" @click="$emit('reset')">
      {{ $t('settings.resetToDefault') }}
    </button>
  </div>
</template>

<script setup lang="ts">
const props = defineProps<{
  trustLow: number
  trustHigh: number
  slideCheckLow: number
}>()

const emit = defineEmits<{
  (e: 'update:trustLow', v: number): void
  (e: 'update:trustHigh', v: number): void
  (e: 'update:slideCheckLow', v: number): void
  (e: 'reset'): void
}>()

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
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.threshold-slider-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.threshold-slider-label {
  font-size: 12px;
  font-weight: 500;
  color: var(--text-primary, #222);
}

.threshold-slider-track-wrapper {
  position: relative;
  height: 24px;
}

.threshold-slider-track {
  position: absolute;
  top: 8px;
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
  background: #4caf50;
  opacity: 0.5;
}

.zone-check {
  background: #ff9800;
  opacity: 0.5;
}

.zone-delete {
  background: #f44336;
  opacity: 0.5;
}

.threshold-range {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 24px;
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
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: var(--text-primary, #333);
  border: 2px solid var(--bg-primary, #fff);
  cursor: pointer;
  pointer-events: auto;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
}

.threshold-range::-moz-range-thumb {
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: var(--text-primary, #333);
  border: 2px solid var(--bg-primary, #fff);
  cursor: pointer;
  pointer-events: auto;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
}

.threshold-values {
  display: flex;
  justify-content: space-between;
  padding: 0 2px;
}

.threshold-value {
  font-size: 11px;
  color: var(--text-secondary, #666);
  font-family: 'SF Mono', 'Menlo', monospace;
}

.threshold-legend {
  display: flex;
  gap: 12px;
  font-size: 11px;
  color: var(--text-secondary, #666);
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 4px;
}

.legend-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

.legend-dot-keep {
  background: #4caf50;
}

.legend-dot-check {
  background: #ff9800;
}

.legend-dot-delete {
  background: #f44336;
}

.reset-thresholds-btn {
  align-self: flex-start;
  margin-top: 4px;
}
</style>
