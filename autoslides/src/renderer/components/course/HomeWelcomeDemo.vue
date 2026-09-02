<template>
  <div class="hw-demo" aria-hidden="true">
    <div class="hw-hero">
      <span class="hw-hero-in">{{ $t('home.featureTitleIn') }}</span>
      <span class="hw-hero-out">{{ $t('home.featureTitleOut') }}</span>
    </div>

    <svg class="hw-art" viewBox="0 0 720 400" xmlns="http://www.w3.org/2000/svg">
      <!-- Shot 1–2: dual player. Shot 4: MP4 slides and becomes the screen player. -->
      <g class="hw-player">
        <g class="hw-cam">
          <svg x="64" y="22" width="288" height="162">
            <defs>
              <clipPath id="hwCamRound">
                <rect width="288" height="162" rx="8" />
              </clipPath>
            </defs>
            <g clip-path="url(#hwCamRound)">
            <rect class="hw-cam-room" width="288" height="162" />
            <rect class="hw-cam-board" x="22" y="22" width="244" height="72" rx="6" />
            <rect class="hw-cam-board-line" x="40" y="42" width="96" height="4" rx="2" />
            <rect class="hw-cam-board-line hw-cam-board-line--dim" x="40" y="58" width="68" height="3" rx="1.5" />
            <ellipse class="hw-cam-body" cx="144" cy="164" rx="46" ry="24" />
            <circle class="hw-cam-head" cx="144" cy="120" r="18" />
            </g>
          </svg>
          <rect class="hw-pane" x="64" y="22" width="288" height="162" rx="8" />
          <text class="hw-pane-caption" x="208" y="202" text-anchor="middle">{{ $t('playback.streamCamera') }}</text>
        </g>

        <g class="hw-file">
          <path class="hw-file-body" d="M330 48 h40 l20 20 v60 h-60 z" />
          <path class="hw-file-fold" d="M370 48 v20 h20" />
          <text class="hw-file-ext" x="360" y="102" text-anchor="middle">MP4</text>
          <text class="hw-pane-caption" x="360" y="202" text-anchor="middle">{{ $t('home.demoDownloaded') }}</text>
        </g>

        <g class="hw-scr">
          <svg x="368" y="22" width="288" height="162">
            <defs>
              <clipPath id="hwScrRound">
                <rect width="288" height="162" rx="8" />
              </clipPath>
            </defs>
            <g clip-path="url(#hwScrRound)">
            <rect class="hw-scr-paper" width="288" height="162" />
            <rect class="hw-scr-title" width="288" height="28" rx="8" />
            <rect class="hw-scr-title" y="14" width="288" height="14" />
            <rect class="hw-scr-title-tick" x="16" y="10" width="92" height="7" rx="3.5" />
            <rect class="hw-scr-title-tick hw-scr-title-tick--dim" x="232" y="11" width="36" height="5" rx="2.5" />
            <g
              v-for="(glyph, s) in SLIDE_GLYPHS"
              :key="'sg' + s"
              class="hw-scr-slide"
              :class="'hw-scr-g' + s"
            >
              <rect
                v-for="(w, b) in glyph"
                :key="b"
                class="hw-scr-bar"
                :class="{ 'hw-scr-bar--lead': b === 0 }"
                :x="24"
                :y="50 + b * 24"
                :width="Math.max(28, (w / 100) * 200)"
                :height="b === 0 ? 10 : 7"
                rx="3.5"
              />
            </g>
            </g>
          </svg>
          <rect class="hw-pane" x="368" y="22" width="288" height="162" rx="8" />
          <text class="hw-pane-caption" x="512" y="202" text-anchor="middle">{{ $t('playback.streamScreen') }}</text>
        </g>
      </g>

      <g class="hw-flow">
        <path
          class="hw-flow-line"
          d="M43 246
             C43 232 43 226 58 226
             L496 226
             C508 226 512 226 512 210
             C512 226 516 226 528 226
             L678 226
             C693 226 693 232 693 246"
        />
      </g>

      <!-- Shot 3: extract strip (dense frames). -->
      <g
        v-for="(frame, i) in STREAM"
        :key="'s' + i"
        class="hw-stream"
        :class="frame.kept ? 'hw-stream--kept' : 'hw-stream--drop'"
      >
        <rect
          class="hw-mini"
          :x="streamX(i)"
          y="250"
          width="46"
          height="29"
          rx="4"
        />
        <rect
          v-for="(w, b) in frame.glyph"
          :key="b"
          class="hw-mini-bar"
          :class="{ 'hw-mini-bar--lead': b === 0 }"
          :x="streamX(i) + 6"
          :y="256 + b * 6"
          :width="Math.max(8, (w / 100) * 34)"
          :height="b === 0 ? 3.2 : 2.2"
          rx="1.2"
        />
      </g>

      <g class="hw-scan">
        <rect class="hw-scan-beam" x="8" y="238" width="22" height="54" rx="6" />
        <rect class="hw-scan-line" x="18" y="238" width="2" height="54" rx="1" />
      </g>

      <!-- Shot 4: strip becomes a progress bar — rail through the cards, seek snaps. -->
      <rect class="hw-tl-track" x="40" y="274" width="640" height="2" rx="1" />
      <g
        v-for="(frame, k) in KEPT"
        :key="'t' + k"
        class="hw-tl"
        :class="'hw-tl--' + k"
      >
        <rect
          class="hw-tl-card"
          :x="tlX(k)"
          y="252"
          width="96"
          height="46"
          rx="7"
        />
        <rect
          v-for="(w, b) in frame.glyph"
          :key="b"
          class="hw-tl-bar"
          :class="{ 'hw-tl-bar--lead': b === 0 }"
          :x="tlX(k) + 10"
          :y="262 + b * 10"
          :width="Math.max(14, (w / 100) * 72)"
          :height="b === 0 ? 6 : 4.5"
          rx="2"
        />
      </g>
      <circle class="hw-playhead" cx="98" cy="275" r="5" />

      <!-- Shot 5: export formats + share. -->
      <g class="hw-export">
        <g
          v-for="(ext, i) in EXPORT_DOCS"
          :key="ext"
          :transform="`translate(${exportX(i)} 108)`"
        >
          <path class="hw-file-body" d="M0 0 h40 l20 20 v60 h-60 z" />
          <path class="hw-file-fold" d="M40 0 v20 h20" />
          <text
            class="hw-file-ext"
            :class="['hw-file-ext--' + ext.toLowerCase(), { 'hw-file-ext--long': ext.length > 3 }]"
            x="30"
            y="54"
            text-anchor="middle"
          >{{ ext }}</text>
        </g>
        <g :transform="`translate(${exportX(4) + 4} 124)`">
          <path
            class="hw-share-link"
            d="M40 44 H18 a16 16 0 1 1 15.3 -20.5 h4.1 a10 10 0 1 1 0 20.5 z"
          />
        </g>
      </g>
    </svg>

    <p class="hw-cap hw-cap--watch">{{ $t('home.demoWatch') }}</p>
    <p class="hw-cap hw-cap--extract">{{ $t('home.demoExtract') }}</p>
    <p class="hw-cap hw-cap--download">{{ $t('home.demoDownload') }}</p>
    <p class="hw-cap hw-cap--open">{{ $t('home.demoWatchTimeline') }}</p>
    <p class="hw-cap hw-cap--timeline">{{ $t('home.demoTimeline') }}</p>
    <p class="hw-cap hw-cap--export">{{ $t('home.demoExport') }}</p>

    <div class="hw-end">
      <div class="hw-end-row">
        <span class="hw-end-yanhekt">
        <span class="hw-end-yanhekt-clip hw-end-yanhekt-clip--icon">
          <img :src="yanhektLogoUrl" alt="" />
        </span>
        <span class="hw-end-yanhekt-clip hw-end-yanhekt-clip--word">
          <img :src="yanhektLogoUrl" alt="" />
        </span>
      </span>
        <span class="hw-end-x">×</span>
        <div class="hw-end-bit-lockup">
          <img class="hw-end-bit" :src="bitLogoUrl" alt="" />
          <img class="hw-end-bit-text" :src="bitLogoTextUrl" alt="" />
        </div>
        <span class="hw-end-x">×</span>
        <div class="hw-end-brand">
          <img class="hw-end-icon" :src="autoslidesIconUrl" alt="" />
          <span class="hw-end-title">AutoSlides</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import autoslidesIconUrl from '../../assets/autoslides-icon.png'
import bitLogoUrl from '../../assets/bit-logo.svg?url'
import bitLogoTextUrl from '../../assets/bit-logo-text.svg?url'
import yanhektLogoUrl from '../../assets/yanhekt-logo.svg?url'

/**
 * Storyboard: title → dual playback → extract from screen → MP4 + screen
 * timeline with discrete seeks. Plays once, then Yanhekt × BIT × AutoSlides.
 */
const SLIDE_GLYPHS = [
  [72, 44, 58],
  [54, 68, 36],
  [80, 38, 62],
  [46, 60, 50],
  [66, 34, 70],
] as const

const RUN_LENGTHS = [3, 4, 2, 3, 2] as const

const STREAM = RUN_LENGTHS.flatMap((length, run) =>
  Array.from({ length }, (_, i) => ({
    kept: i === 0,
    glyph: SLIDE_GLYPHS[run],
  })),
)

const KEPT = STREAM.filter((frame) => frame.kept)

function streamX(i: number): number {
  return 20 + i * 50
}

function tlX(k: number): number {
  return 50 + k * 128
}

const EXPORT_DOCS = ['PDF', 'PPTX', 'DOCX', 'MD'] as const

function exportX(i: number): number {
  return 130 + i * 100
}
</script>

<style scoped>
.hw-demo {
  --demo-dur: 26s;
  position: relative;
  width: min(560px, 92%);
  margin: 0 auto;
  flex: 0 0 auto;
  overflow: visible;
}

.hw-art {
  display: block;
  width: 100%;
  height: auto;
}

.hw-hero {
  position: absolute;
  inset: 0 0 22% 0;
  z-index: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.08em;
  pointer-events: none;
}

.hw-cap {
  position: absolute;
  left: 12px;
  right: 12px;
  bottom: 4%;
  margin: 0;
  font-size: 13px;
  line-height: 1.4;
  color: var(--text-muted);
  text-align: center;
  pointer-events: none;
  opacity: 0;
}

.hw-cap--watch { animation: hw-cap-watch var(--demo-dur) ease-in-out 1 forwards; }
.hw-cap--extract { animation: hw-cap-extract var(--demo-dur) ease-in-out 1 forwards; }
.hw-cap--download { animation: hw-cap-download var(--demo-dur) ease-in-out 1 forwards; }
.hw-cap--open { animation: hw-cap-open var(--demo-dur) ease-in-out 1 forwards; }
.hw-cap--timeline { animation: hw-cap-timeline var(--demo-dur) ease-in-out 1 forwards; }
.hw-cap--export { animation: hw-cap-export var(--demo-dur) ease-in-out 1 forwards; }

.hw-end {
  position: absolute;
  inset: 0;
  z-index: 2;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: visible;
  pointer-events: none;
  opacity: 0;
  animation: hw-end-in 0.7s ease-out calc(var(--demo-dur) - 0.5s) forwards;
}

.hw-end-row {
  display: flex;
  flex-wrap: nowrap;
  align-items: center;
  gap: 10px 13px;
  width: max-content;
}

.hw-end-x {
  color: var(--text-muted);
  font-size: 21px;
  font-weight: 400;
  line-height: 1;
}

.hw-end-yanhekt {
  display: flex;
  align-items: stretch;
  height: 34px;
}

.hw-end-yanhekt-clip {
  display: block;
  height: 34px;
  overflow: hidden;
}

.hw-end-yanhekt-clip img {
  display: block;
  height: 34px;
  width: auto;
  max-width: none;
}

.hw-end-yanhekt-clip--icon {
  width: calc(34px * 54 / 40);
}

.hw-end-yanhekt-clip--word {
  width: calc(34px * 95 / 40);
}

.hw-end-yanhekt-clip--word img {
  margin-left: calc(-34px * 54 / 40);
}

.hw-end-bit-text {
  filter: brightness(0.18);
}

@media (prefers-color-scheme: dark) {
  .hw-end-yanhekt-clip--word img {
    filter: brightness(0) invert(1);
  }

  .hw-end-bit-text {
    filter: none;
  }
}

.hw-end-bit-lockup {
  display: flex;
  align-items: center;
  gap: 8px;
}

.hw-end-bit {
  display: block;
  height: 42px;
  width: auto;
}

.hw-end-bit-text {
  display: block;
  height: 31px;
  width: auto;
}

.hw-end-brand {
  display: flex;
  align-items: center;
  gap: 10px;
}

.hw-end-icon {
  display: block;
  width: 42px;
  height: 42px;
  object-fit: contain;
  flex-shrink: 0;
}

.hw-end-title {
  font-family: ui-serif, 'Iowan Old Style', Palatino, Georgia, serif;
  font-size: 24px;
  font-weight: 600;
  letter-spacing: -0.02em;
  color: var(--text-primary);
}

@keyframes hw-end-in {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: none;
  }
}

.hw-hero-in,
.hw-hero-out {
  font-size: clamp(26px, 4.8vw, 38px);
  font-weight: 700;
  letter-spacing: -0.045em;
  line-height: 1.12;
  color: var(--text-primary);
  animation: hw-hero-in var(--demo-dur) ease-in-out 1 forwards;
}

.hw-hero-out {
  color: var(--accent);
  animation-name: hw-hero-out;
}

.hw-player {
  animation: hw-player var(--demo-dur) ease-in-out 1 forwards;
}

.hw-cam {
  animation: hw-cam var(--demo-dur) ease-in-out 1 forwards;
}

.hw-file {
  transform-origin: 360px 88px;
  animation: hw-file var(--demo-dur) ease-in-out 1 forwards;
}

.hw-scr {
  animation: hw-scr var(--demo-dur) ease-in-out 1 forwards;
}

.hw-pane {
  fill: none;
  stroke: var(--border-strong);
  stroke-width: 1.25;
}

.hw-pane-caption {
  fill: var(--text-secondary);
  font-size: 12px;
  font-weight: 500;
  font-family: inherit;
}

.hw-cam-room { fill: var(--bg-subtle); }

.hw-cam-board {
  fill: var(--bg-page);
  stroke: var(--border-color);
  stroke-width: 1;
}

.hw-cam-board-line {
  fill: var(--text-muted);
  opacity: 0.55;
}

.hw-cam-board-line--dim { opacity: 0.35; }

.hw-cam-head {
  fill: var(--text-secondary);
  opacity: 0.45;
}

.hw-cam-body {
  fill: var(--text-secondary);
  opacity: 0.32;
}

.hw-file-body {
  fill: var(--bg-elevated);
  stroke: var(--border-strong);
  stroke-width: 1.4;
  stroke-linejoin: round;
}

.hw-file-fold {
  fill: var(--bg-subtle);
  stroke: var(--border-strong);
  stroke-width: 1.4;
  stroke-linejoin: round;
}

.hw-file-ext {
  fill: var(--accent);
  font-size: 13px;
  font-weight: 700;
  font-family: inherit;
}

.hw-file-ext--long {
  font-size: 11px;
}

.hw-file-ext--pdf { fill: var(--danger); }
.hw-file-ext--pptx { fill: var(--warning); }
.hw-file-ext--docx { fill: var(--accent); }
.hw-file-ext--md { fill: var(--success); }

.hw-export {
  transform-box: fill-box;
  transform-origin: center;
  animation: hw-export var(--demo-dur) ease-in-out 1 forwards;
}

.hw-share-link {
  fill: none;
  stroke: var(--accent);
  stroke-width: 2.4;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.hw-scr-paper { fill: var(--bg-elevated); }

.hw-scr-title {
  fill: var(--text-primary);
  opacity: 0.82;
}

.hw-scr-title-tick {
  fill: var(--bg-elevated);
  opacity: 0.78;
}

.hw-scr-title-tick--dim { opacity: 0.4; }

.hw-scr-bar {
  fill: var(--text-muted);
  opacity: 0.5;
}

.hw-scr-bar--lead {
  fill: var(--text-primary);
  opacity: 0.88;
}

.hw-scr-g0 { animation: hw-scr-0 var(--demo-dur) ease-in-out 1 forwards; }
.hw-scr-g1 { animation: hw-scr-1 var(--demo-dur) ease-in-out 1 forwards; }
.hw-scr-g2 { animation: hw-scr-2 var(--demo-dur) ease-in-out 1 forwards; }
.hw-scr-g3 { animation: hw-scr-3 var(--demo-dur) ease-in-out 1 forwards; }
.hw-scr-g4 { animation: hw-scr-4 var(--demo-dur) ease-in-out 1 forwards; }

.hw-flow {
  animation: hw-flow var(--demo-dur) ease-in-out 1 forwards;
}

.hw-flow-line {
  fill: none;
  stroke: var(--accent);
  stroke-width: 1.5;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.hw-mini {
  fill: var(--bg-elevated);
  stroke: var(--border-strong);
  stroke-width: 1;
}

.hw-mini-bar {
  fill: var(--text-muted);
  opacity: 0.55;
}

.hw-mini-bar--lead {
  fill: var(--text-secondary);
  opacity: 0.9;
}

.hw-stream {
  transform-box: fill-box;
  transform-origin: center;
}

.hw-stream--kept { animation: hw-stream-kept var(--demo-dur) ease-in-out 1 forwards; }
.hw-stream--drop { animation: hw-stream-drop var(--demo-dur) ease-in-out 1 forwards; }

.hw-scan { animation: hw-scan var(--demo-dur) ease-in-out 1 forwards; }

.hw-scan-beam {
  fill: var(--accent);
  opacity: 0.16;
}

.hw-scan-line {
  fill: var(--accent);
  opacity: 0.85;
}

.hw-tl {
  transform-box: fill-box;
  transform-origin: center;
}

.hw-tl-card {
  fill: var(--bg-elevated);
  stroke: var(--border-color);
  stroke-width: 1;
}

.hw-tl-bar {
  fill: var(--text-muted);
  opacity: 0.5;
}

.hw-tl-bar--lead {
  fill: var(--text-primary);
  opacity: 0.88;
}

.hw-tl--0 { animation: hw-tl-0 var(--demo-dur) ease-in-out 1 forwards; }
.hw-tl--1 { animation: hw-tl-1 var(--demo-dur) ease-in-out 1 forwards; }
.hw-tl--2 { animation: hw-tl-2 var(--demo-dur) ease-in-out 1 forwards; }
.hw-tl--3 { animation: hw-tl-3 var(--demo-dur) ease-in-out 1 forwards; }
.hw-tl--4 { animation: hw-tl-4 var(--demo-dur) ease-in-out 1 forwards; }

.hw-tl--0 .hw-tl-card { animation: hw-tl-stroke-0 var(--demo-dur) step-end 1 forwards; }
.hw-tl--1 .hw-tl-card { animation: hw-tl-stroke-1 var(--demo-dur) step-end 1 forwards; }
.hw-tl--2 .hw-tl-card { animation: hw-tl-stroke-2 var(--demo-dur) step-end 1 forwards; }
.hw-tl--3 .hw-tl-card { animation: hw-tl-stroke-3 var(--demo-dur) step-end 1 forwards; }
.hw-tl--4 .hw-tl-card { animation: hw-tl-stroke-4 var(--demo-dur) step-end 1 forwards; }

.hw-tl-track {
  fill: var(--border-strong);
  animation: hw-tl-track var(--demo-dur) ease-in-out 1 forwards;
}

.hw-playhead {
  fill: var(--accent);
  animation: hw-playhead var(--demo-dur) step-end 1 forwards;
}

@keyframes hw-hero-in {
  0%, 3% { opacity: 0; transform: translateY(14px); }
  8%, 16% { opacity: 1; transform: none; }
  22%, 100% { opacity: 0; transform: translateY(-8px); }
}

@keyframes hw-hero-out {
  0%, 6% { opacity: 0; transform: translateY(14px); }
  11%, 16% { opacity: 1; transform: none; }
  22%, 100% { opacity: 0; transform: translateY(-8px); }
}

@keyframes hw-player {
  0%, 22% { opacity: 0; transform: translateY(64px); }
  26%, 35% { opacity: 1; transform: translateY(64px); }
  39%, 84% { opacity: 1; transform: none; }
  86%, 100% { opacity: 0; transform: translateY(-8px); }
}

@keyframes hw-cam {
  0%, 52% { opacity: 1; }
  57%, 100% { opacity: 0; }
}

@keyframes hw-file {
  0%, 53% { opacity: 0; transform: scale(1); }
  56%, 60% { opacity: 1; transform: scale(1); }
  66% { opacity: 0; transform: scale(2.4); }
  67%, 100% { opacity: 0; transform: scale(2.4); }
}

@keyframes hw-scr {
  0%, 53% { opacity: 1; transform: none; }
  56%, 62% { opacity: 0; transform: translateX(-152px); }
  67%, 84% { opacity: 1; transform: translateX(-152px); }
  86%, 100% { opacity: 0; transform: translateX(-152px); }
}

@keyframes hw-flow {
  0%, 38% { opacity: 0; }
  41%, 52% { opacity: 1; }
  56%, 100% { opacity: 0; }
}

/* Extract: slides 0–2. After MP4 opens: seeks 0, 2, 4, 1. */
@keyframes hw-scr-0 {
  0%, 24% { opacity: 0; }
  26%, 42% { opacity: 1; }
  44%, 69% { opacity: 0; }
  70%, 74% { opacity: 1; }
  75%, 100% { opacity: 0; }
}

@keyframes hw-scr-1 {
  0%, 43% { opacity: 0; }
  45%, 49% { opacity: 1; }
  51%, 100% { opacity: 0; }
}

@keyframes hw-scr-2 {
  0%, 50% { opacity: 0; }
  52%, 54% { opacity: 1; }
  56%, 74% { opacity: 0; }
  75%, 79% { opacity: 1; }
  80%, 100% { opacity: 0; }
}

@keyframes hw-scr-3 {
  0%, 100% { opacity: 0; }
}

@keyframes hw-scr-4 {
  0%, 79% { opacity: 0; }
  80%, 84% { opacity: 1; }
  86%, 100% { opacity: 0; }
}

@keyframes hw-stream-kept {
  0%, 38% { opacity: 0; transform: translateY(-10px); }
  41%, 46% { opacity: 1; transform: none; }
  50%, 53% { opacity: 1; transform: scale(1.08); }
  57%, 100% { opacity: 0; transform: scale(1.12); }
}

@keyframes hw-stream-drop {
  0%, 38% { opacity: 0; transform: translateY(-10px); }
  41%, 46% { opacity: 1; transform: none; }
  50%, 53% { opacity: 0.2; transform: scale(0.84); }
  57%, 100% { opacity: 0; transform: scale(0.78) translateY(8px); }
}

@keyframes hw-scan {
  0%, 46% { opacity: 0; transform: translateX(0); }
  48% { opacity: 1; transform: translateX(0); }
  54% { opacity: 1; transform: translateX(680px); }
  56%, 100% { opacity: 0; transform: translateX(680px); }
}

@keyframes hw-cap-watch {
  0%, 24% { opacity: 0; }
  27%, 35% { opacity: 1; }
  38%, 100% { opacity: 0; }
}

@keyframes hw-cap-extract {
  0%, 38% { opacity: 0; }
  41%, 53% { opacity: 1; }
  57%, 100% { opacity: 0; }
}

@keyframes hw-cap-download {
  0%, 54% { opacity: 0; }
  57%, 62% { opacity: 1; }
  65%, 100% { opacity: 0; }
}

@keyframes hw-cap-open {
  0%, 61% { opacity: 0; }
  65%, 69% { opacity: 1; }
  70%, 100% { opacity: 0; }
}

@keyframes hw-cap-timeline {
  0%, 69% { opacity: 0; }
  70%, 84% { opacity: 1; }
  86%, 100% { opacity: 0; }
}

@keyframes hw-tl-0 {
  0%, 63% { opacity: 0; transform: scale(0.92) translateY(8px); }
  67%, 69% { opacity: 1; transform: none; }
  70%, 74% { opacity: 1; transform: scale(1.08) translateY(-6px); }
  75%, 84% { opacity: 1; transform: none; }
  86%, 100% { opacity: 0; }
}

@keyframes hw-tl-1 {
  0%, 63% { opacity: 0; transform: scale(0.92) translateY(8px); }
  67%, 84% { opacity: 1; transform: none; }
  86%, 100% { opacity: 0; }
}

@keyframes hw-tl-2 {
  0%, 63% { opacity: 0; transform: scale(0.92) translateY(8px); }
  67%, 74% { opacity: 1; transform: none; }
  75%, 79% { opacity: 1; transform: scale(1.08) translateY(-6px); }
  80%, 84% { opacity: 1; transform: none; }
  86%, 100% { opacity: 0; }
}

@keyframes hw-tl-3 {
  0%, 63% { opacity: 0; transform: scale(0.92) translateY(8px); }
  67%, 84% { opacity: 1; transform: none; }
  86%, 100% { opacity: 0; }
}

@keyframes hw-tl-4 {
  0%, 63% { opacity: 0; transform: scale(0.92) translateY(8px); }
  67%, 79% { opacity: 1; transform: none; }
  80%, 84% { opacity: 1; transform: scale(1.08) translateY(-6px); }
  86%, 100% { opacity: 0; }
}

@keyframes hw-tl-stroke-0 {
  0% { stroke: var(--border-color); stroke-width: 1; }
  70% { stroke: var(--accent); stroke-width: 1.75; }
  75%, 100% { stroke: var(--border-color); stroke-width: 1; }
}

@keyframes hw-tl-stroke-1 {
  0%, 100% { stroke: var(--border-color); stroke-width: 1; }
}

@keyframes hw-tl-stroke-2 {
  0% { stroke: var(--border-color); stroke-width: 1; }
  75% { stroke: var(--accent); stroke-width: 1.75; }
  80%, 100% { stroke: var(--border-color); stroke-width: 1; }
}

@keyframes hw-tl-stroke-3 {
  0%, 100% { stroke: var(--border-color); stroke-width: 1; }
}

@keyframes hw-tl-stroke-4 {
  0% { stroke: var(--border-color); stroke-width: 1; }
  80% { stroke: var(--accent); stroke-width: 1.75; }
  85%, 100% { stroke: var(--border-color); stroke-width: 1; }
}

@keyframes hw-tl-track {
  0%, 63% { opacity: 0; }
  67%, 84% { opacity: 1; }
  86%, 100% { opacity: 0; }
}

@keyframes hw-playhead {
  0%, 69% { opacity: 0; transform: translateX(0); }
  70% { opacity: 1; transform: translateX(0); }
  75% { opacity: 1; transform: translateX(256px); }
  80% { opacity: 1; transform: translateX(512px); }
  85%, 100% { opacity: 0; transform: translateX(512px); }
}

@keyframes hw-export {
  0%, 83% { opacity: 0; transform: translateY(12px); }
  86%, 94% { opacity: 1; transform: none; }
  97%, 100% { opacity: 0; transform: translateY(-8px); }
}

@keyframes hw-cap-export {
  0%, 84% { opacity: 0; }
  87%, 94% { opacity: 1; }
  97%, 100% { opacity: 0; }
}

@media (prefers-reduced-motion: reduce) {
  .hw-hero-in,
  .hw-hero-out,
  .hw-player,
  .hw-cam,
  .hw-file,
  .hw-scr,
  .hw-flow,
  .hw-scr-slide,
  .hw-stream,
  .hw-scan,
  .hw-tl,
  .hw-tl .hw-tl-card,
  .hw-tl-track,
  .hw-playhead,
  .hw-export,
  .hw-end,
  .hw-cap {
    animation: none;
  }

  .hw-hero-in,
  .hw-hero-out,
  .hw-cam,
  .hw-flow,
  .hw-stream,
  .hw-scan,
  .hw-cap--watch,
  .hw-cap--extract,
  .hw-cap--download,
  .hw-scr-g1,
  .hw-scr-g2,
  .hw-scr-g3,
  .hw-scr-g4 {
    opacity: 0;
  }

  .hw-player,
  .hw-scr-g0,
  .hw-tl,
  .hw-tl-track,
  .hw-cap--open,
  .hw-playhead,
  .hw-scr {
    opacity: 0;
  }

  .hw-file,
  .hw-export,
  .hw-cap--timeline,
  .hw-cap--export {
    opacity: 0;
  }

  .hw-end {
    opacity: 1;
    transform: none;
  }
}

/* Screenshot freeze: skip the 26s storyboard and hold the logo lockup. */
.hw-demo--logos .hw-hero,
.hw-demo--logos .hw-art,
.hw-demo--logos .hw-cap {
  opacity: 0 !important;
  animation: none !important;
  visibility: hidden;
}

.hw-demo--logos .hw-end {
  opacity: 1 !important;
  animation: none !important;
  transform: none;
}
</style>
