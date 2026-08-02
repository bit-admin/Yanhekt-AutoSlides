<template>
  <div class="lab-page custom-scrollbar">
    <header class="topbar">
      <a class="brand" href="/">
        <svg class="brand-mark" width="30" height="22" viewBox="0 0 30 22" fill="none" aria-hidden="true">
          <rect width="30" height="22" rx="5" fill="#FF0000" />
          <polygon points="12,6 20,11 12,16" fill="white" />
          <line x1="6" y1="18" x2="24" y2="18" stroke="white" stroke-width="1.5" stroke-linecap="round" />
        </svg>
        <span class="brand-text">AutoSlides</span>
      </a>
      <span class="topbar-sep" aria-hidden="true">/</span>
      <span class="topbar-crumb">{{ $t('lab.imageComparison') }}</span>
      <span class="topbar-meta">SSIM · pHash · calibration</span>
    </header>

    <main class="page-body">
      <!-- Title block: technical header with rule -->
      <header class="masthead">
        <div class="masthead-left">
          <p class="eyebrow">
            <span class="eyebrow-mark">◈</span>
            LAB / FRAME COMPARATOR
          </p>
          <h1 class="hero-title">{{ $t('lab.imageComparison') }}</h1>
          <p class="hero-lead">
            Place two consecutive lecture frames on the bench. Measure global SSIM
            (extraction path), windowed SSIM (ssim.js), and DCT perceptual hashes —
            then set the thresholds you will ship.
          </p>
        </div>
        <aside class="masthead-spec" aria-label="Spec">
          <div class="spec-row"><span>MODE</span><code>offline · local</code></div>
          <div class="spec-row"><span>SSIM.JS</span><code>{{ ssimReady ? 'cdn ready' : (ssimError ? 'cdn fail' : 'loading…') }}</code></div>
          <div class="spec-row"><span>PIPELINE</span><code>isolated</code></div>
        </aside>
      </header>

      <div class="rule" aria-hidden="true" />

      <!-- Comparator: CH-A | CH-B -->
      <section class="bench" aria-label="Frame pair">
        <div class="bench-rail">
          <span class="rail-label">INPUT</span>
          <span class="rail-line" />
          <span class="rail-hint">CH-A  ·  CH-B</span>
        </div>

        <div class="comparator">
          <div
            v-for="slot in slots"
            :key="slot.id"
            class="channel"
            :class="{
              'channel--filled': !!slot.src,
              'channel--drag': slot.dragging,
            }"
            @dragenter.prevent="onDrag(slot.id, true)"
            @dragover.prevent="onDrag(slot.id, true)"
            @dragleave.prevent="onDrag(slot.id, false)"
            @drop.prevent="onDrop(slot.id, $event)"
            @click="openPicker(slot.id)"
          >
            <div class="channel-head">
              <span class="channel-id">CH-{{ slot.id === 1 ? 'A' : 'B' }}</span>
              <span class="channel-name">{{ slot.label }}</span>
              <span v-if="slot.fileName" class="channel-file" :title="slot.fileName">{{ slot.fileName }}</span>
            </div>

            <input
              :ref="(el) => setFileInput(slot.id, el)"
              type="file"
              accept="image/*"
              class="sr-only"
              @change="onFileInput(slot.id, $event)"
              @click.stop
            >

            <div class="channel-stage">
              <template v-if="!slot.src">
                <div class="stage-empty">
                  <span class="stage-crosshair" aria-hidden="true">+</span>
                  <p class="stage-title">No frame</p>
                  <p class="stage-hint">Drop image · click to browse</p>
                </div>
              </template>
              <template v-else>
                <img
                  :ref="(el) => setImgEl(slot.id, el)"
                  :src="slot.src"
                  :alt="slot.label"
                  class="stage-preview"
                >
              </template>
            </div>

            <div v-if="slot.src" class="channel-foot" @click.stop>
              <button type="button" class="tech-btn" @click="openPicker(slot.id)">Replace</button>
              <button type="button" class="tech-btn tech-btn--mute" @click="clearSlot(slot.id)">Clear</button>
            </div>
          </div>

          <div class="comparator-gutter" aria-hidden="true">
            <span class="gutter-tick" />
            <span class="gutter-label">Δ</span>
            <span class="gutter-tick" />
          </div>
        </div>
      </section>

      <!-- Instrument bar -->
      <section class="instrument">
        <button
          type="button"
          class="tech-btn"
          :aria-expanded="showThresholds"
          @click="showThresholds = !showThresholds"
        >
          <span class="tech-btn-key">THR</span>
          Thresholds
          <span class="tech-btn-caret" :class="{ open: showThresholds }">▾</span>
        </button>

        <div class="instrument-status">
          <span class="led" :class="statusLedClass" aria-hidden="true" />
          <span class="status-text">{{ statusText }}</span>
        </div>

        <button
          type="button"
          class="run-btn"
          :disabled="analyzing || !ssimReady || !bothReady"
          @click="analyzeImages"
        >
          <span v-if="analyzing" class="run-spinner" aria-hidden="true" />
          <span v-else class="run-glyph" aria-hidden="true">▶</span>
          {{ analyzing ? 'RUNNING…' : 'ANALYZE' }}
        </button>
      </section>

      <div v-if="showThresholds" class="thr-panel">
        <div class="thr-panel-head">
          <span>THRESHOLD REGISTER</span>
          <span class="thr-panel-note">Below → DIFFERENT · Above/equal (SSIM) → SAME</span>
        </div>
        <div class="thr-grid">
          <label v-for="field in thresholdFields" :key="field.key" class="thr-cell">
            <span class="thr-key">{{ field.code }}</span>
            <span class="thr-label">{{ field.label }}</span>
            <input
              v-model.number="thresholds[field.key]"
              type="number"
              class="thr-input"
              :min="field.min"
              :max="field.max"
              :step="field.step"
            >
            <span class="thr-unit">{{ field.hint }}</span>
          </label>
        </div>
      </div>

      <!-- Results -->
      <section class="results" aria-live="polite">
        <div v-if="!report && !errorMsg && !analyzing" class="idle">
          <div class="idle-rule" />
          <p class="idle-code">AWAITING_INPUT</p>
          <p class="idle-copy">Load CH-A and CH-B, then run ANALYZE. Prefer consecutive captures from the same lecture.</p>
          <div class="idle-rule" />
        </div>

        <div v-if="errorMsg" class="fault">
          <span class="fault-tag">FAULT</span>
          <div>
            <strong>Analysis aborted</strong>
            <p>{{ errorMsg }}</p>
          </div>
        </div>

        <template v-if="report">
          <!-- Readout strip -->
          <div class="readout-head">
            <span class="rail-label">READOUT</span>
            <span class="rail-line" />
            <span class="rail-hint">{{ report.verdicts.filter(v => v.diff).length }} DIFF · {{ report.verdicts.filter(v => !v.diff).length }} SAME</span>
          </div>

          <div class="readout-grid">
            <article
              v-for="v in report.verdicts"
              :key="v.id"
              class="meter"
              :class="v.diff ? 'meter--diff' : 'meter--same'"
            >
              <div class="meter-top">
                <span class="meter-id">{{ v.code }}</span>
                <span class="meter-flag">{{ v.diff ? 'DIFF' : 'SAME' }}</span>
              </div>
              <p class="meter-value">{{ v.score }}</p>
              <p class="meter-meta">thr {{ v.threshold }} · {{ v.detail }}</p>
              <div class="meter-track" aria-hidden="true">
                <div
                  class="meter-fill"
                  :style="scoreBarStyle(v)"
                />
                <div
                  v-if="v.kind === 'ssim'"
                  class="meter-mark"
                  :style="{ left: `${Math.min(100, Math.max(0, Number(v.threshold) * 100))}%` }"
                />
              </div>
            </article>
          </div>

          <!-- Quality -->
          <div class="block">
            <div class="block-head">
              <span class="rail-label">FRAME QUALITY</span>
              <span class="rail-line" />
              <span class="rail-hint">per channel · independent of Δ</span>
            </div>
            <div class="quality-split">
              <div class="quality-pane">
                <div class="quality-title">
                  <span>CH-A</span>
                  <code>{{ report.dims1 }}</code>
                </div>
                <table class="data-table">
                  <tbody>
                    <tr><th>Laplacian σ²</th><td>{{ report.blur1 }}</td></tr>
                    <tr><th>High-pass noise</th><td>{{ report.noise1 }}</td></tr>
                    <tr><th>Entropy</th><td>{{ report.entropy1 }} <em>bits</em></td></tr>
                  </tbody>
                </table>
              </div>
              <div class="quality-pane">
                <div class="quality-title">
                  <span>CH-B</span>
                  <code>{{ report.dims2 }}</code>
                </div>
                <table class="data-table">
                  <tbody>
                    <tr><th>Laplacian σ²</th><td>{{ report.blur2 }}</td></tr>
                    <tr><th>High-pass noise</th><td>{{ report.noise2 }}</td></tr>
                    <tr><th>Entropy</th><td>{{ report.entropy2 }} <em>bits</em></td></tr>
                  </tbody>
                </table>
              </div>
            </div>
            <p class="annotation">
              ↑ Laplacian → sharper · ↑ noise → grain · entropy max 8.0 bits (8-bit gray)
            </p>
          </div>

          <!-- SSIM log -->
          <div class="block">
            <div class="block-head">
              <span class="rail-label">SSIM LOG</span>
              <span class="rail-line" />
            </div>
            <table class="log-table">
              <thead>
                <tr>
                  <th>Channel</th>
                  <th>Method</th>
                  <th>Score</th>
                  <th>Verdict</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td><code>GLO</code></td>
                  <td>Global mean/var/cov (extraction-style)</td>
                  <td class="num" :class="report.globalDiff ? 'is-diff' : 'is-same'">{{ report.globalSsim }}</td>
                  <td><span class="flag" :class="report.globalDiff ? 'flag--diff' : 'flag--same'">{{ report.globalDiff ? 'DIFF' : 'SAME' }}</span></td>
                </tr>
                <tr>
                  <td><code>DSG</code></td>
                  <td>Downsample 480×270 → global</td>
                  <td class="num" :class="report.downsampledDiff ? 'is-diff' : 'is-same'">{{ report.downsampledSsim }}</td>
                  <td><span class="flag" :class="report.downsampledDiff ? 'flag--diff' : 'flag--same'">{{ report.downsampledDiff ? 'DIFF' : 'SAME' }}</span></td>
                </tr>
                <tr>
                  <td><code>STD</code></td>
                  <td>Sliding window (ssim.js) · map {{ report.ssimMapDims }} · {{ report.ssimMapPoints }} cells</td>
                  <td class="num" :class="report.standardDiff ? 'is-diff' : 'is-same'">{{ report.standardSsim }}</td>
                  <td><span class="flag" :class="report.standardDiff ? 'flag--diff' : 'flag--same'">{{ report.standardDiff ? 'DIFF' : 'SAME' }}</span></td>
                </tr>
              </tbody>
            </table>
          </div>

          <!-- pHash -->
          <div class="block">
            <div class="block-head">
              <span class="rail-label">PHASH REGISTER</span>
              <span class="rail-line" />
              <span class="rail-hint">Hamming &gt; thr → DIFF</span>
            </div>
            <div class="phash-grid">
              <article
                v-for="p in report.phashes"
                :key="p.bits"
                class="phash-panel"
                :class="p.diff ? 'phash-panel--diff' : 'phash-panel--same'"
              >
                <div class="phash-top">
                  <code>{{ p.bits }}-BIT</code>
                  <span class="flag" :class="p.diff ? 'flag--diff' : 'flag--same'">{{ p.diff ? 'DIFF' : 'SAME' }}</span>
                </div>
                <p class="phash-dist">
                  d=<strong>{{ p.hamming }}</strong><span class="phash-thr">/{{ p.threshold }}</span>
                </p>
                <div class="hash-line">
                  <span>A</span>
                  <code>{{ p.hash1 }}</code>
                </div>
                <div class="hash-line">
                  <span>B</span>
                  <code>{{ p.hash2 }}</code>
                </div>
              </article>
            </div>
          </div>

          <!-- Timing -->
          <div class="block">
            <div class="block-head">
              <span class="rail-label">TIMING</span>
              <span class="rail-line" />
              <span class="rail-hint">performance.now()</span>
            </div>
            <table class="log-table log-table--dense">
              <tbody>
                <tr v-for="row in report.timingRows" :key="row.label">
                  <th>{{ row.label }}</th>
                  <td class="num">{{ row.value }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </template>
      </section>
    </main>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import {
  calculateGlobalSSIM,
  calculateGrayscaleHistogramEntropy,
  calculateHammingDistance,
  calculateHighPassNoiseLevel,
  calculateStandardPerceptualHash,
  calculateStandardSSIM,
  calculateVarianceOfLaplacian,
  ensureSsimLoaded,
  loadImageAsImageData,
  resizeImageData,
} from './imageComparisonAlgorithms'

defineOptions({ name: 'ImageComparisonPage' })

type SlotId = 1 | 2

interface SlotState {
  id: SlotId
  label: string
  src: string
  fileName: string
  dragging: boolean
}

interface Thresholds {
  globalSsim: number
  standardSsim: number
  hash64: number
  hash256: number
  hash1024: number
}

interface Verdict {
  id: string
  code: string
  name: string
  score: string
  threshold: string
  detail: string
  diff: boolean
  ratio: number
  kind: 'ssim' | 'hamming'
}

interface PhashRow {
  bits: number
  hamming: number
  threshold: number
  diff: boolean
  hash1: string
  hash2: string
}

interface TimingRow {
  label: string
  value: string
}

interface Report {
  dims1: string
  dims2: string
  blur1: string
  blur2: string
  noise1: string
  noise2: string
  entropy1: string
  entropy2: string
  globalSsim: string
  globalDiff: boolean
  downsampledSsim: string
  downsampledDiff: boolean
  standardSsim: string
  standardDiff: boolean
  ssimMapDims: string
  ssimMapPoints: string
  verdicts: Verdict[]
  phashes: PhashRow[]
  timingRows: TimingRow[]
}

const thresholds = reactive<Thresholds>({
  globalSsim: 0.999,
  standardSsim: 0.999,
  hash64: 5,
  hash256: 20,
  hash1024: 80,
})

const thresholdFields: {
  key: keyof Thresholds
  code: string
  label: string
  hint: string
  min: number
  max: number
  step: number
}[] = [
  { key: 'globalSsim', code: 'GLO', label: 'Global SSIM', hint: '0–1', min: 0, max: 1, step: 0.001 },
  { key: 'standardSsim', code: 'STD', label: 'Standard SSIM', hint: '0–1', min: 0, max: 1, step: 0.01 },
  { key: 'hash64', code: 'H64', label: 'pHash 64', hint: 'ham', min: 0, max: 64, step: 1 },
  { key: 'hash256', code: 'H256', label: 'pHash 256', hint: 'ham', min: 0, max: 256, step: 1 },
  { key: 'hash1024', code: 'H1K', label: 'pHash 1024', hint: 'ham', min: 0, max: 1024, step: 1 },
]

const slot1 = reactive<SlotState>({
  id: 1,
  label: 'Image 1',
  src: '',
  fileName: '',
  dragging: false,
})
const slot2 = reactive<SlotState>({
  id: 2,
  label: 'Image 2',
  src: '',
  fileName: '',
  dragging: false,
})
const slots = [slot1, slot2]

const fileInputs: Partial<Record<SlotId, HTMLInputElement | null>> = {}
const imgEls: Partial<Record<SlotId, HTMLImageElement | null>> = {}

function setFileInput(id: SlotId, el: unknown) {
  fileInputs[id] = (el as HTMLInputElement | null) ?? null
}
function setImgEl(id: SlotId, el: unknown) {
  imgEls[id] = (el as HTMLImageElement | null) ?? null
}

const showThresholds = ref(false)
const analyzing = ref(false)
const ssimReady = ref(false)
const ssimError = ref('')
const errorMsg = ref('')
const report = ref<Report | null>(null)

const bothReady = computed(() => !!slot1.src && !!slot2.src)

const statusText = computed(() => {
  if (ssimError.value) return ssimError.value
  if (!ssimReady.value) return 'Loading ssim.js from CDN…'
  if (analyzing.value) return 'Computing metrics…'
  if (!bothReady.value) return 'Arm both channels to run'
  return 'Armed · ready to analyze'
})

const statusLedClass = computed(() => {
  if (ssimError.value) return 'led--fault'
  if (!ssimReady.value || analyzing.value) return 'led--busy'
  if (bothReady.value) return 'led--ok'
  return 'led--idle'
})

function slotOf(id: SlotId): SlotState {
  return id === 1 ? slot1 : slot2
}

function openPicker(id: SlotId) {
  fileInputs[id]?.click()
}

function onDrag(id: SlotId, active: boolean) {
  slotOf(id).dragging = active
}

function assignFile(id: SlotId, file: File | undefined) {
  const slot = slotOf(id)
  if (!file || !file.type.startsWith('image/')) return
  if (slot.src.startsWith('blob:')) URL.revokeObjectURL(slot.src)
  slot.src = URL.createObjectURL(file)
  slot.fileName = file.name
  slot.dragging = false
  report.value = null
  errorMsg.value = ''
}

function onDrop(id: SlotId, event: DragEvent) {
  slotOf(id).dragging = false
  assignFile(id, event.dataTransfer?.files?.[0])
}

function onFileInput(id: SlotId, event: Event) {
  const input = event.target as HTMLInputElement
  assignFile(id, input.files?.[0])
  input.value = ''
}

function clearSlot(id: SlotId) {
  const slot = slotOf(id)
  if (slot.src.startsWith('blob:')) URL.revokeObjectURL(slot.src)
  slot.src = ''
  slot.fileName = ''
  report.value = null
}

function waitForImage(img: HTMLImageElement): Promise<void> {
  if (img.complete && img.naturalWidth > 0) return Promise.resolve()
  return new Promise((resolve, reject) => {
    img.onload = () => resolve()
    img.onerror = () => reject(new Error('Failed to load image'))
  })
}

function ms(n: number): string {
  return `${n.toFixed(2)} ms`
}

function scoreBarStyle(v: Verdict): Record<string, string> {
  const pct = Math.max(0, Math.min(1, v.ratio)) * 100
  return { width: `${pct}%` }
}

onMounted(async () => {
  try {
    await ensureSsimLoaded()
    ssimReady.value = true
  } catch (e) {
    ssimError.value = e instanceof Error ? e.message : String(e)
    ssimReady.value = false
  }
})

async function analyzeImages() {
  analyzing.value = true
  errorMsg.value = ''
  report.value = null
  await new Promise((r) => setTimeout(r, 40))

  const totalStart = performance.now()
  const timings: Record<string, number> = {}

  try {
    const el1 = imgEls[1]
    const el2 = imgEls[2]
    if (!el1 || !el2 || !slot1.src || !slot2.src) {
      throw new Error('Both CH-A and CH-B must be loaded.')
    }
    await Promise.all([waitForImage(el1), waitForImage(el2)])

    let start = performance.now()
    const img1Data = await loadImageAsImageData(el1)
    timings.img1Load = performance.now() - start

    start = performance.now()
    const img2Data = await loadImageAsImageData(el2)
    timings.img2Load = performance.now() - start

    start = performance.now()
    const img1BlurScore = calculateVarianceOfLaplacian(img1Data)
    timings.img1Blur = performance.now() - start

    start = performance.now()
    const img2BlurScore = calculateVarianceOfLaplacian(img2Data)
    timings.img2Blur = performance.now() - start

    start = performance.now()
    const img1Entropy = calculateGrayscaleHistogramEntropy(img1Data)
    timings.img1Entropy = performance.now() - start

    start = performance.now()
    const img2Entropy = calculateGrayscaleHistogramEntropy(img2Data)
    timings.img2Entropy = performance.now() - start

    start = performance.now()
    const img1NoiseLevel = calculateHighPassNoiseLevel(img1Data)
    timings.img1Noise = performance.now() - start

    start = performance.now()
    const img2NoiseLevel = calculateHighPassNoiseLevel(img2Data)
    timings.img2Noise = performance.now() - start

    const globalThresh = Number(thresholds.globalSsim)
    start = performance.now()
    const globalSSIM = calculateGlobalSSIM(img1Data, img2Data)
    timings.globalSSIM = performance.now() - start
    const globalDiff = globalSSIM < globalThresh

    start = performance.now()
    const downsampledImg1 = resizeImageData(img1Data, 480, 270)
    const downsampledImg2 = resizeImageData(img2Data, 480, 270)
    const downsampledGlobalSSIM = calculateGlobalSSIM(downsampledImg1, downsampledImg2)
    timings.downsampledGlobalSSIM = performance.now() - start
    const downsampledDiff = downsampledGlobalSSIM < globalThresh

    const standardThresh = Number(thresholds.standardSsim)
    start = performance.now()
    const standardSSIMResult = calculateStandardSSIM(img1Data, img2Data)
    timings.standardSSIM = performance.now() - start
    const standardDiff = standardSSIMResult.mssim < standardThresh
    const map = standardSSIMResult.ssim_map
    const ssimMapDims = map ? `${map.width}×${map.height}` : 'N/A'
    const ssimMapPoints = map ? String(map.width * map.height) : 'N/A'

    const pHashMap = [
      { bits: 64, side: 8, threshold: Number(thresholds.hash64) },
      { bits: 256, side: 16, threshold: Number(thresholds.hash256) },
      { bits: 1024, side: 32, threshold: Number(thresholds.hash1024) },
    ] as const

    const phashes: PhashRow[] = []
    for (const p of pHashMap) {
      start = performance.now()
      const hash1 = calculateStandardPerceptualHash(img1Data, p.side)
      timings[`pHash${p.bits}_1`] = performance.now() - start
      start = performance.now()
      const hash2 = calculateStandardPerceptualHash(img2Data, p.side)
      timings[`pHash${p.bits}_2`] = performance.now() - start
      const ham = calculateHammingDistance(hash1, hash2)
      phashes.push({
        bits: p.bits,
        hamming: ham,
        threshold: p.threshold,
        diff: ham > p.threshold,
        hash1: hash1.toString(16).padStart(p.bits / 4, '0'),
        hash2: hash2.toString(16).padStart(p.bits / 4, '0'),
      })
    }

    const totalDuration = performance.now() - totalStart
    const sumOfCalcs = Object.values(timings).reduce((a, b) => a + b, 0)
    const otherTime = totalDuration - sumOfCalcs
    const calcSum = sumOfCalcs - timings.img1Load - timings.img2Load

    const verdicts: Verdict[] = [
      {
        id: 'global',
        code: 'GLO',
        name: 'Global SSIM',
        score: globalSSIM.toFixed(6),
        threshold: String(globalThresh),
        detail: 'full frame',
        diff: globalDiff,
        ratio: globalSSIM,
        kind: 'ssim',
      },
      {
        id: 'down',
        code: 'DSG',
        name: 'Downsampled',
        score: downsampledGlobalSSIM.toFixed(6),
        threshold: String(globalThresh),
        detail: '480×270',
        diff: downsampledDiff,
        ratio: downsampledGlobalSSIM,
        kind: 'ssim',
      },
      {
        id: 'std',
        code: 'STD',
        name: 'Standard SSIM',
        score: standardSSIMResult.mssim.toFixed(6),
        threshold: String(standardThresh),
        detail: 'sliding window',
        diff: standardDiff,
        ratio: standardSSIMResult.mssim,
        kind: 'ssim',
      },
      ...phashes.map((p) => ({
        id: `p${p.bits}`,
        code: `H${p.bits === 1024 ? '1K' : p.bits}`,
        name: `pHash ${p.bits}`,
        score: String(p.hamming),
        threshold: String(p.threshold),
        detail: 'Hamming',
        diff: p.diff,
        ratio: p.hamming / p.bits,
        kind: 'hamming' as const,
      })),
    ]

    report.value = {
      dims1: `${img1Data.width}×${img1Data.height}`,
      dims2: `${img2Data.width}×${img2Data.height}`,
      blur1: img1BlurScore.toFixed(2),
      blur2: img2BlurScore.toFixed(2),
      noise1: img1NoiseLevel.toFixed(2),
      noise2: img2NoiseLevel.toFixed(2),
      entropy1: img1Entropy.toFixed(3),
      entropy2: img2Entropy.toFixed(3),
      globalSsim: globalSSIM.toFixed(6),
      globalDiff,
      downsampledSsim: downsampledGlobalSSIM.toFixed(6),
      downsampledDiff,
      standardSsim: standardSSIMResult.mssim.toFixed(6),
      standardDiff,
      ssimMapDims,
      ssimMapPoints,
      verdicts,
      phashes,
      timingRows: [
        { label: 'Load CH-A / CH-B', value: `${ms(timings.img1Load)} / ${ms(timings.img2Load)}` },
        { label: 'Blur CH-A / CH-B', value: `${ms(timings.img1Blur)} / ${ms(timings.img2Blur)}` },
        { label: 'Noise CH-A / CH-B', value: `${ms(timings.img1Noise)} / ${ms(timings.img2Noise)}` },
        { label: 'Entropy CH-A / CH-B', value: `${ms(timings.img1Entropy)} / ${ms(timings.img2Entropy)}` },
        { label: 'Global SSIM', value: ms(timings.globalSSIM) },
        { label: 'Downsampled SSIM', value: ms(timings.downsampledGlobalSSIM) },
        { label: 'Standard SSIM', value: ms(timings.standardSSIM) },
        { label: 'pHash 64 A/B', value: `${ms(timings.pHash64_1)} / ${ms(timings.pHash64_2)}` },
        { label: 'pHash 256 A/B', value: `${ms(timings.pHash256_1)} / ${ms(timings.pHash256_2)}` },
        { label: 'pHash 1024 A/B', value: `${ms(timings.pHash1024_1)} / ${ms(timings.pHash1024_2)}` },
        { label: 'Algorithms Σ', value: ms(calcSum) },
        { label: 'Overhead', value: ms(otherTime) },
      ],
    }

    requestAnimationFrame(() => {
      document.querySelector('.results')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
  } catch (e) {
    errorMsg.value = e instanceof Error ? e.message : String(e)
  } finally {
    analyzing.value = false
  }
}
</script>

<style scoped>
/* Calibration bench: sharp geometry, hairline rules, mono readouts.
   Signature: CH-A | Δ | CH-B comparator with instrument register chrome.
   border-radius: 0 everywhere on this page. */

.lab-page {
  --lab-ink: var(--text-primary);
  --lab-mute: var(--text-muted);
  --lab-dim: var(--text-secondary);
  --lab-line: var(--border-color);
  --lab-line-strong: var(--border-strong);
  --lab-panel: var(--bg-surface);
  --lab-well: var(--bg-subtle);
  --lab-mono: ui-monospace, 'SF Mono', 'Cascadia Code', 'Consolas', monospace;
  --lab-ok: var(--success);
  --lab-fault: var(--danger);
  --lab-accent: var(--accent);

  min-height: 100vh;
  background: var(--bg-page);
  color: var(--lab-ink);
  overflow: auto;
  font-feature-settings: 'tnum' 1, 'ss01' 0;
}

/* ---------- chrome ---------- */

.topbar {
  position: sticky;
  top: 0;
  z-index: var(--z-sticky, 20);
  display: flex;
  align-items: center;
  gap: 0.65rem;
  height: var(--header-height, 3.5rem);
  padding: 0 1.5rem;
  background: var(--bg-page);
  border-bottom: 1px solid var(--lab-line);
}

.brand {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  text-decoration: none;
  color: var(--lab-ink);
}

.brand-text {
  font-size: 1rem;
  font-weight: 600;
  letter-spacing: -0.03em;
}

.topbar-sep {
  color: var(--lab-mute);
  font-family: var(--lab-mono);
  font-size: 0.75rem;
}

.topbar-crumb {
  font-size: 0.8125rem;
  color: var(--lab-dim);
}

.topbar-meta {
  margin-left: auto;
  font-family: var(--lab-mono);
  font-size: 0.6875rem;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--lab-mute);
}

.page-body {
  max-width: 68rem;
  margin: 0 auto;
  padding: 0 1.5rem 4.5rem;
}

/* ---------- masthead ---------- */

.masthead {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 2rem;
  padding: 2.25rem 0 1.5rem;
  align-items: end;
}

@media (max-width: 720px) {
  .masthead {
    grid-template-columns: 1fr;
    gap: 1.25rem;
  }
}

.eyebrow {
  margin: 0 0 0.75rem;
  font-family: var(--lab-mono);
  font-size: 0.6875rem;
  font-weight: 500;
  letter-spacing: 0.14em;
  color: var(--lab-mute);
  display: flex;
  align-items: center;
  gap: 0.45rem;
}

.eyebrow-mark {
  color: var(--lab-accent);
}

.hero-title {
  margin: 0;
  font-size: clamp(1.85rem, 4.2vw, 2.5rem);
  font-weight: 700;
  letter-spacing: -0.045em;
  line-height: 1.05;
}

.hero-lead {
  margin: 0.85rem 0 0;
  max-width: 48ch;
  font-size: 0.9375rem;
  line-height: 1.55;
  color: var(--lab-dim);
}

.masthead-spec {
  min-width: 13rem;
  border: 1px solid var(--lab-line);
  background: var(--lab-well);
  padding: 0.65rem 0.75rem;
  font-family: var(--lab-mono);
  font-size: 0.6875rem;
}

.spec-row {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.3rem 0;
  color: var(--lab-mute);
  letter-spacing: 0.04em;
}

.spec-row + .spec-row {
  border-top: 1px solid var(--lab-line);
}

.spec-row code {
  color: var(--lab-ink);
  font-family: inherit;
  font-size: inherit;
}

.rule {
  height: 1px;
  background: var(--lab-line);
  margin-bottom: 1.5rem;
}

/* ---------- rails ---------- */

.bench-rail,
.block-head,
.readout-head {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 0.75rem;
}

.rail-label {
  font-family: var(--lab-mono);
  font-size: 0.6875rem;
  font-weight: 600;
  letter-spacing: 0.12em;
  color: var(--lab-mute);
  flex-shrink: 0;
}

.rail-line {
  flex: 1;
  height: 1px;
  background: var(--lab-line);
}

.rail-hint {
  font-family: var(--lab-mono);
  font-size: 0.6875rem;
  letter-spacing: 0.04em;
  color: var(--lab-mute);
  flex-shrink: 0;
}

/* ---------- comparator ---------- */

.comparator {
  position: relative;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0;
  border: 1px solid var(--lab-line-strong);
  background: var(--lab-panel);
}

@media (max-width: 720px) {
  .comparator {
    grid-template-columns: 1fr;
  }
  .comparator-gutter {
    display: none;
  }
}

.channel {
  display: flex;
  flex-direction: column;
  min-width: 0;
  cursor: pointer;
  background: var(--lab-well);
  transition: background-color 0.12s, outline-color 0.12s;
}

.channel:first-child {
  border-right: 1px solid var(--lab-line);
}

@media (max-width: 720px) {
  .channel:first-child {
    border-right: none;
    border-bottom: 1px solid var(--lab-line);
  }
}

.channel:hover {
  background: var(--bg-elevated);
}

.channel--drag {
  outline: 2px solid var(--lab-accent);
  outline-offset: -2px;
  background: color-mix(in srgb, var(--lab-accent) 6%, var(--lab-well));
}

.channel--filled {
  cursor: default;
  background: #0a0a0a;
}

.channel-head {
  display: flex;
  align-items: baseline;
  gap: 0.55rem;
  padding: 0.5rem 0.75rem;
  border-bottom: 1px solid var(--lab-line);
  background: var(--lab-panel);
  font-family: var(--lab-mono);
  font-size: 0.6875rem;
}

.channel-id {
  font-weight: 700;
  letter-spacing: 0.08em;
  color: var(--lab-accent);
}

.channel-name {
  color: var(--lab-dim);
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.channel-file {
  margin-left: auto;
  max-width: 40%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--lab-mute);
}

.channel-stage {
  position: relative;
  min-height: 15rem;
  display: flex;
  align-items: center;
  justify-content: center;
}

.stage-empty {
  text-align: center;
  padding: 2rem 1rem;
  color: var(--lab-mute);
}

.stage-crosshair {
  display: block;
  font-family: var(--lab-mono);
  font-size: 1.75rem;
  line-height: 1;
  margin-bottom: 0.65rem;
  color: var(--lab-line-strong);
}

.stage-title {
  margin: 0;
  font-family: var(--lab-mono);
  font-size: 0.75rem;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--lab-dim);
}

.stage-hint {
  margin: 0.35rem 0 0;
  font-size: 0.75rem;
  color: var(--lab-mute);
}

.stage-preview {
  display: block;
  width: 100%;
  height: 16.5rem;
  object-fit: contain;
  background: #000;
}

.channel-foot {
  display: flex;
  gap: 0;
  border-top: 1px solid var(--lab-line);
  background: var(--lab-panel);
}

.channel-foot .tech-btn {
  flex: 1;
  border: none;
  border-right: 1px solid var(--lab-line);
  border-radius: 0;
}

.channel-foot .tech-btn:last-child {
  border-right: none;
}

.comparator-gutter {
  position: absolute;
  left: 50%;
  top: 2.1rem;
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
  background: var(--lab-line-strong);
  opacity: 0.55;
}

.gutter-label {
  font-family: var(--lab-mono);
  font-size: 0.625rem;
  font-weight: 700;
  letter-spacing: 0.12em;
  color: var(--lab-mute);
  background: var(--bg-page);
  border: 1px solid var(--lab-line-strong);
  padding: 0.2rem 0.35rem;
  margin: 0.35rem 0;
}

/* ---------- instrument bar ---------- */

.instrument {
  display: flex;
  flex-wrap: wrap;
  align-items: stretch;
  gap: 0;
  margin-top: 1rem;
  border: 1px solid var(--lab-line-strong);
  background: var(--lab-panel);
}

.instrument .tech-btn {
  border: none;
  border-right: 1px solid var(--lab-line);
}

.instrument-status {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 0.55rem;
  padding: 0 0.9rem;
  min-width: 10rem;
  font-family: var(--lab-mono);
  font-size: 0.75rem;
  color: var(--lab-dim);
}

.led {
  width: 0.5rem;
  height: 0.5rem;
  flex-shrink: 0;
  background: var(--lab-mute);
  box-shadow: none;
}

.led--ok {
  background: var(--lab-ok);
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--lab-ok) 25%, transparent);
}

.led--busy {
  background: var(--warning);
  animation: blink 1s steps(2) infinite;
}

.led--fault {
  background: var(--lab-fault);
}

.led--idle {
  background: var(--lab-mute);
}

@keyframes blink {
  50% { opacity: 0.35; }
}

.status-text {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.run-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1.35rem;
  border: none;
  border-left: 1px solid var(--lab-line);
  background: var(--lab-accent);
  color: var(--text-on-accent);
  font-family: var(--lab-mono);
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.12em;
  cursor: pointer;
}

.run-btn:hover:not(:disabled) {
  background: var(--accent-hover);
}

.run-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.run-glyph {
  font-size: 0.65rem;
}

.run-spinner {
  width: 0.7rem;
  height: 0.7rem;
  border: 1.5px solid currentColor;
  border-top-color: transparent;
  animation: spin 0.7s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.tech-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  padding: 0.7rem 0.9rem;
  border: 1px solid var(--lab-line);
  background: var(--lab-panel);
  color: var(--lab-dim);
  font-family: var(--lab-mono);
  font-size: 0.75rem;
  letter-spacing: 0.04em;
  cursor: pointer;
}

.tech-btn:hover {
  color: var(--lab-ink);
  background: var(--bg-hover);
}

.tech-btn--mute {
  color: var(--lab-mute);
}

.tech-btn-key {
  color: var(--lab-mute);
  font-size: 0.625rem;
  letter-spacing: 0.1em;
}

.tech-btn-caret {
  margin-left: 0.15rem;
  transition: transform 0.12s;
  font-size: 0.65rem;
}

.tech-btn-caret.open {
  transform: rotate(180deg);
}

/* thresholds */

.thr-panel {
  border: 1px solid var(--lab-line-strong);
  border-top: none;
  background: var(--lab-well);
}

.thr-panel-head {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.55rem 0.85rem;
  border-bottom: 1px solid var(--lab-line);
  font-family: var(--lab-mono);
  font-size: 0.6875rem;
  letter-spacing: 0.08em;
  color: var(--lab-mute);
}

.thr-panel-note {
  color: var(--lab-mute);
  letter-spacing: 0.02em;
  text-transform: none;
  opacity: 0.85;
}

.thr-grid {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
}

@media (max-width: 800px) {
  .thr-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

.thr-cell {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  padding: 0.75rem 0.85rem;
  border-right: 1px solid var(--lab-line);
  border-bottom: 1px solid var(--lab-line);
  min-width: 0;
}

.thr-cell:last-child {
  border-right: none;
}

.thr-key {
  font-family: var(--lab-mono);
  font-size: 0.625rem;
  font-weight: 700;
  letter-spacing: 0.1em;
  color: var(--lab-accent);
}

.thr-label {
  font-size: 0.75rem;
  color: var(--lab-dim);
}

.thr-input {
  width: 100%;
  margin-top: 0.35rem;
  padding: 0.4rem 0.45rem;
  border: 1px solid var(--border-input);
  border-radius: 0;
  background: var(--bg-input);
  color: var(--lab-ink);
  font-family: var(--lab-mono);
  font-size: 0.875rem;
  font-variant-numeric: tabular-nums;
}

.thr-input:focus {
  outline: 1px solid var(--accent-deep);
  outline-offset: 0;
}

.thr-unit {
  font-family: var(--lab-mono);
  font-size: 0.625rem;
  color: var(--lab-mute);
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

/* ---------- results ---------- */

.results {
  margin-top: 2rem;
}

.idle {
  padding: 2.5rem 1rem;
  text-align: center;
  border: 1px solid var(--lab-line);
  background: var(--lab-well);
}

.idle-rule {
  height: 1px;
  max-width: 8rem;
  margin: 0 auto;
  background: var(--lab-line-strong);
}

.idle-code {
  margin: 1rem 0 0.5rem;
  font-family: var(--lab-mono);
  font-size: 0.75rem;
  font-weight: 600;
  letter-spacing: 0.16em;
  color: var(--lab-ink);
}

.idle-copy {
  margin: 0 auto 1rem;
  max-width: 38ch;
  font-size: 0.8125rem;
  line-height: 1.5;
  color: var(--lab-dim);
}

.fault {
  display: flex;
  gap: 0.85rem;
  padding: 0.85rem 1rem;
  border: 1px solid var(--lab-fault);
  background: var(--danger-bg, color-mix(in srgb, var(--lab-fault) 10%, var(--lab-panel)));
  color: var(--lab-fault);
  font-size: 0.875rem;
}

.fault-tag {
  font-family: var(--lab-mono);
  font-size: 0.6875rem;
  font-weight: 700;
  letter-spacing: 0.12em;
  flex-shrink: 0;
}

.fault strong {
  display: block;
  margin-bottom: 0.2rem;
}

.fault p {
  margin: 0;
  color: inherit;
}

/* meters */

.readout-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0;
  border: 1px solid var(--lab-line-strong);
}

@media (max-width: 900px) {
  .readout-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 520px) {
  .readout-grid {
    grid-template-columns: 1fr;
  }
}

.meter {
  padding: 0.85rem 0.9rem 1rem;
  border-right: 1px solid var(--lab-line);
  border-bottom: 1px solid var(--lab-line);
  background: var(--lab-panel);
  min-width: 0;
}

.meter--same {
  box-shadow: inset 3px 0 0 var(--lab-ok);
}

.meter--diff {
  box-shadow: inset 3px 0 0 var(--lab-fault);
}

.meter-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.45rem;
  font-family: var(--lab-mono);
  font-size: 0.6875rem;
  letter-spacing: 0.08em;
}

.meter-id {
  font-weight: 700;
  color: var(--lab-dim);
}

.meter-flag {
  font-weight: 700;
}

.meter--same .meter-flag {
  color: var(--lab-ok);
}

.meter--diff .meter-flag {
  color: var(--lab-fault);
}

.meter-value {
  margin: 0;
  font-family: var(--lab-mono);
  font-size: 1.35rem;
  font-weight: 600;
  letter-spacing: -0.02em;
  font-variant-numeric: tabular-nums;
}

.meter-meta {
  margin: 0.2rem 0 0.7rem;
  font-family: var(--lab-mono);
  font-size: 0.625rem;
  letter-spacing: 0.04em;
  color: var(--lab-mute);
}

.meter-track {
  position: relative;
  height: 3px;
  background: color-mix(in srgb, var(--lab-mute) 25%, transparent);
}

.meter-fill {
  height: 100%;
  background: var(--lab-ok);
  transition: width 0.3s ease;
}

.meter--diff .meter-fill {
  background: var(--lab-fault);
}

.meter-mark {
  position: absolute;
  top: -3px;
  bottom: -3px;
  width: 1px;
  background: var(--lab-ink);
  opacity: 0.55;
  transform: translateX(-50%);
}

/* blocks */

.block {
  margin-top: 1.75rem;
}

.quality-split {
  display: grid;
  grid-template-columns: 1fr 1fr;
  border: 1px solid var(--lab-line-strong);
}

@media (max-width: 640px) {
  .quality-split {
    grid-template-columns: 1fr;
  }
}

.quality-pane {
  min-width: 0;
  background: var(--lab-panel);
}

.quality-pane + .quality-pane {
  border-left: 1px solid var(--lab-line);
}

@media (max-width: 640px) {
  .quality-pane + .quality-pane {
    border-left: none;
    border-top: 1px solid var(--lab-line);
  }
}

.quality-title {
  display: flex;
  justify-content: space-between;
  padding: 0.55rem 0.85rem;
  border-bottom: 1px solid var(--lab-line);
  font-family: var(--lab-mono);
  font-size: 0.6875rem;
  font-weight: 700;
  letter-spacing: 0.1em;
  background: var(--lab-well);
}

.quality-title code {
  font-family: inherit;
  font-weight: 500;
  color: var(--lab-mute);
  letter-spacing: 0;
}

.data-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.8125rem;
}

.data-table th {
  text-align: left;
  font-weight: 400;
  color: var(--lab-dim);
  padding: 0.5rem 0.85rem;
  border-bottom: 1px solid var(--lab-line);
}

.data-table td {
  text-align: right;
  font-family: var(--lab-mono);
  font-variant-numeric: tabular-nums;
  font-weight: 600;
  padding: 0.5rem 0.85rem;
  border-bottom: 1px solid var(--lab-line);
}

.data-table tr:last-child th,
.data-table tr:last-child td {
  border-bottom: none;
}

.data-table em {
  font-style: normal;
  font-weight: 400;
  color: var(--lab-mute);
  font-size: 0.7rem;
}

.annotation {
  margin: 0.55rem 0 0;
  font-family: var(--lab-mono);
  font-size: 0.6875rem;
  color: var(--lab-mute);
  letter-spacing: 0.02em;
}

/* log tables */

.log-table {
  width: 100%;
  border-collapse: collapse;
  border: 1px solid var(--lab-line-strong);
  background: var(--lab-panel);
  font-size: 0.8125rem;
}

.log-table th,
.log-table td {
  padding: 0.6rem 0.85rem;
  border-bottom: 1px solid var(--lab-line);
  text-align: left;
  vertical-align: top;
}

.log-table thead th {
  font-family: var(--lab-mono);
  font-size: 0.625rem;
  font-weight: 600;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--lab-mute);
  background: var(--lab-well);
}

.log-table tbody tr:last-child th,
.log-table tbody tr:last-child td {
  border-bottom: none;
}

.log-table code {
  font-family: var(--lab-mono);
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  color: var(--lab-dim);
}

.log-table .num {
  font-family: var(--lab-mono);
  font-variant-numeric: tabular-nums;
  font-weight: 600;
  white-space: nowrap;
}

.log-table .num.is-same {
  color: var(--lab-ok);
}

.log-table .num.is-diff {
  color: var(--lab-fault);
}

.log-table--dense th {
  font-weight: 400;
  color: var(--lab-dim);
  width: 50%;
}

.log-table--dense td {
  text-align: right;
}

.flag {
  font-family: var(--lab-mono);
  font-size: 0.625rem;
  font-weight: 700;
  letter-spacing: 0.1em;
}

.flag--same {
  color: var(--lab-ok);
}

.flag--diff {
  color: var(--lab-fault);
}

/* pHash */

.phash-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0;
  border: 1px solid var(--lab-line-strong);
}

@media (max-width: 900px) {
  .phash-grid {
    grid-template-columns: 1fr;
  }
}

.phash-panel {
  padding: 0.85rem;
  border-right: 1px solid var(--lab-line);
  background: var(--lab-panel);
  min-width: 0;
}

.phash-panel:last-child {
  border-right: none;
}

@media (max-width: 900px) {
  .phash-panel {
    border-right: none;
    border-bottom: 1px solid var(--lab-line);
  }
  .phash-panel:last-child {
    border-bottom: none;
  }
}

.phash-panel--same {
  box-shadow: inset 3px 0 0 var(--lab-ok);
}

.phash-panel--diff {
  box-shadow: inset 3px 0 0 var(--lab-fault);
}

.phash-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.4rem;
}

.phash-top code {
  font-family: var(--lab-mono);
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.08em;
}

.phash-dist {
  margin: 0 0 0.75rem;
  font-family: var(--lab-mono);
  font-size: 0.8125rem;
  color: var(--lab-dim);
}

.phash-dist strong {
  color: var(--lab-ink);
  font-size: 1.15rem;
}

.phash-thr {
  color: var(--lab-mute);
}

.hash-line {
  display: grid;
  grid-template-columns: 1rem 1fr;
  gap: 0.4rem;
  margin-top: 0.35rem;
  font-family: var(--lab-mono);
  font-size: 0.625rem;
  color: var(--lab-mute);
}

.hash-line code {
  display: block;
  padding: 0.35rem 0.4rem;
  background: var(--lab-well);
  border: 1px solid var(--lab-line);
  color: var(--lab-ink);
  word-break: break-all;
  line-height: 1.4;
  font-size: 0.625rem;
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  border: 0;
}

@media (prefers-reduced-motion: reduce) {
  .led--busy,
  .run-spinner,
  .meter-fill,
  .tech-btn-caret {
    animation: none;
    transition: none;
  }
}
</style>
