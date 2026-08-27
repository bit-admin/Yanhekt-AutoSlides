<template>
  <div class="hw-demo" aria-hidden="true">
    <svg class="hw-art" viewBox="0 0 520 270" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <filter id="hwShadow" x="-8%" y="-8%" width="116%" height="124%">
          <feDropShadow dx="0" dy="6" stdDeviation="10" flood-color="#000000" flood-opacity="0.14" />
        </filter>
      </defs>

      <g class="hw-window" filter="url(#hwShadow)">
        <rect class="hw-chrome" x="36" y="16" width="448" height="220" rx="12" />
        <rect class="hw-titlebar" x="36" y="16" width="448" height="28" rx="12" />
        <rect class="hw-titlebar-sq" x="36" y="30" width="448" height="14" />

        <circle class="hw-tl hw-tl--close" cx="52" cy="30" r="4.5" />
        <circle class="hw-tl hw-tl--min" cx="67" cy="30" r="4.5" />
        <circle class="hw-tl hw-tl--max" cx="82" cy="30" r="4.5" />
        <text class="hw-title" x="260" y="34" text-anchor="middle">AutoSlides</text>

        <rect class="hw-sidebar" x="36" y="44" width="56" height="192" />
        <rect class="hw-nav hw-nav--on" x="48" y="58" width="32" height="8" rx="4" />
        <rect class="hw-nav" x="48" y="74" width="26" height="6" rx="3" />
        <rect class="hw-nav" x="48" y="88" width="28" height="6" rx="3" />
        <rect class="hw-nav" x="48" y="102" width="22" height="6" rx="3" />
        <rect class="hw-nav" x="48" y="200" width="18" height="6" rx="3" />

        <rect class="hw-screen" x="104" y="54" width="364" height="118" rx="8" />

        <g class="hw-slide hw-slide--a">
          <rect class="hw-bar" x="128" y="78" width="210" height="10" rx="5" />
          <rect class="hw-bar hw-bar--dim" x="128" y="98" width="128" height="8" rx="4" />
          <rect class="hw-bar hw-bar--dim" x="128" y="116" width="168" height="8" rx="4" />
        </g>
        <g class="hw-slide hw-slide--b">
          <rect class="hw-bar" x="128" y="78" width="146" height="10" rx="5" />
          <rect class="hw-bar hw-bar--dim" x="128" y="98" width="204" height="8" rx="4" />
          <rect class="hw-bar hw-bar--dim" x="128" y="116" width="116" height="8" rx="4" />
        </g>
        <g class="hw-slide hw-slide--c">
          <rect class="hw-bar" x="128" y="78" width="232" height="10" rx="5" />
          <rect class="hw-bar hw-bar--dim" x="128" y="98" width="102" height="8" rx="4" />
          <rect class="hw-bar hw-bar--dim" x="128" y="116" width="180" height="8" rx="4" />
        </g>

        <g class="hw-ghost">
          <rect class="hw-ghost-card" x="318" y="70" width="132" height="86" rx="8" />
          <rect class="hw-bar" x="332" y="88" width="96" height="8" rx="4" />
          <rect class="hw-bar hw-bar--dim" x="332" y="106" width="64" height="6" rx="3" />
          <text class="hw-ghost-label" x="384" y="142" text-anchor="middle">×</text>
        </g>

        <polygon class="hw-play" points="268,100 286,112 268,124" />

        <rect class="hw-strip" x="104" y="182" width="364" height="42" rx="8" />
        <rect class="hw-rail" x="118" y="192" width="336" height="3" rx="1.5" />
        <rect class="hw-playhead" x="118" y="188" width="3" height="11" rx="1.5" />

        <g class="hw-card hw-card--1">
          <rect class="hw-card-face" x="118" y="198" width="52" height="20" rx="4" />
          <rect class="hw-card-bar" x="124" y="204" width="28" height="3" rx="1.5" />
          <rect class="hw-card-bar hw-card-bar--dim" x="124" y="210" width="18" height="2.5" rx="1.2" />
        </g>
        <g class="hw-card hw-card--2">
          <rect class="hw-card-face" x="178" y="198" width="52" height="20" rx="4" />
          <rect class="hw-card-bar" x="184" y="204" width="20" height="3" rx="1.5" />
          <rect class="hw-card-bar hw-card-bar--dim" x="184" y="210" width="28" height="2.5" rx="1.2" />
        </g>
        <g class="hw-card hw-card--3">
          <rect class="hw-card-face" x="238" y="198" width="52" height="20" rx="4" />
          <rect class="hw-card-bar" x="244" y="204" width="32" height="3" rx="1.5" />
          <rect class="hw-card-bar hw-card-bar--dim" x="244" y="210" width="14" height="2.5" rx="1.2" />
        </g>
      </g>

      <text class="hw-cap hw-cap--1" x="260" y="258" text-anchor="middle">{{ $t('home.demoExtract') }}</text>
      <text class="hw-cap hw-cap--2" x="260" y="258" text-anchor="middle">{{ $t('home.demoTimeline') }}</text>
    </svg>
  </div>
</template>

<style scoped>
.hw-demo {
  width: min(520px, 100%);
  margin: 20px auto 0;
  --demo-dur: 16s;
}

.hw-art {
  display: block;
  width: 100%;
  height: auto;
  overflow: visible;
}

.hw-chrome {
  fill: var(--bg-surface);
  stroke: var(--border-color);
  stroke-width: 1;
}

.hw-titlebar,
.hw-titlebar-sq {
  fill: var(--bg-elevated);
}

.hw-tl--close { fill: var(--danger); }
.hw-tl--min { fill: var(--warning); }
.hw-tl--max { fill: var(--success); }

.hw-title {
  fill: var(--text-secondary);
  font-size: 11px;
  font-weight: 600;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
}

.hw-sidebar {
  fill: var(--bg-elevated);
}

.hw-nav {
  fill: var(--border-strong);
  opacity: 0.45;
}

.hw-nav--on {
  fill: var(--accent);
  opacity: 1;
}

.hw-screen {
  fill: var(--bg-page);
}

.hw-bar {
  fill: var(--text-secondary);
}

.hw-bar--dim {
  fill: var(--text-muted);
  opacity: 0.7;
}

.hw-play {
  fill: var(--accent);
  opacity: 0.85;
}

.hw-ghost-card {
  fill: var(--bg-surface);
  stroke: var(--danger);
  stroke-width: 1.2;
  stroke-dasharray: 4 3;
}

.hw-ghost-label {
  fill: var(--danger);
  font-size: 16px;
  font-weight: 700;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
}

.hw-strip {
  fill: var(--bg-elevated);
}

.hw-rail {
  fill: var(--border-color);
}

.hw-playhead {
  fill: var(--accent);
}

.hw-card-face {
  fill: var(--bg-surface);
  stroke: var(--border-color);
  stroke-width: 1;
}

.hw-card-bar {
  fill: var(--text-secondary);
}

.hw-card-bar--dim {
  fill: var(--text-muted);
}

.hw-cap {
  fill: var(--text-muted);
  font-size: 12px;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
}

.hw-window {
  animation: hw-window var(--demo-dur) ease-in-out infinite;
}

.hw-slide--a { animation: hw-slide-a var(--demo-dur) ease-in-out infinite; }
.hw-slide--b { animation: hw-slide-b var(--demo-dur) ease-in-out infinite; }
.hw-slide--c { animation: hw-slide-c var(--demo-dur) ease-in-out infinite; }
.hw-ghost { animation: hw-ghost var(--demo-dur) ease-in-out infinite; transform-origin: 384px 113px; }
.hw-card--1 { animation: hw-card-1 var(--demo-dur) ease-in-out infinite; transform-box: fill-box; transform-origin: center; }
.hw-card--2 { animation: hw-card-2 var(--demo-dur) ease-in-out infinite; transform-box: fill-box; transform-origin: center; }
.hw-card--3 { animation: hw-card-3 var(--demo-dur) ease-in-out infinite; transform-box: fill-box; transform-origin: center; }
.hw-rail { animation: hw-rail var(--demo-dur) ease-in-out infinite; }
.hw-playhead { animation: hw-playhead var(--demo-dur) ease-in-out infinite; }
.hw-cap--1 { animation: hw-cap-1 var(--demo-dur) ease-in-out infinite; }
.hw-cap--2 { animation: hw-cap-2 var(--demo-dur) ease-in-out infinite; }

@keyframes hw-window {
  0% { opacity: 0; transform: translateY(8px); }
  6%, 92% { opacity: 1; transform: none; }
  100% { opacity: 0; transform: translateY(8px); }
}

@keyframes hw-slide-a {
  0%, 6% { opacity: 0; }
  10%, 24% { opacity: 1; }
  30%, 100% { opacity: 0; }
}

@keyframes hw-slide-b {
  0%, 28% { opacity: 0; }
  34%, 46% { opacity: 1; }
  52%, 100% { opacity: 0; }
}

@keyframes hw-slide-c {
  0%, 50% { opacity: 0; }
  56%, 90% { opacity: 1; }
  100% { opacity: 0; }
}

@keyframes hw-ghost {
  0%, 20% { opacity: 0; transform: scale(0.92); }
  24% { opacity: 0.95; transform: scale(1); }
  32% { opacity: 0; transform: scale(0.96) translateY(6px); }
  100% { opacity: 0; }
}

@keyframes hw-card-1 {
  0%, 12% { opacity: 0; transform: scale(0.8); }
  16%, 62% { opacity: 1; transform: scale(1); }
  66% { opacity: 1; transform: scale(1.08); }
  72%, 90% { opacity: 1; transform: scale(1); }
  100% { opacity: 0; }
}

@keyframes hw-card-2 {
  0%, 34% { opacity: 0; transform: scale(0.8); }
  38%, 70% { opacity: 1; transform: scale(1); }
  74% { opacity: 1; transform: scale(1.08); }
  80%, 90% { opacity: 1; transform: scale(1); }
  100% { opacity: 0; }
}

@keyframes hw-card-3 {
  0%, 54% { opacity: 0; transform: scale(0.8); }
  58%, 78% { opacity: 1; transform: scale(1); }
  82% { opacity: 1; transform: scale(1.08); }
  88%, 90% { opacity: 1; transform: scale(1); }
  100% { opacity: 0; }
}

@keyframes hw-rail {
  0%, 58% { opacity: 0; }
  64%, 90% { opacity: 1; }
  100% { opacity: 0; }
}

@keyframes hw-playhead {
  0%, 60% { opacity: 0; transform: translateX(0); }
  64% { opacity: 1; transform: translateX(0); }
  88% { opacity: 1; transform: translateX(176px); }
  92%, 100% { opacity: 0; transform: translateX(176px); }
}

@keyframes hw-cap-1 {
  0%, 8% { opacity: 0; }
  12%, 52% { opacity: 1; }
  58%, 100% { opacity: 0; }
}

@keyframes hw-cap-2 {
  0%, 56% { opacity: 0; }
  62%, 88% { opacity: 1; }
  94%, 100% { opacity: 0; }
}

@media (prefers-reduced-motion: reduce) {
  .hw-window,
  .hw-slide--a,
  .hw-slide--b,
  .hw-slide--c,
  .hw-ghost,
  .hw-card--1,
  .hw-card--2,
  .hw-card--3,
  .hw-rail,
  .hw-playhead,
  .hw-cap--1,
  .hw-cap--2 {
    animation: none;
  }

  .hw-window,
  .hw-slide--c,
  .hw-card--1,
  .hw-card--2,
  .hw-card--3,
  .hw-rail,
  .hw-playhead,
  .hw-cap--2 {
    opacity: 1;
  }

  .hw-slide--a,
  .hw-slide--b,
  .hw-ghost,
  .hw-cap--1 {
    opacity: 0;
  }

  .hw-playhead {
    transform: translateX(88px);
  }
}
</style>
