<template>
  <div class="bm-demo" aria-hidden="false">
    <button type="button" class="bm-demo-close" :aria-label="$t('webAuth.demoClose')" @click="emit('close')">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <line x1="18" y1="6" x2="6" y2="18" />
        <line x1="6" y1="6" x2="18" y2="18" />
      </svg>
    </button>

    <!-- One looping scene, four acts: drag to bar → open yanhekt.cn → click, confirm dialog, OK → token auto-fills. -->
    <svg class="bm-demo-art" viewBox="0 0 520 242" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <defs>
        <filter id="bmDemoShadow" x="-25%" y="-25%" width="150%" height="170%">
          <feDropShadow dx="0" dy="3" stdDeviation="4" flood-color="#000000" flood-opacity="0.16" />
        </filter>
      </defs>

      <!-- Browser scene: bar, yanhekt page, bookmark, confirm dialog (fades out for act 4) -->
      <g class="d-scene">
        <!-- Act 2 backdrop: address pill + yanhekt page content -->
        <g class="d-site">
          <rect class="d-address" x="160" y="8" width="200" height="26" rx="13" />
          <path class="d-lock" d="M176.5 17 v-2.5 a3 3 0 0 1 6 0 V17" fill="none" />
          <rect class="d-lock-body" x="174.5" y="17" width="10" height="7.5" rx="1.5" />
          <text class="d-address-text" x="268" y="25.5" text-anchor="middle">yanhekt.cn</text>

          <rect class="d-thumb" x="70" y="84" width="112" height="62" rx="8" />
          <polygon class="d-play" points="120,105 137,115 120,125" />
          <rect class="d-line d-line--head" x="198" y="86" width="200" height="11" rx="5.5" />
          <rect class="d-line" x="198" y="106" width="150" height="8" rx="4" />
          <rect class="d-line" x="198" y="122" width="180" height="8" rx="4" />
        </g>

        <!-- Bookmarks bar with the dashed drop slot -->
        <rect class="d-bar" x="40" y="44" width="440" height="24" rx="8" />
        <rect class="d-mark" x="56" y="52" width="34" height="8" rx="4" />
        <rect class="d-mark" x="98" y="52" width="26" height="8" rx="4" />
        <rect class="d-mark" x="132" y="52" width="26" height="8" rx="4" />
        <rect class="d-slot" x="250" y="49" width="120" height="14" rx="4" />

        <!-- The bookmark that appears in the bar after the drop -->
        <g class="d-bookmark">
          <path class="d-bookmark-glyph" d="M258 52.5 a1.5 1.5 0 0 1 1.5 -1.5 h4.5 a1.5 1.5 0 0 1 1.5 1.5 v9.5 l-3.75 -2.9 -3.75 2.9 z" />
          <text class="d-bookmark-text" x="318" y="60" text-anchor="middle">{{ $t('webAuth.bookmarkletLabel') }}</text>
        </g>

        <!-- Browser confirm dialog raised by the bookmarklet -->
        <g class="d-modal">
          <g filter="url(#bmDemoShadow)">
            <rect class="d-modal-face" x="130" y="78" width="260" height="76" rx="10" />
          </g>
          <text class="d-modal-source" x="146" y="94">www.yanhekt.cn</text>
          <text class="d-modal-line" x="146" y="109">{{ $t('webAuth.demoModalLine1') }}</text>
          <text class="d-modal-line" x="146" y="122">{{ $t('webAuth.demoModalLine2') }}</text>
          <rect class="d-modal-btn d-modal-btn--cancel" x="284" y="129" width="48" height="17" rx="8.5" />
          <text class="d-modal-btn-text d-modal-btn-text--cancel" x="308" y="140.5" text-anchor="middle">{{ $t('webAuth.demoModalCancel') }}</text>
          <rect class="d-modal-btn d-modal-btn--ok" x="340" y="129" width="44" height="17" rx="8.5" />
          <text class="d-modal-btn-text d-modal-btn-text--ok" x="362" y="140.5" text-anchor="middle">{{ $t('webAuth.demoModalOk') }}</text>
        </g>
      </g>

      <!-- Act 4: back in AutoSlides, the paste step fills itself in -->
      <g class="d-paste">
        <rect class="d-input" x="110" y="70" width="300" height="40" rx="8" />
        <text class="d-input-text d-fill-text" x="126" y="95">c9f2a41e8b73d05f6aa1</text>
        <text class="d-paste-back" x="310" y="143" text-anchor="middle">{{ $t('webAuth.back') }}</text>
        <rect class="d-paste-verify" x="336" y="124" width="74" height="28" rx="14" />
        <text class="d-paste-verify-text" x="373" y="142" text-anchor="middle">{{ $t('webAuth.tokenConfirm') }}</text>
      </g>

      <!-- Click feedback ring (bookmark, OK, then Verify) -->
      <circle class="d-ring" cx="310" cy="56" r="24" />

      <!-- The draggable button, drawn at its resting spot; keyframes carry it into the slot -->
      <g class="d-btn">
        <g filter="url(#bmDemoShadow)">
          <rect class="d-btn-face" x="175" y="150" width="170" height="34" rx="10" />
        </g>
        <path class="d-btn-glyph" d="M192 160 a2.5 2.5 0 0 1 2.5 -2.5 h7 a2.5 2.5 0 0 1 2.5 2.5 v15 l-6 -4.6 -6 4.6 z" />
        <text class="d-btn-label" x="272" y="171.5" text-anchor="middle">{{ $t('webAuth.bookmarkletLabel') }}</text>
      </g>

      <!-- Cursor (drawn with its tip at the origin, moved via keyframes) -->
      <g class="d-cursor">
        <path class="d-cursor-shape" d="M0 0 l 0 26 l 6.5 -6.5 l 4.5 10 l 5 -2 l -4.5 -10 l 9 -0.5 z" />
      </g>

      <!-- Captions, one per act -->
      <text class="d-cap d-cap-1" x="260" y="232" text-anchor="middle">{{ $t('webAuth.demoStep1') }}</text>
      <text class="d-cap d-cap-2" x="260" y="232" text-anchor="middle">{{ $t('webAuth.demoStep2') }}</text>
      <text class="d-cap d-cap-3" x="260" y="232" text-anchor="middle">{{ $t('webAuth.demoStep3') }}</text>
      <text class="d-cap d-cap-4" x="260" y="232" text-anchor="middle">{{ $t('webAuth.demoStep4') }}</text>
    </svg>
  </div>
</template>

<script setup lang="ts">
const emit = defineEmits<{ close: [] }>()
</script>

<style scoped>
/* Floats on the page background — no panel of its own. The wrapper ignores the
   pointer so it never intercepts drags aimed at the real bookmarklet button. */
.bm-demo {
  position: relative;
  pointer-events: none;
  --demo-dur: 16s;
}

.bm-demo-close {
  position: absolute;
  top: -0.25rem;
  right: -0.25rem;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 1.75rem;
  height: 1.75rem;
  border: none;
  border-radius: 50%;
  background: transparent;
  color: var(--text-secondary);
  cursor: pointer;
  pointer-events: auto;
  transition: background-color 0.15s;
  z-index: var(--z-base);
}

.bm-demo-close:hover {
  background-color: var(--bg-hover);
}

.bm-demo-art {
  display: block;
  width: 100%;
  height: auto;
  overflow: visible;
}

/* ===== Static scene pieces ===== */
.d-bar {
  fill: var(--bg-hover);
}

.d-mark {
  fill: var(--border-strong);
}

.d-address {
  fill: var(--bg-hover);
  stroke: var(--border-color);
  stroke-width: 1;
}

.d-lock {
  stroke: var(--text-muted);
  stroke-width: 1.5;
  stroke-linecap: round;
}

.d-lock-body {
  fill: var(--text-muted);
}

.d-address-text {
  fill: var(--text-secondary);
  font-family: inherit;
  font-size: 12.5px;
  font-weight: 500;
}

.d-thumb {
  fill: var(--bg-hover);
  stroke: var(--border-color);
  stroke-width: 1;
}

.d-play {
  fill: var(--border-strong);
}

.d-line {
  fill: var(--border-strong);
  opacity: 0.45;
}

.d-line--head {
  opacity: 0.8;
}

.d-bookmark-glyph {
  fill: var(--accent-deep);
}

.d-bookmark-text {
  fill: var(--accent-deep);
  font-family: inherit;
  font-size: 9.5px;
  font-weight: 600;
}

.d-modal-face {
  fill: var(--bg-surface);
  stroke: var(--border-color);
  stroke-width: 1;
}

html[data-theme='dark'] .d-modal-face {
  fill: var(--bg-elevated);
}

.d-modal-source {
  fill: var(--text-muted);
  font-family: inherit;
  font-size: 9px;
}

.d-modal-line {
  fill: var(--text-primary);
  font-family: inherit;
  font-size: 10.5px;
}

.d-modal-btn--cancel {
  fill: var(--bg-hover);
}

.d-modal-btn--ok {
  fill: var(--accent-deep);
}

.d-modal-btn-text--cancel {
  fill: var(--text-primary);
  font-family: inherit;
  font-size: 9.5px;
  font-weight: 600;
}

.d-modal-btn-text--ok {
  fill: #ffffff;
  font-family: inherit;
  font-size: 9.5px;
  font-weight: 600;
}

.d-input {
  fill: var(--bg-surface);
  stroke: var(--border-input);
  stroke-width: 1.5;
}

html[data-theme='dark'] .d-input {
  fill: transparent;
}

.d-input-text {
  fill: var(--text-primary);
  font-family: inherit;
  font-size: 12px;
  letter-spacing: 1px;
}

.d-paste-back {
  fill: var(--accent-deep);
  font-family: inherit;
  font-size: 12px;
  font-weight: 600;
}

.d-paste-verify {
  fill: var(--accent-deep);
}

.d-paste-verify-text {
  fill: #ffffff;
  font-family: inherit;
  font-size: 12px;
  font-weight: 600;
}

.d-btn-face {
  fill: var(--accent-deep);
}

.d-btn-glyph {
  fill: #ffffff;
}

.d-btn-label {
  fill: #ffffff;
  font-family: inherit;
  font-size: 13px;
  font-weight: 700;
}

.d-ring {
  fill: none;
  stroke: var(--accent-deep);
  stroke-width: 2.5;
}

.d-cursor-shape {
  fill: var(--text-primary);
  stroke: var(--bg-page);
  stroke-width: 1.75;
  stroke-linejoin: round;
}

.d-cap {
  fill: var(--text-secondary);
  font-family: inherit;
  font-size: 14px;
  font-weight: 500;
}

/* ===== Timeline =====
   One 16s loop, all keyframe percentages synchronized:
   0–9%   cursor reaches the button              (caption 1)
   9–23%  drags it into the dashed slot, drop    (caption 1)
   23–31% yanhekt.cn page fades in               (caption 2)
   40–46% cursor clicks the bookmark             (caption 3)
   44–58% confirm dialog: read, then click OK    (caption 3)
   62–86% paste step: token auto-fills, Verify   (caption 4)
   88–100% reset for the next loop */

.d-scene {
  animation: d-scene var(--demo-dur) ease-in-out infinite;
}

@keyframes d-scene {
  0%, 59% { opacity: 1; }
  64%, 88% { opacity: 0; }
  94%, 100% { opacity: 1; }
}

.d-slot {
  fill: none;
  stroke: var(--accent-deep);
  stroke-width: 1.5;
  stroke-dasharray: 3 3;
  animation: d-slot var(--demo-dur) ease-in-out infinite;
}

@keyframes d-slot {
  0%, 9% { opacity: 1; stroke-width: 1.5; }
  12% { stroke-width: 2.4; }
  20% { opacity: 1; stroke-width: 2.4; }
  25%, 90% { opacity: 0; stroke-width: 1.5; }
  96%, 100% { opacity: 1; stroke-width: 1.5; }
}

.d-btn {
  opacity: 1;
  transform-box: view-box;
  transform-origin: 260px 167px;
  animation: d-btn var(--demo-dur) ease-in-out infinite;
}

@keyframes d-btn {
  0%, 9% { transform: translate(0, 0) scale(1); opacity: 1; }
  20% { transform: translate(50px, -107px) scale(0.62); opacity: 1; }
  23% { transform: translate(50px, -107px) scale(0.5); opacity: 0; }
  90% { transform: translate(0, 0) scale(1); opacity: 0; }
  96%, 100% { transform: translate(0, 0) scale(1); opacity: 1; }
}

.d-bookmark {
  opacity: 0;
  transform-box: view-box;
  transform-origin: 310px 56px;
  animation: d-bookmark var(--demo-dur) ease-in-out infinite;
}

@keyframes d-bookmark {
  0%, 20% { opacity: 0; transform: scale(0.6); }
  24% { opacity: 1; transform: scale(1.12); }
  27% { transform: scale(1); }
  85% { opacity: 1; transform: scale(1); }
  90%, 100% { opacity: 0; transform: scale(0.6); }
}

.d-site {
  opacity: 0;
  animation: d-site var(--demo-dur) ease-in-out infinite;
}

@keyframes d-site {
  0%, 25% { opacity: 0; transform: translateY(6px); }
  31% { opacity: 1; transform: translateY(0); }
  80% { opacity: 1; transform: translateY(0); }
  88%, 100% { opacity: 0; transform: translateY(6px); }
}

.d-modal {
  opacity: 0;
  transform-box: view-box;
  transform-origin: 260px 116px;
  animation: d-modal var(--demo-dur) ease-in-out infinite;
}

@keyframes d-modal {
  0%, 43% { opacity: 0; transform: scale(0.94); }
  46.5% { opacity: 1; transform: scale(1); }
  58% { opacity: 1; transform: scale(1); }
  61%, 100% { opacity: 0; transform: scale(0.97); }
}

.d-paste {
  opacity: 0;
  animation: d-paste var(--demo-dur) ease-in-out infinite;
}

@keyframes d-paste {
  0%, 62% { opacity: 0; transform: translateY(8px); }
  68% { opacity: 1; transform: translateY(0); }
  86% { opacity: 1; transform: translateY(0); }
  92%, 100% { opacity: 0; transform: translateY(8px); }
}

/* Token characters sweep in left-to-right, like an auto-fill */
.d-fill-text {
  animation: d-fill-text var(--demo-dur) ease-out infinite;
}

@keyframes d-fill-text {
  0%, 68% { clip-path: inset(0 100% 0 0); }
  78%, 100% { clip-path: inset(0 -5% 0 0); }
}

/* Ring pulses three times: bookmark click, OK click, Verify click */
.d-ring {
  opacity: 0;
  transform-box: view-box;
  transform-origin: 310px 56px;
  animation: d-ring var(--demo-dur) ease-out infinite;
}

@keyframes d-ring {
  0%, 41.5% { opacity: 0; transform: translate(0, 0) scale(0.15); }
  43.5% { opacity: 0.85; transform: translate(0, 0) scale(0.4); }
  47% { opacity: 0; transform: translate(0, 0) scale(1.1); }
  55% { opacity: 0; transform: translate(52px, 80px) scale(0.12); }
  57.5% { opacity: 0.7; transform: translate(52px, 80px) scale(0.3); }
  60.5% { opacity: 0; transform: translate(52px, 80px) scale(0.6); }
  76.5% { opacity: 0; transform: translate(63px, 82px) scale(0.12); }
  79% { opacity: 0.7; transform: translate(63px, 82px) scale(0.3); }
  82%, 100% { opacity: 0; transform: translate(63px, 82px) scale(0.65); }
}

.d-cursor {
  opacity: 0;
  animation: d-cursor var(--demo-dur) ease-in-out infinite;
}

@keyframes d-cursor {
  0% { transform: translate(420px, 190px); opacity: 0; }
  4% { opacity: 1; }
  7%, 9% { transform: translate(266px, 168px); }
  20%, 23% { transform: translate(318px, 58px); }
  32% { transform: translate(406px, 128px); }
  40%, 43% { transform: translate(316px, 60px); }
  44.5% { transform: translate(316px, 60px) scale(0.85); }
  46% { transform: translate(316px, 60px) scale(1); }
  53%, 56% { transform: translate(358px, 132px); }
  57.5% { transform: translate(358px, 132px) scale(0.85); }
  59% { transform: translate(358px, 132px) scale(1); }
  64% { transform: translate(444px, 170px); }
  73%, 77% { transform: translate(368px, 146px); }
  78.5% { transform: translate(368px, 146px) scale(0.85); }
  80% { transform: translate(368px, 146px) scale(1); }
  85% { transform: translate(420px, 190px); opacity: 1; }
  88%, 100% { transform: translate(420px, 190px); opacity: 0; }
}

.d-cap {
  opacity: 0;
}

.d-cap-1 {
  animation: d-cap-1 var(--demo-dur) ease-in-out infinite;
}

@keyframes d-cap-1 {
  0%, 20% { opacity: 1; }
  26%, 92% { opacity: 0; }
  98%, 100% { opacity: 1; }
}

.d-cap-2 {
  animation: d-cap-2 var(--demo-dur) ease-in-out infinite;
}

@keyframes d-cap-2 {
  0%, 26% { opacity: 0; }
  30%, 36% { opacity: 1; }
  41%, 100% { opacity: 0; }
}

.d-cap-3 {
  animation: d-cap-3 var(--demo-dur) ease-in-out infinite;
}

@keyframes d-cap-3 {
  0%, 41% { opacity: 0; }
  45%, 58% { opacity: 1; }
  63%, 100% { opacity: 0; }
}

.d-cap-4 {
  animation: d-cap-4 var(--demo-dur) ease-in-out infinite;
}

@keyframes d-cap-4 {
  0%, 64% { opacity: 0; }
  68%, 84% { opacity: 1; }
  89%, 100% { opacity: 0; }
}

/* Reduced motion: freeze on a composed "how it ends up" scene */
@media (prefers-reduced-motion: reduce) {
  .d-scene,
  .d-slot,
  .d-btn,
  .d-bookmark,
  .d-site,
  .d-modal,
  .d-paste,
  .d-fill-text,
  .d-ring,
  .d-cursor,
  .d-cap-1,
  .d-cap-2,
  .d-cap-3,
  .d-cap-4 {
    animation: none;
  }

  .d-site,
  .d-bookmark,
  .d-cap-1 {
    opacity: 1;
    transform: none;
  }

  .d-slot,
  .d-modal,
  .d-paste,
  .d-ring,
  .d-cursor {
    opacity: 0;
  }
}
</style>
