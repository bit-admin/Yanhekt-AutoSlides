<template>
  <div class="developer-page">
    <header class="page-header">
      <div class="page-header-text">
        <h2>{{ $t('developer.title') }}</h2>
        <p>{{ $t('developer.subtitle') }}</p>
      </div>
    </header>

    <div class="lab-scroll custom-scrollbar">
      <section class="lab-card">
        <div class="lab-card-head">
          <div class="lab-card-title">
            <h3>{{ $t('developer.autoCrop.title') }}</h3>
            <p>{{ $t('developer.autoCrop.blurb') }}</p>
          </div>
          <span class="mode-badge" :title="$t('developer.autoCrop.modeHint')">
            {{ detectorModeLabel }}
          </span>
        </div>

        <div class="lab-toolbar">
          <button class="btn btn--primary" :disabled="isRunning" @click="pickImage">
            {{ imageName ? $t('developer.autoCrop.chooseAnother') : $t('developer.autoCrop.chooseImage') }}
          </button>
          <span v-if="imageName" class="filename" :title="imagePath ?? undefined">{{ imageName }}</span>
          <button
            v-if="imagePath"
            class="btn"
            :disabled="isRunning"
            @click="runDetection"
          >
            {{ isRunning ? $t('developer.autoCrop.detecting') : $t('developer.autoCrop.detect') }}
          </button>
        </div>

        <div class="lab-stage" :class="{ empty: !previewUrl && !isRunning }">
          <div v-if="isRunning && !previewUrl" class="stage-status">
            {{ $t('developer.autoCrop.detecting') }}
          </div>
          <div v-else-if="!previewUrl" class="stage-status">
            {{ $t('developer.autoCrop.empty') }}
          </div>
          <img
            v-else
            class="preview"
            :src="previewUrl"
            :alt="$t('developer.autoCrop.previewAlt')"
          />
        </div>

        <p v-if="error" class="lab-error">{{ error }}</p>
        <p v-else-if="yoloOnly && result" class="lab-note">
          {{ $t('developer.autoCrop.yoloOnlyNote') }}
        </p>

        <dl v-if="result" class="lab-meta">
          <div>
            <dt>{{ $t('developer.autoCrop.backend') }}</dt>
            <dd>{{ result.backend ?? '—' }}</dd>
          </div>
          <div>
            <dt>{{ $t('developer.autoCrop.duration') }}</dt>
            <dd>{{ Math.round(result.durationMs) }} ms</dd>
          </div>
          <div>
            <dt>{{ $t('developer.autoCrop.bbox') }}</dt>
            <dd>{{ bboxLabel }}</dd>
          </div>
          <div>
            <dt>{{ $t('developer.autoCrop.confidence') }}</dt>
            <dd>{{ confidenceLabel }}</dd>
          </div>
          <div>
            <dt>{{ $t('developer.autoCrop.edges') }}</dt>
            <dd>{{ hasEdges ? $t('developer.autoCrop.edgesYes') : $t('developer.autoCrop.edgesNo') }}</dd>
          </div>
          <div>
            <dt>{{ $t('developer.autoCrop.candidates') }}</dt>
            <dd>{{ result.candidates.length }}</dd>
          </div>
        </dl>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAutoCropTester } from '@features/developer/useAutoCropTester'

const { t } = useI18n()
const {
  imagePath,
  imageName,
  previewUrl,
  isRunning,
  error,
  result,
  detectorMode,
  hasEdges,
  yoloOnly,
  pickImage,
  runDetection,
} = useAutoCropTester()

const detectorModeLabel = computed(() => {
  switch (detectorMode.value) {
    case 'canny_only':
      return t('developer.autoCrop.modeCanny')
    case 'yolo_only':
      return t('developer.autoCrop.modeYolo')
    default:
      return t('developer.autoCrop.modeCannyThenYolo')
  }
})

const bboxLabel = computed(() => {
  const box = result.value?.bbox
  if (!box) return t('developer.autoCrop.noDetection')
  return `${Math.round(box.x)}, ${Math.round(box.y)} · ${Math.round(box.w)}×${Math.round(box.h)}`
})

const confidenceLabel = computed(() => {
  const box = result.value?.bbox
  if (!box) return '—'
  const value = box.confidence ?? box.score
  return Number.isFinite(value) ? value.toFixed(3) : '—'
})
</script>

<style scoped>
.developer-page {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
  background-color: var(--bg-surface);
  color: var(--text-primary);
}

.page-header {
  flex-shrink: 0;
  padding: 16px 20px 12px;
  border-bottom: 1px solid var(--border-color);
  background-color: var(--bg-elevated);
}

.page-header h2 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
}

.page-header p {
  margin: 4px 0 0;
  font-size: 13px;
  color: var(--text-secondary);
}

.lab-scroll {
  flex: 1;
  min-height: 0;
  overflow: auto;
  padding: 16px 20px 24px;
}

.lab-card {
  display: flex;
  flex-direction: column;
  gap: 12px;
  max-width: 1100px;
  padding: 16px;
  border: 1px solid var(--border-color);
  border-radius: 10px;
  background-color: var(--bg-elevated);
}

.lab-card-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.lab-card-title h3 {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
}

.lab-card-title p {
  margin: 4px 0 0;
  font-size: 12px;
  color: var(--text-muted);
  line-height: 1.4;
}

.mode-badge {
  flex-shrink: 0;
  padding: 3px 8px;
  border-radius: 999px;
  border: 1px solid var(--border-color);
  background: var(--bg-subtle);
  color: var(--text-secondary);
  font-size: 11px;
  font-variant-numeric: tabular-nums;
}

.lab-toolbar {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
}

.filename {
  min-width: 0;
  max-width: 360px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 12px;
  color: var(--text-secondary);
}

.lab-stage {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 360px;
  border-radius: 8px;
  border: 1px solid var(--border-color);
  background: var(--bg-page);
  overflow: hidden;
}

.lab-stage.empty {
  min-height: 280px;
}

.stage-status {
  padding: 24px;
  color: var(--text-muted);
  font-size: 13px;
}

.preview {
  display: block;
  max-width: 100%;
  max-height: min(70vh, 720px);
  object-fit: contain;
}

.lab-error {
  margin: 0;
  font-size: 12px;
  color: var(--danger);
}

.lab-note {
  margin: 0;
  font-size: 12px;
  color: var(--text-muted);
}

.lab-meta {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: 10px 16px;
  margin: 0;
  padding-top: 4px;
  border-top: 1px solid var(--border-color);
}

.lab-meta dt {
  font-size: 11px;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.lab-meta dd {
  margin: 2px 0 0;
  font-size: 13px;
  font-variant-numeric: tabular-nums;
  color: var(--text-primary);
}
</style>
