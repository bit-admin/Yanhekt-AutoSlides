<template>
  <div class="apps-page custom-scrollbar">
    <!-- Slim chrome: this page opens in its own tab, so the only navigation
         it owes the reader is a way back into the web app. -->
    <header class="topbar">
      <a class="brand" href="/">
        <svg class="brand-mark" width="30" height="22" viewBox="0 0 30 22" fill="none" aria-hidden="true">
          <rect width="30" height="22" rx="5" fill="#FF0000" />
          <polygon points="12,6 20,11 12,16" fill="white" />
          <line x1="6" y1="18" x2="24" y2="18" stroke="white" stroke-width="1.5" stroke-linecap="round" />
        </svg>
        <span class="brand-text">AutoSlides</span>
      </a>
      <a class="topbar-link" :href="ORG_URL" target="_blank" rel="noopener noreferrer">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
          <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
        </svg>
        <span>{{ $t('apps.viewOnGitHub') }}</span>
      </a>
    </header>

    <main class="page-body">
      <!-- Hero: the ribbon is the thesis — a lecture is mostly repeated frames,
           and both apps keep only the ones where the slide actually changed. -->
      <section class="hero">
        <p class="eyebrow">{{ $t('apps.eyebrow') }}</p>
        <h1 class="hero-title">
          <span class="hero-title-in">{{ $t('apps.heroTitleIn') }}</span>
          <span class="hero-title-out">{{ $t('apps.heroTitleOut') }}</span>
        </h1>
        <p class="hero-lead">{{ $t('apps.heroLead') }}</p>

        <div class="ribbon" aria-hidden="true">
          <span
            v-for="(frame, i) in FRAMES"
            :key="i"
            class="frame"
            :class="frame.kept ? 'frame--kept' : 'frame--dropped'"
            :style="{ '--i': i }"
          >
            <!-- Every frame carries its slide's glyph; the glyph only changes on
                 a kept frame, so the pattern shows why that frame was kept. -->
            <i v-for="(w, b) in frame.glyph" :key="b" class="glyph" :style="{ '--w': `${w}%` }" />
          </span>
        </div>
        <p class="ribbon-caption">{{ $t('apps.ribbonCaption') }}</p>
      </section>

      <!-- The fork: the two apps aren't ranked, they're answers to one question. -->
      <section class="fork">
        <h2 class="section-title">{{ $t('apps.forkTitle') }}</h2>
        <p class="section-lead">{{ $t('apps.forkLead') }}</p>

        <div class="cards">
          <article v-for="app in APPS" :key="app.id" class="card" :class="`card--${app.id}`">
            <p class="card-input">
              <svg class="card-input-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path v-if="app.id === 'autoslides'" d="m23 7-3 2v-4a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-4l3 2z" />
                <template v-else>
                  <path d="M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z" />
                  <polygon points="10 9 15 12 10 15" />
                </template>
              </svg>
              {{ $t(`apps.${app.id}.input`) }}
            </p>

            <h3 class="card-name">{{ app.name }}</h3>
            <p class="card-blurb">{{ $t(`apps.${app.id}.blurb`) }}</p>

            <ul class="card-tech">
              <li v-for="tech in app.tech" :key="tech">{{ tech }}</li>
            </ul>

            <!-- Release + downloads -->
            <div class="card-release">
              <div v-if="state[app.id].status === 'loading'" class="release-loading">
                <span class="spinner" aria-hidden="true" />
                <span>{{ $t('apps.loading') }}</span>
              </div>

              <div v-else-if="state[app.id].status === 'error'" class="release-error">
                <p class="release-error-text">{{ $t('apps.errorBody') }}</p>
                <div class="release-error-actions">
                  <button type="button" class="pill pill--ghost" @click="load(app)">
                    {{ $t('apps.retry') }}
                  </button>
                  <a class="pill pill--ghost" :href="app.releasesUrl" target="_blank" rel="noopener noreferrer">
                    {{ $t('apps.openReleases') }}
                  </a>
                </div>
              </div>

              <template v-else-if="state[app.id].release">
                <div class="release-head">
                  <span class="version">v{{ state[app.id].release!.version }}</span>
                  <span class="release-date">{{ formatDate(state[app.id].release!.publishedAt) }}</span>
                </div>

                <!-- Assets for the visitor's own OS come first and unfolded;
                     the rest stay one disclosure away rather than hidden. -->
                <div v-if="primaryAssets(app.id).length" class="asset-group">
                  <p class="asset-group-label">
                    {{ $t('apps.forYourPlatform', { platform: platformLabel(platform) }) }}
                  </p>
                  <AssetRow
                    v-for="asset in primaryAssets(app.id)"
                    :key="asset.name"
                    :asset="asset"
                    :accent="app.id"
                  />
                </div>

                <details v-if="otherAssets(app.id).length" class="asset-more">
                  <summary>
                    {{ primaryAssets(app.id).length ? $t('apps.otherPlatforms') : $t('apps.allDownloads') }}
                    <svg class="asset-more-chevron" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                      <polyline points="6 9 12 15 18 9" />
                    </svg>
                  </summary>
                  <AssetRow
                    v-for="asset in otherAssets(app.id)"
                    :key="asset.name"
                    :asset="asset"
                    :accent="app.id"
                  />
                </details>
              </template>
            </div>
          </article>
        </div>

        <p class="fork-note">{{ $t('apps.mirrorHint') }}</p>
      </section>

      <!-- Docs -->
      <section class="docs">
        <div class="docs-head">
          <h2 class="section-title">{{ $t('apps.documentation') }}</h2>
          <div class="tabs" role="tablist">
            <button
              v-for="app in APPS"
              :key="app.id"
              type="button"
              role="tab"
              :aria-selected="activeTab === app.id"
              :class="['tab', `tab--${app.id}`, { 'tab--active': activeTab === app.id }]"
              @click="activeTab = app.id"
            >
              {{ app.name }}
            </button>
          </div>
        </div>

        <!-- v-for lives on the template, not on the panel: with v-for and
             v-show on one element the directive stops being re-applied on
             update, so the tab highlight moved but the panel never switched. -->
        <template v-for="app in APPS" :key="app.id">
          <div v-show="activeTab === app.id" class="docs-panel" role="tabpanel">
            <!-- What's new -->
            <div v-if="state[app.id].release?.notesHtml" class="notes">
              <div class="notes-head">
                <h3 class="notes-title">
                  {{ $t('apps.whatsNew', { version: `v${state[app.id].release!.version}` }) }}
                </h3>
                <a class="notes-link" :href="state[app.id].release!.htmlUrl" target="_blank" rel="noopener noreferrer">
                  {{ $t('apps.releaseNotes') }}
                </a>
              </div>
              <div class="notes-body markdown-body" v-html="state[app.id].release!.notesHtml" />
            </div>

            <!-- README -->
            <div v-if="state[app.id].readmeStatus === 'loading'" class="readme-loading">
              <span class="spinner" aria-hidden="true" />
              <span>{{ $t('apps.loading') }}</span>
            </div>
            <div v-else-if="state[app.id].readmeStatus === 'error'" class="readme-error">
              <p>{{ $t('apps.readmeErrorBody') }}</p>
              <a class="pill pill--ghost" :href="app.repoUrl" target="_blank" rel="noopener noreferrer">
                {{ $t('apps.viewOnGitHub') }}
              </a>
            </div>
            <div v-else class="readme markdown-body" v-html="state[app.id].readmeHtml" />
          </div>
        </template>
      </section>

      <footer class="page-foot">
        <p>{{ $t('apps.disclaimer') }}</p>
      </footer>
    </main>
  </div>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import AssetRow from './apps/AssetRow.vue'
import {
  detectPlatform,
  fetchLatestRelease,
  fetchReadmeHtml,
  platformLabel,
  type Platform,
  type Release,
  type ReleaseAsset,
} from '../lib/github'
import '../assets/github-markdown.css'
import '../assets/github-markdown-theme.css'

const { locale } = useI18n()

type AppId = 'autoslides' | 'extractor'

interface AppDef {
  id: AppId
  name: string
  owner: string
  repo: string
  tech: string[]
  repoUrl: string
  releasesUrl: string
}

const ORG_URL = 'https://github.com/bit-admin'

const APPS: AppDef[] = [
  {
    id: 'autoslides',
    name: 'AutoSlides',
    owner: 'bit-admin',
    repo: 'Yanhekt-AutoSlides',
    tech: ['Electron', 'Vue', 'TypeScript'],
    repoUrl: 'https://github.com/bit-admin/Yanhekt-AutoSlides',
    releasesUrl: 'https://github.com/bit-admin/Yanhekt-AutoSlides/releases',
  },
  {
    id: 'extractor',
    name: 'AutoSlides Extractor',
    owner: 'bit-admin',
    repo: 'AutoSlides-Extractor',
    tech: ['C++17', 'Qt 6', 'OpenCV'],
    repoUrl: 'https://github.com/bit-admin/AutoSlides-Extractor',
    releasesUrl: 'https://github.com/bit-admin/AutoSlides-Extractor/releases',
  },
]

/**
 * The hero ribbon. A lecture is long runs of near-identical frames, so the
 * strip is built from runs: every frame in a run repeats the same slide glyph,
 * and only the first frame of each run — where the slide actually changed — is
 * kept. Run lengths are uneven because real lectures are.
 */
const SLIDE_GLYPHS = [
  [72, 44, 58],
  [54, 68, 36],
  [80, 38, 62],
  [46, 60, 50],
  [66, 34, 70],
]
const RUN_LENGTHS = [3, 4, 2, 3, 2]

const FRAMES = RUN_LENGTHS.flatMap((length, run) =>
  Array.from({ length }, (_, i) => ({ kept: i === 0, glyph: SLIDE_GLYPHS[run] })),
)

interface AppState {
  status: 'loading' | 'ready' | 'error'
  release: Release | null
  readmeStatus: 'loading' | 'ready' | 'error'
  readmeHtml: string
}

const state = reactive<Record<AppId, AppState>>({
  autoslides: { status: 'loading', release: null, readmeStatus: 'loading', readmeHtml: '' },
  extractor: { status: 'loading', release: null, readmeStatus: 'loading', readmeHtml: '' },
})

const activeTab = ref<AppId>('autoslides')
const platform = ref<Platform>('other')

const primaryAssets = (id: AppId): ReleaseAsset[] =>
  state[id].release?.assets.filter((a) => a.platform === platform.value) ?? []

const otherAssets = (id: AppId): ReleaseAsset[] =>
  state[id].release?.assets.filter((a) => a.platform !== platform.value) ?? []

const formatDate = (iso: string): string => {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString(locale.value === 'zh' ? 'zh-CN' : 'en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

/** Release and README load independently so one failing doesn't blank the other. */
async function load(app: AppDef): Promise<void> {
  const ref_ = { owner: app.owner, repo: app.repo }

  state[app.id].status = 'loading'
  fetchLatestRelease(ref_)
    .then((release) => {
      state[app.id].release = release
      state[app.id].status = 'ready'
    })
    .catch(() => {
      state[app.id].status = 'error'
    })

  state[app.id].readmeStatus = 'loading'
  fetchReadmeHtml(ref_)
    .then((html) => {
      state[app.id].readmeHtml = html
      state[app.id].readmeStatus = 'ready'
    })
    .catch(() => {
      state[app.id].readmeStatus = 'error'
    })
}

onMounted(() => {
  platform.value = detectPlatform()
  APPS.forEach(load)
})
</script>

<style scoped>
/* Page-local accents. Each app's colour comes from its own identity: AutoSlides
   keeps the app red; the Extractor uses the OpenCV violet off its own README
   badges.
   Two variants per app, because one colour can't do both jobs: `--app-*` is ink
   on the page background and gets lighter in dark mode to stay legible, while
   `--app-*-solid` sits behind white button text and must stay dark enough for
   it in either theme. */
.apps-page {
  --app-autoslides: #e00000;
  --app-extractor: #5c3ee8;
  --app-autoslides-solid: #d40000;
  --app-extractor-solid: #5233dd;
  --frame-lit: var(--text-primary);
  height: 100vh;
  overflow-y: auto;
  background-color: var(--bg-page);
  color: var(--text-primary);
}

html[data-theme='dark'] .apps-page {
  --app-autoslides: #ff5252;
  --app-extractor: #9179ff;
  --app-autoslides-solid: #c81e1e;
  --app-extractor-solid: #5233dd;
}

/* ---------- chrome ---------- */

.topbar {
  position: sticky;
  top: 0;
  z-index: 20;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  height: var(--header-height);
  padding: 0 1.5rem;
  /* Opaque: a translucent bar let the headings smear through it on scroll. */
  background-color: var(--bg-page);
  border-bottom: 1px solid var(--border-color);
}

.brand {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  text-decoration: none;
  color: var(--text-primary);
}

.brand-text {
  font-size: 1.125rem;
  font-weight: 600;
  letter-spacing: -0.04em;
}

.topbar-link {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.4rem 0.75rem;
  border-radius: 1rem;
  color: var(--text-secondary);
  font-size: 0.8125rem;
  text-decoration: none;
  transition: background-color 0.15s, color 0.15s;
}

.topbar-link:hover {
  background-color: var(--bg-hover);
  color: var(--text-primary);
}

.page-body {
  max-width: 68rem;
  margin: 0 auto;
  padding: 0 1.5rem 4rem;
}

/* ---------- hero ---------- */

.hero {
  padding: 4.5rem 0 3rem;
  text-align: center;
}

.eyebrow {
  margin: 0 0 1rem;
  font-size: 0.75rem;
  font-weight: 600;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--text-muted);
}

/* Two lines, because it's two halves of one transformation: the second is set
   back so the sentence reads as in → out rather than as one long headline. */
.hero-title {
  margin: 0;
  font-size: clamp(2rem, 5.5vw, 3.5rem);
  font-weight: 700;
  line-height: 1.08;
  letter-spacing: -0.045em;
}

.hero-title-in,
.hero-title-out {
  display: block;
}

.hero-title-out {
  color: var(--text-muted);
}

.hero-lead {
  margin: 1.25rem auto 0;
  max-width: 46ch;
  font-size: 1.0625rem;
  line-height: 1.6;
  color: var(--text-secondary);
}

/* The signature: a filmstrip of lecture frames. Duplicates ghost back, and the
   frames that survive are exactly the ones where the glyph changes. */
/* The whole strip scales off --frame-w so all 14 frames fit a 390px phone
   without the row ever scrolling. */
.ribbon {
  --frame-w: clamp(1.25rem, 4.2vw, 3.25rem);
  display: flex;
  align-items: center;
  justify-content: center;
  gap: calc(var(--frame-w) * 0.12);
  margin: 2.75rem 0 1.25rem;
}

/* Padding and gap are derived from --frame-w, not set in %: percentage padding
   resolves against the parent's width, which blows the frames out. */
.frame {
  display: flex;
  flex-direction: column;
  justify-content: center;
  flex: none;
  gap: calc(var(--frame-w) * 0.1);
  width: var(--frame-w);
  height: calc(var(--frame-w) * 0.68);
  padding: 0 calc(var(--frame-w) * 0.16);
  border: 1px solid var(--border-strong);
  border-radius: 0.1875rem;
  animation: frame-settle 520ms cubic-bezier(0.4, 0, 0.2, 1) both;
  animation-delay: calc(var(--i) * 45ms);
}

.glyph {
  width: var(--w);
  height: max(1px, calc(var(--frame-w) * 0.032));
  border-radius: 1px;
  background-color: var(--frame-lit);
}

/* Ghosted is the resting state, so with animation suppressed the strip still
   reads as "most frames were dropped". */
.frame--dropped {
  background-color: transparent;
  opacity: 0.28;
  transform: scale(0.86);
}

.frame--kept {
  background-color: var(--bg-surface);
  box-shadow: 0 0.125rem 0.75rem color-mix(in srgb, var(--frame-lit) 14%, transparent);
}

.frame--kept .glyph:first-child {
  height: max(1.5px, calc(var(--frame-w) * 0.055));
}

@keyframes frame-settle {
  from {
    opacity: 1;
    transform: scale(1);
  }
}

.ribbon-caption {
  margin: 0;
  font-size: 0.8125rem;
  color: var(--text-muted);
}

/* ---------- fork ---------- */

.fork {
  padding: 2rem 0 1rem;
}

.section-title {
  margin: 0;
  font-size: clamp(1.5rem, 3vw, 2rem);
  font-weight: 700;
  letter-spacing: -0.035em;
}

.section-lead {
  margin: 0.5rem 0 2rem;
  color: var(--text-secondary);
  font-size: 0.9375rem;
}

.cards {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 1.25rem;
}

.card {
  --accent-app: var(--app-autoslides);
  position: relative;
  display: flex;
  flex-direction: column;
  padding: 1.75rem;
  border: 1px solid var(--border-color);
  border-radius: 1rem;
  background-color: var(--bg-surface);
  overflow: hidden;
}

.card--extractor {
  --accent-app: var(--app-extractor);
}

/* The colour rule is the only place each app's identity is asserted. */
.card::before {
  content: '';
  position: absolute;
  inset: 0 0 auto;
  height: 3px;
  background-color: var(--accent-app);
}

.card-input {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  align-self: flex-start;
  margin: 0 0 1rem;
  padding: 0.3rem 0.6rem 0.3rem 0.45rem;
  border-radius: 1rem;
  background-color: color-mix(in srgb, var(--accent-app) 12%, transparent);
  color: var(--accent-app);
  font-size: 0.75rem;
  font-weight: 600;
}

.card-input-icon {
  flex-shrink: 0;
}

.card-name {
  margin: 0;
  font-size: 1.5rem;
  font-weight: 700;
  letter-spacing: -0.03em;
}

.card-blurb {
  margin: 0.75rem 0 0;
  font-size: 0.9375rem;
  line-height: 1.65;
  color: var(--text-secondary);
}

.card-tech {
  display: flex;
  flex-wrap: wrap;
  gap: 0.375rem;
  margin: 1.25rem 0 0;
  padding: 0;
  list-style: none;
}

.card-tech li {
  padding: 0.2rem 0.5rem;
  border: 1px solid var(--border-color);
  border-radius: 0.375rem;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 0.6875rem;
  color: var(--text-muted);
}

.card-release {
  margin-top: 1.5rem;
  padding-top: 1.25rem;
  border-top: 1px solid var(--border-color);
}

.release-head {
  display: flex;
  align-items: baseline;
  gap: 0.625rem;
  margin-bottom: 1rem;
}

.version {
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 1rem;
  font-weight: 600;
  color: var(--text-primary);
}

.release-date {
  font-size: 0.8125rem;
  color: var(--text-muted);
}

.asset-group-label {
  margin: 0 0 0.5rem;
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--text-secondary);
}

.asset-more {
  margin-top: 0.75rem;
}

.asset-more summary {
  display: flex;
  align-items: center;
  gap: 0.3rem;
  padding: 0.375rem 0;
  color: var(--text-secondary);
  font-size: 0.8125rem;
  cursor: pointer;
  list-style: none;
}

.asset-more summary::-webkit-details-marker {
  display: none;
}

.asset-more summary:hover {
  color: var(--text-primary);
}

.asset-more-chevron {
  transition: transform 0.15s;
}

.asset-more[open] .asset-more-chevron {
  transform: rotate(180deg);
}

.fork-note {
  margin: 1.25rem 0 0;
  font-size: 0.75rem;
  color: var(--text-muted);
  text-align: center;
}

/* ---------- release/readme states ---------- */

.release-loading,
.readme-loading {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  color: var(--text-muted);
  font-size: 0.875rem;
}

.readme-loading {
  padding: 3rem 0;
  justify-content: center;
}

.spinner {
  width: 0.875rem;
  height: 0.875rem;
  border: 2px solid var(--border-strong);
  border-top-color: var(--text-secondary);
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.release-error-text {
  margin: 0 0 0.75rem;
  font-size: 0.8125rem;
  line-height: 1.5;
  color: var(--text-secondary);
}

.release-error-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.readme-error {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.875rem;
  padding: 3rem 0;
  color: var(--text-secondary);
  font-size: 0.875rem;
}

.pill {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.375rem;
  padding: 0.4rem 0.875rem;
  border-radius: 1rem;
  border: 1px solid var(--border-input);
  background: transparent;
  color: var(--text-primary);
  font-size: 0.8125rem;
  font-weight: 500;
  text-decoration: none;
  cursor: pointer;
  transition: background-color 0.15s;
}

.pill--ghost:hover {
  background-color: var(--bg-hover);
}

/* ---------- docs ---------- */

.docs {
  padding-top: 3.5rem;
}

.docs-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 1rem;
  margin-bottom: 1.5rem;
}

.tabs {
  display: flex;
  gap: 0.375rem;
  padding: 0.25rem;
  border-radius: 1.25rem;
  background-color: var(--bg-elevated);
}

.tab {
  padding: 0.4rem 0.875rem;
  border: none;
  border-radius: 1rem;
  background: transparent;
  color: var(--text-secondary);
  font-size: 0.8125rem;
  font-weight: 500;
  cursor: pointer;
  transition: background-color 0.15s, color 0.15s;
}

.tab:hover {
  color: var(--text-primary);
}

/* The active tab carries its app's colour in the label, matching the card rule
   it belongs to. An outline here read as an error state. */
.tab--active {
  background-color: var(--bg-surface);
  box-shadow: var(--shadow-sm);
}

.tab--autoslides.tab--active,
.tab--autoslides.tab--active:hover {
  color: var(--app-autoslides);
}

.tab--extractor.tab--active,
.tab--extractor.tab--active:hover {
  color: var(--app-extractor);
}

.notes {
  margin-bottom: 1.25rem;
  border: 1px solid var(--border-color);
  border-radius: 0.75rem;
  background-color: var(--bg-surface);
  overflow: hidden;
}

.notes-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.875rem 1.25rem;
  border-bottom: 1px solid var(--border-color);
}

.notes-title {
  margin: 0;
  font-size: 0.9375rem;
  font-weight: 600;
}

.notes-link {
  color: var(--accent-deep);
  font-size: 0.8125rem;
  text-decoration: none;
}

.notes-link:hover {
  text-decoration: underline;
}

.notes-body {
  max-height: 22rem;
  overflow-y: auto;
  padding: 1.25rem;
}

.readme {
  padding: 2rem;
  border: 1px solid var(--border-color);
  border-radius: 0.75rem;
}

/* The vendored stylesheet paints its own GitHub-coloured canvas; the page
   supplies the surface so the README sits on the same background as the cards. */
.notes-body.markdown-body,
.readme.markdown-body {
  background-color: var(--bg-surface);
}

.page-foot {
  margin-top: 3.5rem;
  padding-top: 1.5rem;
  border-top: 1px solid var(--border-color);
  color: var(--text-muted);
  font-size: 0.75rem;
  line-height: 1.6;
  text-align: center;
}

.page-foot p {
  margin: 0;
}

/* ---------- responsive ---------- */

@media (max-width: 860px) {
  .cards {
    grid-template-columns: minmax(0, 1fr);
  }

  .hero {
    padding: 3rem 0 2.5rem;
  }

  .ribbon {
    margin: 2.25rem 0 1rem;
  }

  .readme {
    padding: 1.25rem;
  }
}

@media (prefers-reduced-motion: reduce) {
  .frame {
    animation: none;
  }

  .spinner {
    animation-duration: 2s;
  }
}
</style>
