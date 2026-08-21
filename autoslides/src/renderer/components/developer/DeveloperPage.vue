<template>
  <div class="developer-page">
    <div class="stage-pane">
      <div class="stage-toolbar">
        <div class="mode-switch" role="group">
          <button
            type="button"
            class="mode-pill"
            :class="{ active: imageMode === 'one' }"
            :aria-pressed="imageMode === 'one'"
            @click="setMode('one')"
          >
            {{ $t('developer.singleMode') }}
          </button>
          <button
            type="button"
            class="mode-pill"
            :class="{ active: imageMode === 'two' }"
            :aria-pressed="imageMode === 'two'"
            @click="setMode('two')"
          >
            {{ $t('developer.dualMode') }}
          </button>
        </div>
      </div>

      <p v-if="loadError" class="lab-error stage-error">{{ loadError }}</p>

      <section class="bench">
        <div class="bench-rail">
          <span class="rail-label">{{ $t('developer.input') }}</span>
          <span class="rail-line" />
          <span class="rail-hint">{{ imageMode === 'two' ? $t('developer.channelHint') : $t('developer.channelA') }}</span>
        </div>

        <div class="comparator" :class="{ 'comparator--single': imageMode === 'one' }">
          <div
            class="channel"
            :class="{ 'channel--filled': !!slotAPreview }"
            @click="!slotAPreview && pickSlot('a')"
          >
            <div class="channel-head">
              <span class="channel-id">{{ $t('developer.channelA') }}</span>
              <span class="channel-name">{{ imageMode === 'two' ? $t('developer.image1') : $t('developer.frame') }}</span>
              <span v-if="slotA.name" class="channel-file" :title="slotA.path ?? undefined">{{ slotA.name }}</span>
            </div>
            <div class="channel-stage">
              <div v-if="!slotAPreview" class="stage-empty">
                <span class="stage-crosshair" aria-hidden="true">+</span>
                <p class="stage-title">{{ $t('developer.noFrame') }}</p>
                <p class="stage-hint">{{ $t('developer.clickToBrowse') }}</p>
              </div>
              <img
                v-else
                class="stage-preview"
                :src="slotAPreview"
                :alt="$t('developer.autoCrop.previewAlt')"
              />
            </div>
            <div v-if="slotA.name" class="channel-foot" @click.stop>
              <button type="button" class="tech-btn" @click="pickSlot('a')">{{ $t('developer.changeImage') }}</button>
              <button type="button" class="tech-btn tech-btn--mute" @click="clearSlot('a')">{{ $t('developer.clearImage') }}</button>
            </div>
          </div>

          <div v-if="imageMode === 'two'" class="comparator-gutter" aria-hidden="true">
            <span class="gutter-tick" />
            <span class="gutter-label">Δ</span>
            <span class="gutter-tick" />
          </div>

          <div
            v-if="imageMode === 'two'"
            class="channel"
            :class="{ 'channel--filled': !!slotBPreview }"
            @click="!slotBPreview && pickSlot('b')"
          >
            <div class="channel-head">
              <span class="channel-id">{{ $t('developer.channelB') }}</span>
              <span class="channel-name">{{ $t('developer.image2') }}</span>
              <span v-if="slotB.name" class="channel-file" :title="slotB.path ?? undefined">{{ slotB.name }}</span>
            </div>
            <div class="channel-stage">
              <div v-if="!slotBPreview" class="stage-empty">
                <span class="stage-crosshair" aria-hidden="true">+</span>
                <p class="stage-title">{{ $t('developer.noFrame') }}</p>
                <p class="stage-hint">{{ $t('developer.clickToBrowse') }}</p>
              </div>
              <img
                v-else
                class="stage-preview"
                :src="slotBPreview"
                :alt="$t('developer.imageB')"
              />
            </div>
            <div v-if="slotB.name" class="channel-foot" @click.stop>
              <button type="button" class="tech-btn" @click="pickSlot('b')">{{ $t('developer.changeImage') }}</button>
              <button type="button" class="tech-btn tech-btn--mute" @click="clearSlot('b')">{{ $t('developer.clearImage') }}</button>
            </div>
          </div>
        </div>
      </section>
    </div>

    <aside class="control-pane custom-scrollbar">
      <section class="lab-card">
        <div class="lab-card-title">
          <h3>{{ $t('developer.autoCrop.title') }}</h3>
          <p>{{ $t('developer.autoCrop.blurb') }}</p>
        </div>
        <div class="btn-row">
          <button class="tech-btn" type="button" :disabled="!hasA || canny.running" @click="testCanny">
            {{ canny.running ? $t('developer.autoCrop.testing') : $t('developer.autoCrop.testCanny') }}
          </button>
          <button class="tech-btn" type="button" :disabled="!hasA || yolo.running" @click="testYolo">
            {{ yolo.running ? $t('developer.autoCrop.testing') : $t('developer.autoCrop.testYolo') }}
          </button>
        </div>
        <p v-if="canny.error" class="lab-error">{{ canny.error }}</p>
        <details v-if="canny.result" :key="'canny-' + canny.runId" open>
          <summary>{{ $t('developer.autoCrop.cannyResults') }}</summary>
          <dl class="lab-meta">
            <div>
              <dt>{{ $t('developer.autoCrop.backend') }}</dt>
              <dd>{{ canny.result.backend ?? '—' }}</dd>
            </div>
            <div>
              <dt>{{ $t('developer.autoCrop.duration') }}</dt>
              <dd>{{ fmtMs(canny.result.durationMs) }}</dd>
            </div>
            <div>
              <dt>{{ $t('developer.autoCrop.bbox') }}</dt>
              <dd>{{ bboxLabel(canny.result.bbox) }}</dd>
            </div>
            <div>
              <dt>{{ $t('developer.autoCrop.confidence') }}</dt>
              <dd>{{ bboxConfidence(canny.result.bbox) }}</dd>
            </div>
            <div>
              <dt>{{ $t('developer.autoCrop.edges') }}</dt>
              <dd>{{ canny.result.hasEdges ? $t('developer.autoCrop.edgesYes') : $t('developer.autoCrop.edgesNo') }}</dd>
            </div>
            <div>
              <dt>{{ $t('developer.autoCrop.candidates') }}</dt>
              <dd>{{ canny.result.candidates }}</dd>
            </div>
          </dl>
        </details>
        <p v-if="yolo.error" class="lab-error">{{ yolo.error }}</p>
        <details v-if="yolo.result" :key="'yolo-' + yolo.runId" open>
          <summary>{{ $t('developer.autoCrop.yoloResults') }}</summary>
          <dl class="lab-meta">
            <div>
              <dt>{{ $t('developer.autoCrop.backend') }}</dt>
              <dd>{{ yolo.result.backend ?? '—' }}</dd>
            </div>
            <div>
              <dt>{{ $t('developer.autoCrop.duration') }}</dt>
              <dd>{{ fmtMs(yolo.result.durationMs) }}</dd>
            </div>
            <div>
              <dt>{{ $t('developer.autoCrop.bbox') }}</dt>
              <dd>{{ bboxLabel(yolo.result.bbox) }}</dd>
            </div>
            <div>
              <dt>{{ $t('developer.autoCrop.confidence') }}</dt>
              <dd>{{ bboxConfidence(yolo.result.bbox) }}</dd>
            </div>
            <div>
              <dt>{{ $t('developer.autoCrop.edges') }}</dt>
              <dd>{{ yolo.result.hasEdges ? $t('developer.autoCrop.edgesYes') : $t('developer.autoCrop.edgesNo') }}</dd>
            </div>
            <div>
              <dt>{{ $t('developer.autoCrop.candidates') }}</dt>
              <dd>{{ yolo.result.candidates }}</dd>
            </div>
          </dl>
        </details>
      </section>

      <section class="lab-card">
        <div class="lab-card-title">
          <h3>{{ $t('developer.ai.title') }}</h3>
          <p>{{ $t('developer.ai.blurb') }}</p>
        </div>
        <div class="btn-row">
          <button class="tech-btn" type="button" :disabled="!hasA || llm.running" @click="testLlm">
            {{ llm.running ? $t('developer.ai.testing') : $t('developer.ai.testLlm') }}
          </button>
          <button class="tech-btn" type="button" :disabled="!hasA || ml.running" @click="testMl">
            {{ ml.running ? $t('developer.ai.testing') : $t('developer.ai.testMl') }}
          </button>
        </div>
        <p v-if="llm.error" class="lab-error">{{ llm.error }}</p>
        <details v-if="llm.result" :key="'llm-' + llm.runId" open>
          <summary>{{ $t('developer.ai.llmResults') }}</summary>
          <dl class="lab-meta">
            <div>
              <dt>{{ $t('developer.ai.decision') }}</dt>
              <dd>{{ classLabel(llm.result.classification) }}</dd>
            </div>
            <div>
              <dt>{{ $t('developer.ai.model') }}</dt>
              <dd>{{ llm.result.modelUsed || '—' }}</dd>
            </div>
            <div>
              <dt>{{ $t('developer.ai.duration') }}</dt>
              <dd>{{ fmtMs(llm.result.durationMs) }}</dd>
            </div>
          </dl>
        </details>
        <p v-if="ml.error" class="lab-error">{{ ml.error }}</p>
        <details v-if="ml.result" :key="'ml-' + ml.runId" open>
          <summary>{{ $t('developer.ai.mlResults') }}</summary>
          <dl class="lab-meta">
            <div>
              <dt>{{ $t('developer.ai.decision') }}</dt>
              <dd>{{ classLabel(ml.result.decision) }}</dd>
            </div>
            <div>
              <dt>{{ $t('developer.ai.predictedClass') }}</dt>
              <dd>{{ classLabel(ml.result.predictedClass) }}</dd>
            </div>
            <div>
              <dt>{{ $t('developer.ai.confidence') }}</dt>
              <dd>{{ fmtProb(ml.result.confidence) }}</dd>
            </div>
            <div>
              <dt>{{ $t('developer.ai.slide') }}</dt>
              <dd>{{ fmtProb(ml.result.probabilities.slide) }}</dd>
            </div>
            <div>
              <dt>{{ $t('developer.ai.notSlide') }}</dt>
              <dd>{{ fmtProb(ml.result.probabilities.not_slide) }}</dd>
            </div>
            <div>
              <dt>{{ $t('developer.ai.maybeSlide') }}</dt>
              <dd>{{ fmtProb(ml.result.probabilities.may_be_slide) }}</dd>
            </div>
            <div class="span-2">
              <dt>{{ $t('developer.ai.thresholds') }}</dt>
              <dd>
                {{ ml.result.thresholds.trustLow }} / {{ ml.result.thresholds.trustHigh }} /
                {{ ml.result.thresholds.slideCheckLow }}
              </dd>
            </div>
            <div>
              <dt>{{ $t('developer.ai.duration') }}</dt>
              <dd>{{ fmtMs(ml.result.durationMs) }}</dd>
            </div>
          </dl>
        </details>
      </section>

      <section class="lab-card" :class="{ muted: !hasBoth }">
        <div class="lab-card-title">
          <h3>{{ $t('developer.comparison.title') }}</h3>
          <p>{{ hasBoth ? $t('developer.comparison.blurb') : $t('developer.comparison.needTwoImages') }}</p>
        </div>
        <div class="btn-row">
          <button class="tech-btn" type="button" :disabled="!hasBoth || ssim.running" @click="testSsim">
            {{ ssim.running ? $t('developer.comparison.testing') : $t('developer.comparison.testSsim') }}
          </button>
          <button class="tech-btn" type="button" :disabled="!hasBoth || phash.running" @click="testPhash">
            {{ phash.running ? $t('developer.comparison.testing') : $t('developer.comparison.testPhash') }}
          </button>
        </div>
        <p v-if="ssim.error" class="lab-error">{{ ssim.error }}</p>
        <details v-if="ssim.result" :key="'ssim-' + ssim.runId" open>
          <summary>{{ $t('developer.comparison.ssimResults') }}</summary>
          <dl class="lab-meta">
            <div>
              <dt>{{ $t('developer.comparison.ssimScore') }}</dt>
              <dd>{{ ssim.result.score.toFixed(6) }}</dd>
            </div>
            <div>
              <dt>{{ $t('developer.comparison.ssimThreshold') }}</dt>
              <dd>{{ ssim.result.threshold }}</dd>
            </div>
            <div>
              <dt>{{ $t('developer.comparison.downsampling') }}</dt>
              <dd>
                <template v-if="ssim.result.downsample">
                  {{ ssim.result.downsample.width }}×{{ ssim.result.downsample.height }}
                </template>
                <template v-else>{{ $t('developer.comparison.fullRes') }}</template>
              </dd>
            </div>
            <div>
              <dt>{{ $t('developer.comparison.verdict') }}</dt>
              <dd>{{ ssim.result.same ? $t('developer.comparison.sameSlide') : $t('developer.comparison.diffSlide') }}</dd>
            </div>
            <div>
              <dt>{{ $t('developer.comparison.duration') }}</dt>
              <dd>{{ fmtMs(ssim.result.durationMs) }}</dd>
            </div>
          </dl>
        </details>
        <p v-if="phash.error" class="lab-error">{{ phash.error }}</p>
        <details v-if="phash.result" :key="'phash-' + phash.runId" open>
          <summary>{{ $t('developer.comparison.phashResults') }}</summary>
          <dl class="lab-meta">
            <div>
              <dt>{{ $t('developer.comparison.phashDistance') }}</dt>
              <dd>{{ phash.result.distance }}</dd>
            </div>
            <div>
              <dt>{{ $t('developer.comparison.phashThreshold') }}</dt>
              <dd>{{ phash.result.threshold }}</dd>
            </div>
            <div>
              <dt>{{ $t('developer.comparison.verdict') }}</dt>
              <dd>{{ phash.result.duplicate ? $t('developer.comparison.duplicate') : $t('developer.comparison.distinct') }}</dd>
            </div>
            <div class="span-2">
              <dt>{{ $t('developer.comparison.hashA') }}</dt>
              <dd class="hash">{{ phash.result.hashA }}</dd>
            </div>
            <div class="span-2">
              <dt>{{ $t('developer.comparison.hashB') }}</dt>
              <dd class="hash">{{ phash.result.hashB }}</dd>
            </div>
            <div>
              <dt>{{ $t('developer.comparison.duration') }}</dt>
              <dd>{{ fmtMs(phash.result.durationMs) }}</dd>
            </div>
          </dl>
        </details>
      </section>
    </aside>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { useDeveloperLab } from '@features/developer/useDeveloperLab'
import type { DetectResult } from '@shared/workers/autoCrop.worker'

const { t } = useI18n()
const {
  imageMode,
  slotA,
  slotB,
  slotAPreview,
  slotBPreview,
  loadError,
  hasA,
  hasBoth,
  canny,
  yolo,
  llm,
  ml,
  ssim,
  phash,
  setMode,
  pickSlot,
  clearSlot,
  testCanny,
  testYolo,
  testLlm,
  testMl,
  testSsim,
  testPhash,
} = useDeveloperLab()

const fmtMs = (ms: number) => `${Math.round(ms)} ms`

const fmtProb = (value: number) => {
  if (!Number.isFinite(value)) return '—'
  return `${(value * 100).toFixed(1)}%`
}

const bboxLabel = (box: DetectResult['bbox']) => {
  if (!box) return t('developer.autoCrop.noDetection')
  return `${Math.round(box.x)}, ${Math.round(box.y)} · ${Math.round(box.w)}×${Math.round(box.h)}`
}

const bboxConfidence = (box: DetectResult['bbox']) => {
  if (!box) return '—'
  const value = box.confidence ?? box.score
  return Number.isFinite(value) ? value.toFixed(3) : '—'
}

const classLabel = (value: string) => {
  switch (value) {
    case 'slide':
      return t('developer.class.slide')
    case 'not_slide':
      return t('developer.class.notSlide')
    case 'may_be_slide':
      return t('developer.class.maybeSlide')
    case 'may_be_slide_edit':
      return t('developer.class.maybeSlideEdit')
    default:
      return value
  }
}
</script>

<style scoped>
.developer-page {
  --lab-mono: ui-monospace, 'SF Mono', Menlo, Consolas, monospace;
  display: flex;
  height: 100%;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
  background-color: var(--bg-page);
  color: var(--text-primary);
}

.stage-pane {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  padding: 16px 20px 18px;
  gap: 12px;
  background: var(--bg-page);
}

.stage-toolbar {
  display: flex;
  align-items: center;
  flex-shrink: 0;
}

/* Same macOS segmented control as Search Live|Recorded. */
.mode-switch {
  display: flex;
  align-items: center;
  padding: 2px;
  border-radius: 8px;
  background: var(--bg-page-alt);
  border: 1px solid var(--border-color);
}

.mode-pill {
  display: inline-flex;
  align-items: center;
  padding: 4px 12px;
  border: 1px solid transparent;
  border-radius: 6px;
  background: transparent;
  color: var(--text-secondary);
  font: inherit;
  font-size: 13px;
  font-weight: 500;
  line-height: 1.2;
  cursor: pointer;
  transition: all 0.15s;
}

.mode-pill:hover {
  color: var(--text-primary);
}

.mode-pill.active {
  background: var(--bg-surface);
  border-color: var(--border-strong);
  color: var(--text-primary);
  box-shadow: 0 1px 2px var(--shadow-sm);
}

.bench {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.bench-rail {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 8px;
  flex-shrink: 0;
}

.rail-label,
.rail-hint {
  font-family: var(--lab-mono);
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--text-muted);
  flex-shrink: 0;
}

.rail-hint {
  font-weight: 500;
  letter-spacing: 0.04em;
}

.rail-line {
  flex: 1;
  height: 1px;
  background: var(--border-color);
}

.comparator {
  position: relative;
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: 1fr 1fr;
  border: 1px solid var(--border-color);
  background: var(--bg-surface);
}

.comparator--single {
  grid-template-columns: 1fr;
}

.channel {
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
  cursor: pointer;
  background: var(--bg-subtle);
}

.channel:first-child {
  border-right: 1px solid var(--border-color);
}

.comparator--single .channel:first-child {
  border-right: none;
}

.channel:hover {
  background: var(--bg-elevated);
}

.channel--filled {
  cursor: default;
  background: var(--bg-page);
}

.channel-head {
  display: flex;
  align-items: baseline;
  gap: 8px;
  padding: 8px 12px;
  border-bottom: 1px solid var(--border-color);
  background: var(--bg-surface);
  font-family: var(--lab-mono);
  font-size: 11px;
  flex-shrink: 0;
}

.channel-id {
  font-weight: 700;
  letter-spacing: 0.08em;
  color: var(--accent);
}

.channel-name {
  color: var(--text-secondary);
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.channel-file {
  margin-left: auto;
  max-width: 45%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--text-muted);
}

.channel-stage {
  position: relative;
  flex: 1;
  min-height: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

.stage-empty {
  text-align: center;
  padding: 32px 16px;
  color: var(--text-muted);
}

.stage-crosshair {
  display: block;
  font-family: var(--lab-mono);
  font-size: 28px;
  line-height: 1;
  margin-bottom: 10px;
  color: var(--border-strong);
}

.stage-title {
  margin: 0;
  font-family: var(--lab-mono);
  font-size: 12px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--text-secondary);
}

.stage-hint {
  margin: 6px 0 0;
  font-size: 12px;
  color: var(--text-muted);
}

.stage-preview {
  display: block;
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
}

.channel-foot {
  display: flex;
  gap: 0;
  border-top: 1px solid var(--border-color);
  background: var(--bg-surface);
  flex-shrink: 0;
}

.channel-foot .tech-btn {
  flex: 1;
  border: none;
  border-right: 1px solid var(--border-color);
  border-radius: 0;
}

.channel-foot .tech-btn:last-child {
  border-right: none;
}

.comparator-gutter {
  position: absolute;
  left: 50%;
  top: 34px;
  bottom: 0;
  width: 0;
  transform: translateX(-50%);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  pointer-events: none;
  z-index: 1;
}

.gutter-tick {
  width: 1px;
  flex: 1;
  background: var(--border-strong);
  opacity: 0.55;
}

.gutter-label {
  font-family: var(--lab-mono);
  font-size: 11px;
  font-weight: 600;
  color: var(--text-muted);
  background: var(--bg-surface);
  border: 1px solid var(--border-strong);
  padding: 2px 6px;
  line-height: 1;
}

.control-pane {
  flex: 0 0 320px;
  width: 320px;
  min-height: 0;
  overflow: auto;
  padding: 16px 0 20px;
  border-left: 1px solid var(--border-color);
  background: var(--bg-page);
  display: flex;
  flex-direction: column;
  gap: 0;
}

.lab-card {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 14px 16px 16px;
  border: none;
  border-bottom: 1px solid var(--border-color);
  border-radius: 0;
  background: transparent;
}

.lab-card.muted {
  opacity: 0.72;
}

.lab-card-title h3 {
  margin: 0;
  font-family: var(--lab-mono);
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}

.lab-card-title p {
  margin: 6px 0 0;
  font-size: 12px;
  color: var(--text-muted);
  line-height: 1.4;
}

.btn-row {
  display: flex;
  gap: 0;
  border: 1px solid var(--border-color);
}

.btn-row .tech-btn {
  flex: 1 1 0;
  min-width: 0;
  border: none;
  border-right: 1px solid var(--border-color);
  border-radius: 0;
}

.btn-row .tech-btn:last-child {
  border-right: none;
}

.tech-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  margin: 0;
  padding: 10px 12px;
  border: 1px solid var(--border-color);
  border-radius: 0;
  background: var(--bg-surface);
  color: var(--text-secondary);
  font-family: var(--lab-mono);
  font-size: 12px;
  letter-spacing: 0.04em;
  cursor: pointer;
}

.tech-btn:hover:not(:disabled) {
  color: var(--text-primary);
  background: var(--bg-hover);
}

.tech-btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.tech-btn--mute {
  color: var(--text-muted);
}

.lab-error {
  margin: 0;
  font-size: 12px;
  color: var(--danger);
}

.stage-error {
  flex-shrink: 0;
}

.lab-card details {
  border-top: 1px solid var(--border-color);
  padding-top: 8px;
}

.lab-card summary {
  cursor: pointer;
  font-family: var(--lab-mono);
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--text-secondary);
}

.lab-meta {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px 12px;
  margin: 8px 0 0;
}

.lab-meta .span-2 {
  grid-column: 1 / -1;
}

.lab-meta dt {
  font-family: var(--lab-mono);
  font-size: 10px;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

.lab-meta dd {
  margin: 2px 0 0;
  font-size: 12px;
  font-variant-numeric: tabular-nums;
  color: var(--text-primary);
  word-break: break-all;
}

.lab-meta dd.hash {
  font-family: var(--lab-mono);
  font-size: 11px;
}
</style>
