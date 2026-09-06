<template>
  <div class="hw-demo" aria-hidden="true">
    <div class="hw-hero">
      <span class="hw-hero-in">{{ $t('home.featureTitleIn') }}</span>
      <span class="hw-hero-out">{{ $t('home.featureTitleOut') }}</span>
    </div>

    <svg class="hw-art" viewBox="0 0 720 404" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <!--
          Six slide layouts. Drawn once, reused at player size and thumb size
          via <use>; colors come through custom properties because scoped
          classes do not reach into <use> shadow trees.
        -->
        <symbol id="hwSlide0" viewBox="0 0 160 90">
          <rect x="14" y="14" width="66" height="8" rx="2" fill="var(--sl-ink)" />
          <rect x="14" y="36" width="104" height="5" rx="2.5" fill="var(--sl-line)" />
          <rect x="14" y="50" width="86" height="5" rx="2.5" fill="var(--sl-line)" />
          <rect x="14" y="64" width="96" height="5" rx="2.5" fill="var(--sl-line)" />
        </symbol>
        <symbol id="hwSlide1" viewBox="0 0 160 90">
          <rect x="14" y="14" width="52" height="8" rx="2" fill="var(--sl-ink)" />
          <rect x="14" y="36" width="58" height="5" rx="2.5" fill="var(--sl-line)" />
          <rect x="14" y="50" width="46" height="5" rx="2.5" fill="var(--sl-line)" />
          <rect x="14" y="64" width="54" height="5" rx="2.5" fill="var(--sl-line)" />
          <rect x="88" y="32" width="58" height="42" rx="3" fill="var(--sl-tint)" />
        </symbol>
        <symbol id="hwSlide2" viewBox="0 0 160 90">
          <rect x="14" y="14" width="74" height="8" rx="2" fill="var(--sl-ink)" />
          <rect x="24" y="36" width="12" height="38" rx="1.5" fill="var(--sl-tint)" />
          <rect x="46" y="48" width="12" height="26" rx="1.5" fill="var(--sl-tint)" />
          <rect x="68" y="30" width="12" height="44" rx="1.5" fill="var(--sl-accent)" />
          <rect x="90" y="54" width="12" height="20" rx="1.5" fill="var(--sl-tint)" />
          <rect x="112" y="42" width="12" height="32" rx="1.5" fill="var(--sl-tint)" />
          <rect x="18" y="75" width="114" height="1.5" fill="var(--sl-line)" />
        </symbol>
        <symbol id="hwSlide3" viewBox="0 0 160 90">
          <rect x="14" y="14" width="60" height="8" rx="2" fill="var(--sl-ink)" />
          <rect x="14" y="34" width="54" height="32" rx="3" fill="var(--sl-ink)" />
          <rect x="82" y="40" width="62" height="5" rx="2.5" fill="var(--sl-line)" />
          <rect x="82" y="54" width="48" height="5" rx="2.5" fill="var(--sl-line)" />
        </symbol>
        <symbol id="hwSlide4" viewBox="0 0 160 90">
          <rect x="14" y="14" width="44" height="8" rx="2" fill="var(--sl-ink)" />
          <rect x="14" y="32" width="62" height="20" rx="3" fill="var(--sl-tint)" />
          <rect x="84" y="32" width="62" height="20" rx="3" fill="var(--sl-tint)" />
          <rect x="14" y="58" width="62" height="20" rx="3" fill="var(--sl-tint)" />
          <rect x="84" y="58" width="62" height="20" rx="3" fill="var(--sl-accent)" />
        </symbol>
        <symbol id="hwSlide5" viewBox="0 0 160 90">
          <rect x="44" y="36" width="72" height="9" rx="2" fill="var(--sl-ink)" />
          <rect x="58" y="54" width="44" height="4" rx="2" fill="var(--sl-line)" />
        </symbol>

        <clipPath id="hwPlayerClip">
          <rect x="144" y="8" width="432" height="243" rx="6" />
        </clipPath>
      </defs>

      <!-- Player: screen recording fills the pane, camera view sits in the corner. -->
      <g class="hw-player">
        <rect class="hw-pane" x="144" y="8" width="432" height="243" rx="6" />
        <g clip-path="url(#hwPlayerClip)">
          <use v-for="k in 6" :key="'ps' + k" :href="'#hwSlide' + (k - 1)" class="hw-ps" :class="'hw-ps-' + (k - 1)" x="144" y="8" width="432" height="243" />
          <circle class="hw-dot" cx="356" cy="86" r="3.5" />
          <g class="hw-cam">
            <rect class="hw-cam-room" x="458" y="176" width="108" height="64" rx="4" />
            <ellipse class="hw-cam-body" cx="512" cy="248" rx="22" ry="14" />
            <circle class="hw-cam-head" cx="512" cy="222" r="9" />
            <rect class="hw-cam-frame" x="458" y="176" width="108" height="64" rx="4" />
          </g>
        </g>
        <rect class="hw-pane-edge" x="144" y="8" width="432" height="243" rx="6" />
      </g>

      <!-- Scrubber: time ruler, slide segments, change ticks, playhead. -->
      <g class="hw-ruler">
        <line class="hw-ruler-line" x1="40" y1="276" x2="680" y2="276" />
        <text class="hw-time" x="40" y="292">0:00</text>
        <text class="hw-time" x="680" y="292" text-anchor="end">1:28:40</text>
      </g>
      <g class="hw-segs">
        <rect
          v-for="(seg, k) in SEGMENTS"
          :key="'seg' + k"
          class="hw-seg"
          :class="'hw-seg-' + k"
          :x="seg.x + 1"
          y="274"
          :width="seg.w - 2"
          height="4"
          rx="1"
        />
      </g>
      <g class="hw-ticks">
        <line
          v-for="(c, i) in CAPTURES"
          :key="'tick' + i"
          class="hw-tick"
          :class="'hw-tick-' + i"
          :x1="c.x"
          y1="270"
          :x2="c.x"
          y2="282"
        />
      </g>
      <g class="hw-playhead">
        <line x1="40" y1="266" x2="40" y2="286" />
        <circle cx="40" cy="266" r="3.5" />
      </g>

      <!-- Similarity trace: flat while the slide holds, a dip at every change. -->
      <line class="hw-threshold" x1="40" y1="322" x2="680" y2="322" />
      <path class="hw-trace" :d="TRACE_PATH" />

      <!-- Captured slides. The fourth is a near-duplicate and gets dropped. -->
      <g class="hw-thumbs">
        <g
          v-for="(c, i) in CAPTURES"
          :key="'th' + i"
          class="hw-th"
          :class="'hw-th-' + i"
          :style="{ '--dx': c.dx + 'px', '--dy': c.dy + 'px' }"
        >
          <rect class="hw-th-paper" :x="c.slotX" y="352" width="80" height="45" rx="3" />
          <use :href="'#hwSlide' + c.slide" :x="c.slotX" y="352" width="80" height="45" />
          <rect class="hw-th-edge" :x="c.slotX" y="352" width="80" height="45" rx="3" />
          <rect class="hw-ring" :class="'hw-ring-' + i" :x="c.slotX - 3" y="349" width="86" height="51" rx="5" />
        </g>
      </g>
    </svg>

    <div class="hw-caps">
      <p class="hw-cap hw-cap--watch">{{ $t('home.intro.watch') }}</p>
      <p class="hw-cap hw-cap--detect">{{ $t('home.intro.detect') }}</p>
      <p class="hw-cap hw-cap--dedupe">{{ $t('home.intro.dedupe') }}</p>
      <p class="hw-cap hw-cap--seek">{{ $t('home.intro.seek') }}</p>
      <p class="hw-cap hw-cap--export">{{ $t('home.intro.export') }}</p>
      <p class="hw-cap hw-cap--credit">{{ $t('home.intro.credit') }}</p>
    </div>

    <div class="hw-brand">
      <span class="hw-brand-yanhekt">
        <span class="hw-brand-clip hw-brand-clip--icon"><img :src="yanhektLogoUrl" alt="" /></span>
        <span class="hw-brand-clip hw-brand-clip--word"><img :src="yanhektLogoUrl" alt="" /></span>
      </span>
      <span class="hw-brand-x">×</span>
      <span class="hw-brand-bit">
        <img class="hw-brand-bit-mark" :src="bitLogoUrl" alt="" />
        <img class="hw-brand-bit-text" :src="bitLogoTextUrl" alt="" />
      </span>
      <span class="hw-brand-x">×</span>
      <span class="hw-brand-app">
        <img class="hw-brand-app-icon" :src="autoslidesIconUrl" alt="" />
        <span class="hw-brand-app-name">AutoSlides</span>
      </span>
    </div>
  </div>
</template>

<script setup lang="ts">
import autoslidesIconUrl from '../../assets/autoslides-icon.png'
import bitLogoUrl from '../../assets/bit-logo.svg?url'
import bitLogoTextUrl from '../../assets/bit-logo-text.svg?url'
import yanhektLogoUrl from '../../assets/yanhekt-logo.svg?url'

/**
 * One 16.6s take on a single clock (`--hw-dur`), no loop:
 *   0.0  lecture player fades in, "Lecture video in."
 *   1.5  playback: the playhead crosses the ruler while the similarity trace
 *        draws underneath; each dip lifts the current frame into the strip
 *   8.9  post-processing drops the near-duplicate (thumb 3) and closes the gap
 *  10.0  "Slides out." — the ruler becomes a slide timeline (segments)
 *  10.8  three clicks on the strip seek the player
 *  13.5  export beat, then the student credit with the partner marks at 15.9
 * Every element is a `both`-filled keyframe on that clock, so the freeze class
 * used by the screenshot script and reduced-motion just jump to the last frame.
 */

/** Ruler geometry (SVG units). */
const RULER_X = 40
const RULER_W = 640

/** Capture moments as a fraction of the lecture; index 3 is the duplicate. */
const CAPTURE_FRACTIONS = [0, 0.18, 0.34, 0.46, 0.58, 0.74, 0.88] as const
const CAPTURE_SLIDES = [0, 1, 2, 2, 3, 4, 5] as const

const SLOT_X0 = 56
const SLOT_STEP = 88
const PLAYER_CX = 360
const PLAYER_CY = 129.5
const THUMB_CY = 374.5

const CAPTURES = CAPTURE_FRACTIONS.map((f, i) => {
  const slotX = SLOT_X0 + i * SLOT_STEP
  return {
    x: RULER_X + RULER_W * f,
    slide: CAPTURE_SLIDES[i],
    slotX,
    dx: PLAYER_CX - (slotX + 40),
    dy: PLAYER_CY - THUMB_CY,
  }
})

/** Slide spans once the duplicate has been relinked to its first capture. */
const SEGMENT_BOUNDS = [0, 0.18, 0.34, 0.58, 0.74, 0.88, 1] as const
const SEGMENTS = SEGMENT_BOUNDS.slice(0, -1).map((b, k) => ({
  x: RULER_X + RULER_W * b,
  w: RULER_W * (SEGMENT_BOUNDS[k + 1] - b),
}))

/**
 * SSIM-style trace: near 1.0 (top of the band) with a little noise, a sharp
 * V at every capture. Deterministic so the drawing is stable across mounts.
 */
const TRACE_PATH = (() => {
  const top = 302
  const bottom = 334
  const step = 4
  const points: string[] = []
  for (let x = RULER_X; x <= RULER_X + RULER_W; x += step) {
    const f = (x - RULER_X) / RULER_W
    const noise = Math.sin(x * 0.61) * 0.9 + Math.sin(x * 0.173) * 0.6
    let dip = 0
    for (const c of CAPTURE_FRACTIONS) {
      if (c === 0) continue
      const d = Math.abs(f - c) * RULER_W
      if (d < 7) dip = Math.max(dip, 1 - d / 7)
    }
    const y = top + noise + dip * (bottom - top)
    points.push(`${x === RULER_X ? 'M' : 'L'}${x} ${y.toFixed(1)}`)
  }
  return points.join(' ')
})()
</script>

<style scoped>
.hw-demo {
  --hw-dur: 16.6s;
  --hw-accent: var(--illustration-accent);
  --sl-ink: var(--text-primary);
  --sl-line: var(--border-strong);
  --sl-accent: var(--hw-accent);
  --sl-tint: color-mix(in srgb, var(--hw-accent) 22%, transparent);
  position: relative;
  width: min(600px, 94%);
  margin: 0 auto;
  flex: 0 0 auto;
}

.hw-hero {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  column-gap: 0.35em;
  margin-bottom: 14px;
  font-size: clamp(22px, 3.6vw, 30px);
  font-weight: 600;
  letter-spacing: -0.015em;
  line-height: 1.2;
  color: var(--text-primary);
}

.hw-hero-in {
  animation: hw-hero-in var(--hw-dur) linear both;
}

.hw-hero-out {
  animation: hw-hero-out var(--hw-dur) linear both;
}

.hw-art {
  display: block;
  width: 100%;
  height: auto;
  overflow: visible;
}

/* ---- player ---- */

.hw-player {
  transform-box: fill-box;
  transform-origin: center;
  filter: drop-shadow(0 2px 6px var(--shadow-sm));
  animation: hw-player var(--hw-dur) linear both;
}

.hw-pane {
  fill: var(--bg-surface);
}

.hw-pane-edge {
  fill: none;
  stroke: var(--border-color);
  stroke-width: 1;
}

.hw-ps {
  opacity: 0;
}

.hw-ps-0 { animation: hw-ps-0 var(--hw-dur) linear both; }
.hw-ps-1 { animation: hw-ps-1 var(--hw-dur) linear both; }
.hw-ps-2 { animation: hw-ps-2 var(--hw-dur) linear both; }
.hw-ps-3 { animation: hw-ps-3 var(--hw-dur) linear both; }
.hw-ps-4 { animation: hw-ps-4 var(--hw-dur) linear both; }
.hw-ps-5 { animation: hw-ps-5 var(--hw-dur) linear both; }

.hw-dot {
  fill: var(--danger);
  opacity: 0;
  animation: hw-dot var(--hw-dur) linear both;
}

.hw-cam-room {
  fill: var(--bg-elevated);
}

.hw-cam-frame {
  fill: none;
  stroke: var(--border-color);
  stroke-width: 1;
}

.hw-cam-head,
.hw-cam-body {
  fill: var(--border-strong);
}

/* ---- ruler ---- */

.hw-ruler {
  animation: hw-fade-ruler var(--hw-dur) linear both;
}

.hw-ruler-line {
  stroke: var(--border-strong);
  stroke-width: 1;
}

.hw-time {
  font-size: 10px;
  font-variant-numeric: tabular-nums;
  fill: var(--text-muted);
}

.hw-seg {
  opacity: 0;
}

.hw-seg-0 { animation: hw-seg-0 var(--hw-dur) linear both; }
.hw-seg-1 { animation: hw-seg-1 var(--hw-dur) linear both; }
.hw-seg-2 { animation: hw-seg-2 var(--hw-dur) linear both; }
.hw-seg-3 { animation: hw-seg-3 var(--hw-dur) linear both; }
.hw-seg-4 { animation: hw-seg-4 var(--hw-dur) linear both; }
.hw-seg-5 { animation: hw-seg-5 var(--hw-dur) linear both; }

.hw-tick {
  stroke: var(--hw-accent);
  stroke-width: 1.5;
  transform-box: fill-box;
  transform-origin: center;
  opacity: 0;
}

.hw-tick-0 { animation: hw-tick-0 var(--hw-dur) linear both; }
.hw-tick-1 { animation: hw-tick-1 var(--hw-dur) linear both; }
.hw-tick-2 { animation: hw-tick-2 var(--hw-dur) linear both; }
.hw-tick-3 { animation: hw-tick-3 var(--hw-dur) linear both; }
.hw-tick-4 { animation: hw-tick-4 var(--hw-dur) linear both; }
.hw-tick-5 { animation: hw-tick-5 var(--hw-dur) linear both; }
.hw-tick-6 { animation: hw-tick-6 var(--hw-dur) linear both; }

.hw-playhead {
  opacity: 0;
  animation: hw-playhead var(--hw-dur) linear both;
}

.hw-playhead line {
  stroke: var(--text-primary);
  stroke-width: 1.5;
}

.hw-playhead circle {
  fill: var(--text-primary);
}

/* ---- trace ---- */

.hw-threshold {
  stroke: var(--border-color);
  stroke-width: 1;
  stroke-dasharray: 3 4;
  opacity: 0;
  animation: hw-threshold var(--hw-dur) linear both;
}

.hw-trace {
  fill: none;
  stroke: var(--hw-accent);
  stroke-width: 1.25;
  stroke-linejoin: round;
  clip-path: inset(0 100% 0 0);
  animation: hw-trace-reveal var(--hw-dur) linear both;
}

/* ---- strip ---- */

.hw-thumbs {
  animation: hw-thumbs var(--hw-dur) linear both;
}

.hw-th {
  transform-box: fill-box;
  transform-origin: center;
  filter: drop-shadow(0 1px 3px var(--shadow-sm));
  opacity: 0;
}

.hw-th-0 { animation: hw-th-0 var(--hw-dur) linear both; }
.hw-th-1 { animation: hw-th-1 var(--hw-dur) linear both; }
.hw-th-2 { animation: hw-th-2 var(--hw-dur) linear both; }
.hw-th-3 { animation: hw-th-3 var(--hw-dur) linear both; }
.hw-th-4 { animation: hw-th-4 var(--hw-dur) linear both; }
.hw-th-5 { animation: hw-th-5 var(--hw-dur) linear both; }
.hw-th-6 { animation: hw-th-6 var(--hw-dur) linear both; }

.hw-th-paper {
  fill: var(--bg-surface);
}

.hw-th-edge {
  fill: none;
  stroke: var(--border-color);
  stroke-width: 1;
  vector-effect: non-scaling-stroke;
}

.hw-ring {
  fill: none;
  stroke: var(--hw-accent);
  stroke-width: 1.5;
  vector-effect: non-scaling-stroke;
  opacity: 0;
}

.hw-ring-0 { animation: hw-ring-0 var(--hw-dur) linear both; }
.hw-ring-1 { animation: hw-ring-1 var(--hw-dur) linear both; }
.hw-ring-2 { animation: hw-ring-2 var(--hw-dur) linear both; }
.hw-ring-3 { animation: hw-ring-3 var(--hw-dur) linear both; }
.hw-ring-4 { animation: hw-ring-4 var(--hw-dur) linear both; }
.hw-ring-5 { animation: hw-ring-5 var(--hw-dur) linear both; }
.hw-ring-6 { animation: hw-ring-6 var(--hw-dur) linear both; }

/* ---- captions ---- */

.hw-caps {
  position: relative;
  height: 2.9em;
  margin-top: 10px;
  font-size: 13px;
  line-height: 1.45;
  color: var(--text-secondary);
}

.hw-cap {
  position: absolute;
  inset: 0;
  margin: 0;
  text-align: center;
  opacity: 0;
}

.hw-cap--watch { animation: hw-cap-watch var(--hw-dur) linear both; }
.hw-cap--detect { animation: hw-cap-detect var(--hw-dur) linear both; }
.hw-cap--dedupe { animation: hw-cap-dedupe var(--hw-dur) linear both; }
.hw-cap--seek { animation: hw-cap-seek var(--hw-dur) linear both; }
.hw-cap--export { animation: hw-cap-export var(--hw-dur) linear both; }
.hw-cap--credit { animation: hw-cap-credit var(--hw-dur) linear both; }

/* ---- partner marks ---- */

.hw-brand {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: 8px 10px;
  margin-top: 14px;
  opacity: 0;
  animation: hw-brand var(--hw-dur) linear both;
}

.hw-brand-x {
  color: var(--text-muted);
  font-size: 15px;
  line-height: 1;
}

.hw-brand-yanhekt {
  display: flex;
  align-items: stretch;
  height: 24px;
}

.hw-brand-clip {
  display: block;
  height: 24px;
  overflow: hidden;
}

.hw-brand-clip img {
  display: block;
  height: 24px;
  width: auto;
  max-width: none;
}

.hw-brand-clip--icon {
  width: calc(24px * 54 / 40);
}

.hw-brand-clip--word {
  width: calc(24px * 95 / 40);
}

.hw-brand-clip--word img {
  filter: var(--logo-clip-filter);
  margin-left: calc(-24px * 54 / 40);
}

.hw-brand-bit {
  display: flex;
  align-items: center;
  gap: 6px;
}

.hw-brand-bit-mark {
  display: block;
  height: 28px;
  width: auto;
}

.hw-brand-bit-text {
  display: block;
  height: 21px;
  width: auto;
  filter: var(--logo-mono-filter);
}

.hw-brand-app {
  display: flex;
  align-items: center;
  gap: 7px;
}

.hw-brand-app-icon {
  display: block;
  width: 28px;
  height: 28px;
  object-fit: contain;
}

.hw-brand-app-name {
  font-family: ui-serif, 'Iowan Old Style', Palatino, Georgia, serif;
  font-size: 17px;
  font-weight: 600;
  letter-spacing: -0.02em;
  color: var(--text-primary);
}

/*
 * Jump to the last frame: every animation fills `both`, so a delay larger
 * than the whole take lands on its final keyframe. Used by the screenshot
 * script (`.hw-demo--final`) and for reduced motion.
 */
.hw-demo--final *,
.hw-demo--final .hw-hero-in,
.hw-demo--final .hw-hero-out {
  animation-delay: -100s !important;
}

@media (prefers-reduced-motion: reduce) {
  .hw-demo *,
  .hw-demo .hw-hero-in,
  .hw-demo .hw-hero-out {
    animation-delay: -100s !important;
  }
}

/* ---- timeline (generated: one master clock, percentages are seconds / 16.6) ---- */

@keyframes hw-player {
  0.00% { opacity: 0; transform: translateY(10px) }
  4.22% { opacity: 1; transform: none }
}

@keyframes hw-hero-in {
  1.20% { opacity: 0; transform: translateY(6px) }
  5.42% { opacity: 1; transform: none }
}

@keyframes hw-hero-out {
  0.00% { opacity: 0; transform: translateY(6px) }
  60.24% { opacity: 0; transform: translateY(6px) }
  63.86% { opacity: 1; transform: none }
}

@keyframes hw-fade-ruler {
  0.00% { opacity: 0 }
  6.02% { opacity: 0 }
  8.43% { opacity: 1 }
}

@keyframes hw-trace-reveal {
  0.00% { clip-path: inset(0 100% 0 0); opacity: 1 }
  9.04% { clip-path: inset(0 100% 0 0); opacity: 1 }
  51.20% { clip-path: inset(0 0 0 0); opacity: 1 }
  60.24% { clip-path: inset(0 0 0 0); opacity: 1 }
  63.25% { clip-path: inset(0 0 0 0); opacity: 0.55 }
  100.00% { clip-path: inset(0 0 0 0); opacity: 0.55 }
}

@keyframes hw-threshold {
  0.00% { opacity: 0 }
  6.02% { opacity: 0 }
  8.43% { opacity: 1 }
  60.24% { opacity: 1 }
  63.25% { opacity: 0.55 }
  100.00% { opacity: 0.55 }
}

@keyframes hw-playhead {
  0.00% { opacity: 0; transform: translateX(0) }
  7.83% { opacity: 0; transform: translateX(0) }
  9.04% { opacity: 1; transform: translateX(0) }
  51.20% { opacity: 1; transform: translateX(640px) }
  65.06% { opacity: 1; transform: translateX(640px) }
  66.57% { opacity: 1; transform: translateX(371.2px) }
  71.08% { opacity: 1; transform: translateX(371.2px) }
  72.59% { opacity: 1; transform: translateX(115.2px) }
  77.11% { opacity: 1; transform: translateX(115.19999999999999px) }
  78.61% { opacity: 1; transform: translateX(473.6px) }
  100.00% { opacity: 1; transform: translateX(473.6px) }
}

@keyframes hw-ps-0 {
  0.00% { opacity: 0 }
  0.00% { opacity: 0 }
  0.00% { opacity: 1 }
  16.63% { opacity: 1 }
  16.69% { opacity: 0 }
}

@keyframes hw-ps-1 {
  0.00% { opacity: 0 }
  16.57% { opacity: 0 }
  16.63% { opacity: 1 }
  23.37% { opacity: 1 }
  23.43% { opacity: 0 }
  71.02% { opacity: 0 }
  71.08% { opacity: 1 }
  77.11% { opacity: 1 }
  77.17% { opacity: 0 }
}

@keyframes hw-ps-2 {
  0.00% { opacity: 0 }
  23.31% { opacity: 0 }
  23.37% { opacity: 1 }
  28.37% { opacity: 0 }
  28.43% { opacity: 1 }
  28.43% { opacity: 1 }
  28.49% { opacity: 0 }
  33.49% { opacity: 1 }
  33.55% { opacity: 0 }
}

@keyframes hw-ps-3 {
  0.00% { opacity: 0 }
  33.43% { opacity: 0 }
  33.49% { opacity: 1 }
  40.24% { opacity: 1 }
  40.30% { opacity: 0 }
  65.00% { opacity: 0 }
  65.06% { opacity: 1 }
  71.08% { opacity: 1 }
  71.14% { opacity: 0 }
}

@keyframes hw-ps-4 {
  0.00% { opacity: 0 }
  40.18% { opacity: 0 }
  40.24% { opacity: 1 }
  46.14% { opacity: 1 }
  46.20% { opacity: 0 }
  77.05% { opacity: 0 }
  77.11% { opacity: 1 }
  100.00% { opacity: 1 }
}

@keyframes hw-ps-5 {
  0.00% { opacity: 0 }
  46.08% { opacity: 0 }
  46.14% { opacity: 1 }
  65.06% { opacity: 1 }
  65.12% { opacity: 0 }
}

@keyframes hw-dot {
  0.00% { opacity: 0 }
  28.37% { opacity: 0 }
  28.43% { opacity: 1 }
  33.49% { opacity: 1 }
  33.55% { opacity: 0 }
}

@keyframes hw-th-0 {
  0.00% { opacity: 0; transform: translate(var(--dx), var(--dy)) scale(5.4) }
  10.24% { opacity: 0; transform: translate(var(--dx), var(--dy)) scale(5.4); animation-timing-function: cubic-bezier(0.2, 0.8, 0.2, 1) }
  10.96% { opacity: 1 }
  13.86% { opacity: 1; transform: none }
  56.02% { opacity: 1; transform: none; animation-timing-function: cubic-bezier(0.4, 0, 0.2, 1) }
  59.04% { opacity: 1; transform: translateX(0px) }
  100.00% { opacity: 1; transform: translateX(0px) }
}

@keyframes hw-th-1 {
  0.00% { opacity: 0; transform: translate(var(--dx), var(--dy)) scale(5.4) }
  16.63% { opacity: 0; transform: translate(var(--dx), var(--dy)) scale(5.4); animation-timing-function: cubic-bezier(0.2, 0.8, 0.2, 1) }
  17.35% { opacity: 1 }
  20.24% { opacity: 1; transform: none }
  56.02% { opacity: 1; transform: none; animation-timing-function: cubic-bezier(0.4, 0, 0.2, 1) }
  59.04% { opacity: 1; transform: translateX(0px) }
  70.48% { transform: translateX(0px) }
  71.08% { transform: translateX(0px) scale(0.92) }
  72.29% { transform: translateX(0px) }
  100.00% { opacity: 1; transform: translateX(0px) }
}

@keyframes hw-th-2 {
  0.00% { opacity: 0; transform: translate(var(--dx), var(--dy)) scale(5.4) }
  23.37% { opacity: 0; transform: translate(var(--dx), var(--dy)) scale(5.4); animation-timing-function: cubic-bezier(0.2, 0.8, 0.2, 1) }
  24.10% { opacity: 1 }
  26.99% { opacity: 1; transform: none }
  56.02% { opacity: 1; transform: none; animation-timing-function: cubic-bezier(0.4, 0, 0.2, 1) }
  59.04% { opacity: 1; transform: translateX(0px) }
  100.00% { opacity: 1; transform: translateX(0px) }
}

@keyframes hw-th-3 {
  0.00% { opacity: 0; transform: translate(var(--dx), var(--dy)) scale(5.4) }
  28.43% { opacity: 0; transform: translate(var(--dx), var(--dy)) scale(5.4); animation-timing-function: cubic-bezier(0.2, 0.8, 0.2, 1) }
  29.16% { opacity: 1 }
  32.05% { opacity: 1; transform: none }
  53.61% { opacity: 1; transform: none }
  55.42% { opacity: 0.3; transform: none }
  56.02% { opacity: 0.3; transform: none; animation-timing-function: ease-in }
  58.73% { opacity: 0; transform: scale(0.2) }
}

@keyframes hw-th-4 {
  0.00% { opacity: 0; transform: translate(var(--dx), var(--dy)) scale(5.4) }
  33.49% { opacity: 0; transform: translate(var(--dx), var(--dy)) scale(5.4); animation-timing-function: cubic-bezier(0.2, 0.8, 0.2, 1) }
  34.22% { opacity: 1 }
  37.11% { opacity: 1; transform: none }
  56.02% { opacity: 1; transform: none; animation-timing-function: cubic-bezier(0.4, 0, 0.2, 1) }
  59.04% { opacity: 1; transform: translateX(-88px) }
  64.46% { transform: translateX(-88px) }
  65.06% { transform: translateX(-88px) scale(0.92) }
  66.27% { transform: translateX(-88px) }
  100.00% { opacity: 1; transform: translateX(-88px) }
}

@keyframes hw-th-5 {
  0.00% { opacity: 0; transform: translate(var(--dx), var(--dy)) scale(5.4) }
  40.24% { opacity: 0; transform: translate(var(--dx), var(--dy)) scale(5.4); animation-timing-function: cubic-bezier(0.2, 0.8, 0.2, 1) }
  40.96% { opacity: 1 }
  43.86% { opacity: 1; transform: none }
  56.02% { opacity: 1; transform: none; animation-timing-function: cubic-bezier(0.4, 0, 0.2, 1) }
  59.04% { opacity: 1; transform: translateX(-88px) }
  76.51% { transform: translateX(-88px) }
  77.11% { transform: translateX(-88px) scale(0.92) }
  78.31% { transform: translateX(-88px) }
  100.00% { opacity: 1; transform: translateX(-88px) }
}

@keyframes hw-th-6 {
  0.00% { opacity: 0; transform: translate(var(--dx), var(--dy)) scale(5.4) }
  46.14% { opacity: 0; transform: translate(var(--dx), var(--dy)) scale(5.4); animation-timing-function: cubic-bezier(0.2, 0.8, 0.2, 1) }
  46.87% { opacity: 1 }
  49.76% { opacity: 1; transform: none }
  56.02% { opacity: 1; transform: none; animation-timing-function: cubic-bezier(0.4, 0, 0.2, 1) }
  59.04% { opacity: 1; transform: translateX(-88px) }
  100.00% { opacity: 1; transform: translateX(-88px) }
}

@keyframes hw-thumbs {
  56.02% { transform: none; animation-timing-function: cubic-bezier(0.4, 0, 0.2, 1) }
  59.04% { transform: translateX(44px) }
  100.00% { transform: translateX(44px) }
}

@keyframes hw-ring-0 {
  0.00% { opacity: 0 }
  10.18% { opacity: 0 }
  10.24% { opacity: 1 }
  16.63% { opacity: 1 }
  16.69% { opacity: 0 }
}

@keyframes hw-ring-1 {
  0.00% { opacity: 0 }
  16.57% { opacity: 0 }
  16.63% { opacity: 1 }
  23.37% { opacity: 1 }
  23.43% { opacity: 0 }
  71.02% { opacity: 0 }
  71.08% { opacity: 1 }
  77.11% { opacity: 1 }
  77.17% { opacity: 0 }
}

@keyframes hw-ring-2 {
  0.00% { opacity: 0 }
  23.31% { opacity: 0 }
  23.37% { opacity: 1 }
  28.43% { opacity: 1 }
  28.49% { opacity: 0 }
}

@keyframes hw-ring-3 {
  0.00% { opacity: 0 }
  28.37% { opacity: 0 }
  28.43% { opacity: 1 }
  33.49% { opacity: 1 }
  33.55% { opacity: 0 }
}

@keyframes hw-ring-4 {
  0.00% { opacity: 0 }
  33.43% { opacity: 0 }
  33.49% { opacity: 1 }
  40.24% { opacity: 1 }
  40.30% { opacity: 0 }
  65.00% { opacity: 0 }
  65.06% { opacity: 1 }
  71.08% { opacity: 1 }
  71.14% { opacity: 0 }
}

@keyframes hw-ring-5 {
  0.00% { opacity: 0 }
  40.18% { opacity: 0 }
  40.24% { opacity: 1 }
  46.14% { opacity: 1 }
  46.20% { opacity: 0 }
  77.05% { opacity: 0 }
  77.11% { opacity: 1 }
  100.00% { opacity: 1 }
}

@keyframes hw-ring-6 {
  0.00% { opacity: 0 }
  46.08% { opacity: 0 }
  46.14% { opacity: 1 }
  65.06% { opacity: 1 }
  65.12% { opacity: 0 }
}

@keyframes hw-tick-0 {
  0.00% { opacity: 0; transform: scaleY(0) }
  10.18% { opacity: 0; transform: scaleY(0) }
  10.54% { opacity: 1; transform: scaleY(1.6) }
  12.65% { opacity: 1; transform: scaleY(1) }
  100.00% { opacity: 1; transform: scaleY(1) }
}

@keyframes hw-tick-1 {
  0.00% { opacity: 0; transform: scaleY(0) }
  16.57% { opacity: 0; transform: scaleY(0) }
  16.93% { opacity: 1; transform: scaleY(1.6) }
  19.04% { opacity: 1; transform: scaleY(1) }
  100.00% { opacity: 1; transform: scaleY(1) }
}

@keyframes hw-tick-2 {
  0.00% { opacity: 0; transform: scaleY(0) }
  23.31% { opacity: 0; transform: scaleY(0) }
  23.67% { opacity: 1; transform: scaleY(1.6) }
  25.78% { opacity: 1; transform: scaleY(1) }
  100.00% { opacity: 1; transform: scaleY(1) }
}

@keyframes hw-tick-3 {
  0.00% { opacity: 0; transform: scaleY(0) }
  28.37% { opacity: 0; transform: scaleY(0) }
  28.73% { opacity: 1; transform: scaleY(1.6) }
  30.84% { opacity: 1; transform: scaleY(1) }
  53.61% { opacity: 1 }
  56.02% { opacity: 0 }
}

@keyframes hw-tick-4 {
  0.00% { opacity: 0; transform: scaleY(0) }
  33.43% { opacity: 0; transform: scaleY(0) }
  33.80% { opacity: 1; transform: scaleY(1.6) }
  35.90% { opacity: 1; transform: scaleY(1) }
  100.00% { opacity: 1; transform: scaleY(1) }
}

@keyframes hw-tick-5 {
  0.00% { opacity: 0; transform: scaleY(0) }
  40.18% { opacity: 0; transform: scaleY(0) }
  40.54% { opacity: 1; transform: scaleY(1.6) }
  42.65% { opacity: 1; transform: scaleY(1) }
  100.00% { opacity: 1; transform: scaleY(1) }
}

@keyframes hw-tick-6 {
  0.00% { opacity: 0; transform: scaleY(0) }
  46.08% { opacity: 0; transform: scaleY(0) }
  46.45% { opacity: 1; transform: scaleY(1.6) }
  48.55% { opacity: 1; transform: scaleY(1) }
  100.00% { opacity: 1; transform: scaleY(1) }
}

@keyframes hw-seg-0 {
  0.00% { opacity: 0; fill: var(--border-strong) }
  60.24% { opacity: 0; fill: var(--border-strong) }
  62.05% { opacity: 1; fill: var(--border-strong) }
  65.00% { opacity: 1; fill: var(--border-strong) }
  65.96% { opacity: 1; fill: var(--border-strong) }
  71.02% { opacity: 1; fill: var(--border-strong) }
  71.99% { opacity: 1; fill: var(--border-strong) }
  77.05% { opacity: 1; fill: var(--border-strong) }
  78.01% { opacity: 1; fill: var(--border-strong) }
  100.00% { opacity: 1; fill: var(--border-strong) }
}

@keyframes hw-seg-1 {
  0.00% { opacity: 0; fill: var(--border-strong) }
  60.66% { opacity: 0; fill: var(--border-strong) }
  62.47% { opacity: 1; fill: var(--border-strong) }
  65.00% { opacity: 1; fill: var(--border-strong) }
  65.96% { opacity: 1; fill: var(--border-strong) }
  71.02% { opacity: 1; fill: var(--border-strong) }
  71.99% { opacity: 1; fill: var(--hw-accent) }
  77.05% { opacity: 1; fill: var(--hw-accent) }
  78.01% { opacity: 1; fill: var(--border-strong) }
  100.00% { opacity: 1; fill: var(--border-strong) }
}

@keyframes hw-seg-2 {
  0.00% { opacity: 0; fill: var(--border-strong) }
  61.08% { opacity: 0; fill: var(--border-strong) }
  62.89% { opacity: 1; fill: var(--border-strong) }
  65.00% { opacity: 1; fill: var(--border-strong) }
  65.96% { opacity: 1; fill: var(--border-strong) }
  71.02% { opacity: 1; fill: var(--border-strong) }
  71.99% { opacity: 1; fill: var(--border-strong) }
  77.05% { opacity: 1; fill: var(--border-strong) }
  78.01% { opacity: 1; fill: var(--border-strong) }
  100.00% { opacity: 1; fill: var(--border-strong) }
}

@keyframes hw-seg-3 {
  0.00% { opacity: 0; fill: var(--border-strong) }
  61.51% { opacity: 0; fill: var(--border-strong) }
  63.31% { opacity: 1; fill: var(--border-strong) }
  65.00% { opacity: 1; fill: var(--border-strong) }
  65.96% { opacity: 1; fill: var(--hw-accent) }
  71.02% { opacity: 1; fill: var(--hw-accent) }
  71.99% { opacity: 1; fill: var(--border-strong) }
  77.05% { opacity: 1; fill: var(--border-strong) }
  78.01% { opacity: 1; fill: var(--border-strong) }
  100.00% { opacity: 1; fill: var(--border-strong) }
}

@keyframes hw-seg-4 {
  0.00% { opacity: 0; fill: var(--border-strong) }
  61.93% { opacity: 0; fill: var(--border-strong) }
  63.73% { opacity: 1; fill: var(--border-strong) }
  65.00% { opacity: 1; fill: var(--border-strong) }
  65.96% { opacity: 1; fill: var(--border-strong) }
  71.02% { opacity: 1; fill: var(--border-strong) }
  71.99% { opacity: 1; fill: var(--border-strong) }
  77.05% { opacity: 1; fill: var(--border-strong) }
  78.01% { opacity: 1; fill: var(--hw-accent) }
  100.00% { opacity: 1; fill: var(--hw-accent) }
}

@keyframes hw-seg-5 {
  0.00% { opacity: 0; fill: var(--border-strong) }
  62.35% { opacity: 0; fill: var(--border-strong) }
  64.16% { opacity: 1; fill: var(--hw-accent) }
  65.00% { opacity: 1; fill: var(--hw-accent) }
  65.96% { opacity: 1; fill: var(--border-strong) }
  71.02% { opacity: 1; fill: var(--border-strong) }
  71.99% { opacity: 1; fill: var(--border-strong) }
  77.05% { opacity: 1; fill: var(--border-strong) }
  78.01% { opacity: 1; fill: var(--border-strong) }
  100.00% { opacity: 1; fill: var(--border-strong) }
}

@keyframes hw-cap-watch {
  0.00% { opacity: 0; transform: translateY(4px) }
  2.41% { opacity: 0; transform: translateY(4px) }
  4.82% { opacity: 1; transform: none }
  14.46% { opacity: 1; transform: none }
  16.27% { opacity: 0; transform: translateY(-4px) }
}

@keyframes hw-cap-detect {
  0.00% { opacity: 0; transform: translateY(4px) }
  15.66% { opacity: 0; transform: translateY(4px) }
  18.07% { opacity: 1; transform: none }
  51.81% { opacity: 1; transform: none }
  53.61% { opacity: 0; transform: translateY(-4px) }
}

@keyframes hw-cap-dedupe {
  0.00% { opacity: 0; transform: translateY(4px) }
  53.61% { opacity: 0; transform: translateY(4px) }
  56.02% { opacity: 1; transform: none }
  61.45% { opacity: 1; transform: none }
  63.25% { opacity: 0; transform: translateY(-4px) }
}

@keyframes hw-cap-seek {
  0.00% { opacity: 0; transform: translateY(4px) }
  63.25% { opacity: 0; transform: translateY(4px) }
  65.66% { opacity: 1; transform: none }
  79.52% { opacity: 1; transform: none }
  81.33% { opacity: 0; transform: translateY(-4px) }
}

@keyframes hw-cap-export {
  0.00% { opacity: 0; transform: translateY(4px) }
  81.33% { opacity: 0; transform: translateY(4px) }
  83.73% { opacity: 1; transform: none }
  93.98% { opacity: 1; transform: none }
  95.78% { opacity: 0; transform: translateY(-4px) }
}

@keyframes hw-cap-credit {
  0.00% { opacity: 0; transform: translateY(4px) }
  95.78% { opacity: 0; transform: translateY(4px) }
  98.19% { opacity: 1; transform: none }
  100.00% { opacity: 1; transform: none }
}

@keyframes hw-brand {
  0.00% { opacity: 0; transform: translateY(6px) }
  95.78% { opacity: 0; transform: translateY(6px) }
  99.40% { opacity: 1; transform: none }
  100.00% { opacity: 1; transform: none }
}
</style>
