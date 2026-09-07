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
          <path :d="GITHUB_PATH" />
        </svg>
        <span>{{ $t('apps.viewOnGitHub') }}</span>
      </a>
    </header>

    <main class="page-body">
      <!-- Hero: name, one sentence, the one button that matters, then the app
           introducing itself in its own window. -->
      <section class="hero">
        <h1 class="hero-title">AutoSlides</h1>
        <p class="hero-lead">{{ $t('apps.autoslides.lead') }}</p>

        <div class="cta-row">
          <DownloadButton :app="APPS[0]" :state="state.autoslides" :platform="platform" @all="scrollTo('downloads')" />
          <button type="button" class="cta cta--secondary" @click="scrollTo('docs')">
            {{ $t('apps.readDocs') }}
          </button>
        </div>
        <p class="availability">{{ availability(state.autoslides) }}</p>

        <p class="ways-title">{{ $t('apps.otherWays') }}</p>
        <ul class="tiles">
          <li>
            <a class="tile" href="/">
              <svg class="tile-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <circle cx="12" cy="12" r="9" />
                <path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" />
              </svg>
              <span>{{ $t('apps.tiles.web') }}</span>
            </a>
          </li>
          <li v-for="p in PLATFORMS" :key="p">
            <button type="button" class="tile" @click="scrollTo('downloads')">
              <svg v-if="p === 'macos'" class="tile-icon" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M16.37 12.7c-.02-2.2 1.8-3.26 1.88-3.31-1.02-1.5-2.62-1.7-3.18-1.73-1.36-.14-2.65.8-3.34.8-.69 0-1.75-.78-2.87-.76-1.48.02-2.84.86-3.6 2.18-1.54 2.67-.4 6.62 1.1 8.79.73 1.06 1.6 2.25 2.75 2.2 1.1-.04 1.52-.71 2.85-.71s1.71.71 2.87.69c1.19-.02 1.94-1.08 2.66-2.15.84-1.23 1.19-2.42 1.2-2.48-.03-.01-2.3-.88-2.32-3.52zM14.19 6.24c.6-.74 1.01-1.76.9-2.78-.87.04-1.93.58-2.55 1.31-.56.65-1.05 1.7-.92 2.7.97.08 1.96-.5 2.57-1.23z" />
              </svg>
              <svg v-else-if="p === 'windows'" class="tile-icon" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M3 5.5 11 4.4v7.1H3zM12 4.25 21 3v8.5h-9zM3 12.5h8v7.1L3 18.5zM12 12.5h9V21l-9-1.25z" />
              </svg>
              <svg v-else class="tile-icon" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M12 2.5c-2.3 0-3.8 1.9-3.8 4.6 0 1.1-.3 2-.9 3.1-.9 1.6-2.1 3.2-2.1 5.2 0 .6.1 1.1.3 1.6-.7.3-1.3.8-1.3 1.5 0 .9 1 1.4 2.2 1.6.6 1 1.9 1.4 3 1.4.9 0 1.7-.2 2.6-.2s1.7.2 2.6.2c1.1 0 2.4-.4 3-1.4 1.2-.2 2.2-.7 2.2-1.6 0-.7-.6-1.2-1.3-1.5.2-.5.3-1 .3-1.6 0-2-1.2-3.6-2.1-5.2-.6-1.1-.9-2-.9-3.1 0-2.7-1.5-4.6-3.8-4.6zm-1.2 3.6c.5 0 .8.5.8 1.1s-.3 1.1-.8 1.1-.8-.5-.8-1.1.3-1.1.8-1.1zm2.4 0c.5 0 .8.5.8 1.1s-.3 1.1-.8 1.1-.8-.5-.8-1.1.3-1.1.8-1.1zM12 8.6c.9 0 2 .5 2 1s-1.1 1.2-2 1.2-2-.7-2-1.2 1.1-1 2-1zm0 3.4c1.9 0 3.2 2.6 3.2 4.6 0 1.2-.5 2.2-1.4 2.6h-3.6c-.9-.4-1.4-1.4-1.4-2.6 0-2 1.3-4.6 3.2-4.6z" />
              </svg>
              <span>{{ platformLabel(p) }}</span>
            </button>
          </li>
          <li>
            <button type="button" class="tile" @click="scrollTo('extractor')">
              <svg class="tile-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <rect x="3" y="5" width="18" height="14" rx="2" />
                <path d="M7 5v14M17 5v14M3 10h4M3 14h4M17 10h4M17 14h4" />
              </svg>
              <span>{{ $t('apps.tiles.extractor') }}</span>
            </button>
          </li>
          <li>
            <a class="tile" :href="APPS[0].repoUrl" target="_blank" rel="noopener noreferrer">
              <svg class="tile-icon" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
                <path :d="GITHUB_PATH" />
              </svg>
              <span>{{ $t('apps.tiles.github') }}</span>
            </a>
          </li>
        </ul>

        <!-- The app's own signed-out Home, in a window. -->
        <div class="window">
          <div class="window-bar" aria-hidden="true">
            <span /><span /><span />
          </div>
          <WelcomeDemo class="window-demo" />
        </div>
      </section>

      <!-- The second app, same shape, smaller. -->
      <section :ref="setSection('extractor')" class="second">
        <h2 class="second-title">AutoSlides Extractor</h2>
        <p class="hero-lead">{{ $t('apps.extractor.lead') }}</p>
        <div class="cta-row">
          <DownloadButton :app="APPS[1]" :state="state.extractor" :platform="platform" @all="scrollTo('downloads')" />
          <a class="cta cta--secondary" :href="APPS[1].repoUrl" target="_blank" rel="noopener noreferrer">
            {{ $t('apps.readDocs') }}
          </a>
        </div>
        <p class="availability">{{ availability(state.extractor) }}</p>
      </section>

      <!-- Every file of both releases, with the mirror. -->
      <section :ref="setSection('downloads')" class="downloads">
        <h2 class="section-title">{{ $t('apps.downloadsTitle') }}</h2>
        <p class="section-lead">{{ $t('apps.mirrorHint') }}</p>

        <div class="download-groups">
          <div v-for="app in APPS" :key="app.id" class="download-group" :class="`download-group--${app.id}`">
            <div class="download-head">
              <h3 class="download-name">{{ app.name }}</h3>
              <span v-if="state[app.id].release" class="download-version">
                v{{ state[app.id].release!.version }}
                <span class="download-date">{{ formatDate(state[app.id].release!.publishedAt) }}</span>
              </span>
            </div>

            <div v-if="state[app.id].status === 'loading'" class="muted">
              <span class="spinner" aria-hidden="true" />
              {{ $t('apps.loading') }}
            </div>
            <div v-else-if="state[app.id].status === 'error'" class="release-error">
              <p class="release-error-text">{{ $t('apps.errorBody') }}</p>
              <div class="release-error-actions">
                <button type="button" class="pill" @click="load(app)">{{ $t('apps.retry') }}</button>
                <a class="pill" :href="app.releasesUrl" target="_blank" rel="noopener noreferrer">
                  {{ $t('apps.openReleases') }}
                </a>
              </div>
            </div>
            <template v-else>
              <AssetRow
                v-for="asset in sortedAssets(app.id)"
                :key="asset.name"
                :asset="asset"
                :accent="app.id"
              />
            </template>
          </div>
        </div>
      </section>

      <!-- Docs -->
      <section :ref="setSection('docs')" class="docs">
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

            <div v-if="state[app.id].readmeStatus === 'loading'" class="readme-loading">
              <span class="spinner" aria-hidden="true" />
              <span>{{ $t('apps.loading') }}</span>
            </div>
            <div v-else-if="state[app.id].readmeStatus === 'error'" class="readme-error">
              <p>{{ $t('apps.readmeErrorBody') }}</p>
              <a class="pill" :href="app.repoUrl" target="_blank" rel="noopener noreferrer">
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
import { localeTag, type AppLocale } from '../i18n'
import AssetRow from './apps/AssetRow.vue'
import DownloadButton from './apps/DownloadButton.vue'
import WelcomeDemo from './apps/WelcomeDemo.vue'
import { type AppDef, type AppId, type AppState, GITHUB_PATH } from './apps/appsModel'
import {
  detectPlatform,
  fetchLatestRelease,
  fetchReadmeHtml,
  platformLabel,
  type Platform,
  type ReleaseAsset,
} from '../lib/github'
import '../assets/github-markdown.css'
import '../assets/github-markdown-theme.css'

const { locale, t } = useI18n()

const ORG_URL = 'https://github.com/bit-admin'

const APPS: AppDef[] = [
  {
    id: 'autoslides',
    name: 'AutoSlides',
    owner: 'bit-admin',
    repo: 'Yanhekt-AutoSlides',
    repoUrl: 'https://github.com/bit-admin/Yanhekt-AutoSlides',
    releasesUrl: 'https://github.com/bit-admin/Yanhekt-AutoSlides/releases',
  },
  {
    id: 'extractor',
    name: 'AutoSlides Extractor',
    owner: 'bit-admin',
    repo: 'AutoSlides-Extractor',
    repoUrl: 'https://github.com/bit-admin/AutoSlides-Extractor',
    releasesUrl: 'https://github.com/bit-admin/AutoSlides-Extractor/releases',
  },
]

const PLATFORMS: Platform[] = ['macos', 'windows', 'linux']

const state = reactive<Record<AppId, AppState>>({
  autoslides: { status: 'loading', release: null, readmeStatus: 'loading', readmeHtml: '' },
  extractor: { status: 'loading', release: null, readmeStatus: 'loading', readmeHtml: '' },
})

const activeTab = ref<AppId>('autoslides')
const platform = ref<Platform>('other')

/* In-page navigation. The page is its own scroll container, so a plain
   fragment link would fight the router; the sections register themselves. */
const sections: Partial<Record<'extractor' | 'downloads' | 'docs', HTMLElement>> = {}
const setSection = (id: keyof typeof sections) => (el: unknown) => {
  if (el instanceof HTMLElement) sections[id] = el
}
function scrollTo(id: keyof typeof sections): void {
  sections[id]?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

/** The visitor's platform first, then the rest in the release's order. */
const sortedAssets = (id: AppId): ReleaseAsset[] => {
  const assets = state[id].release?.assets ?? []
  return [...assets.filter((a) => a.platform === platform.value), ...assets.filter((a) => a.platform !== platform.value)]
}

/** "Available for macOS, Windows, and Linux. v4.4.1, June 19, 2026." */
function availability(s: AppState): string {
  if (!s.release) return s.status === 'error' ? t('apps.errorBody') : t('apps.loading')
  const seen = new Set(s.release.assets.map((a) => a.platform))
  const names = PLATFORMS.filter((p) => seen.has(p)).map(platformLabel)
  const tag = localeTag(locale.value as AppLocale)
  const list = names.length ? new Intl.ListFormat(tag, { style: 'long', type: 'conjunction' }).format(names) : ''
  const when = formatDate(s.release.publishedAt)
  return `${list ? t('apps.availableFor', { platforms: list }) + ' ' : ''}${t('apps.versionOn', { version: `v${s.release.version}`, date: when })}`
}

const formatDate = (iso: string): string => {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString(localeTag(locale.value as AppLocale), {
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
   badges. They colour the per-file download buttons and the docs tabs; the
   hero buttons stay neutral so the page has one voice.
   Two variants per app, because one colour can't do both jobs: `--app-*` is ink
   on the page background and gets lighter in dark mode to stay legible, while
   `--app-*-solid` sits behind white button text and must stay dark enough for
   it in either theme. */
.apps-page {
  --app-autoslides: #e00000;
  --app-extractor: #5c3ee8;
  --app-autoslides-solid: #d40000;
  --app-extractor-solid: #5233dd;
  height: 100vh;
  height: 100dvh;
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
  z-index: var(--z-sticky);
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

.hero,
.second {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
}

.hero {
  padding: 5rem 0 2rem;
}

/* The product name is set in the same serif as the wordmark in the demo's
   lockup, so the page and the app sign their name the same way. */
.hero-title,
.second-title {
  margin: 0;
  font-family: ui-serif, 'Iowan Old Style', Georgia, 'Times New Roman', serif;
  font-weight: 600;
  letter-spacing: -0.02em;
  line-height: 1.05;
}

.hero-title {
  font-size: clamp(3rem, 8vw, 5rem);
}

.second-title {
  font-size: clamp(2rem, 4.5vw, 2.75rem);
}

.hero-lead {
  margin: 1.5rem auto 0;
  max-width: 40ch;
  font-size: clamp(1.0625rem, 1.6vw, 1.25rem);
  line-height: 1.55;
  color: var(--text-secondary);
}

.cta-row {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 0.75rem;
  margin-top: 2rem;
}

.cta {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  min-height: 2.75rem;
  padding: 0 1.25rem;
  border: none;
  border-radius: 0.625rem;
  font-size: 0.9375rem;
  font-weight: 500;
  text-decoration: none;
  cursor: pointer;
  transition: background-color 0.15s, color 0.15s;
}

.cta--secondary {
  background-color: var(--bg-elevated);
  color: var(--text-primary);
}

.cta--secondary:hover {
  background-color: var(--bg-hover);
}

.availability {
  margin: 1rem 0 0;
  font-size: 0.875rem;
  color: var(--text-secondary);
}

.ways-title {
  margin: 3rem 0 0.875rem;
  font-size: 0.9375rem;
  color: var(--text-secondary);
}

.tiles {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 0.625rem;
  margin: 0;
  padding: 0;
  list-style: none;
}

.tile {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  width: 5.25rem;
  height: 5rem;
  border: 1px solid var(--border-color);
  border-radius: 0.75rem;
  background-color: var(--bg-surface);
  color: var(--text-secondary);
  font-size: 0.75rem;
  font-weight: 500;
  text-decoration: none;
  cursor: pointer;
  transition: border-color 0.15s, color 0.15s, transform 0.15s;
}

.tile:hover {
  border-color: var(--border-strong);
  color: var(--text-primary);
}

.tile-icon {
  width: 1.5rem;
  height: 1.5rem;
  color: var(--text-primary);
}

/* The app in its own window. The three dots are the only chrome; the demo
   provides the rest, headline included. */
.window {
  width: min(64rem, 100%);
  margin-top: 4rem;
  border: 1px solid var(--border-color);
  border-radius: 1rem;
  background-color: var(--bg-surface);
  box-shadow: 0 1.5rem 3rem -1.5rem var(--shadow-lg);
  overflow: hidden;
}

html[data-theme='dark'] .window {
  box-shadow: none;
}

.window-bar {
  display: flex;
  gap: 0.4rem;
  padding: 0.875rem 1rem;
  border-bottom: 1px solid var(--border-color);
}

.window-bar span {
  width: 0.7rem;
  height: 0.7rem;
  border-radius: 50%;
}

/* macOS traffic lights, fixed colours in both themes like the real thing. */
.window-bar span:nth-child(1) {
  background-color: #ff5f57;
}

.window-bar span:nth-child(2) {
  background-color: #febc2e;
}

.window-bar span:nth-child(3) {
  background-color: #28c840;
}

.window-demo {
  --hw-hero-size: clamp(1.375rem, 3vw, 1.875rem);
  width: min(38rem, 90%);
  padding: 2.5rem 0 2rem;
}

/* ---------- second app ---------- */

.second {
  padding: 5rem 0 1rem;
}

/* ---------- downloads ---------- */

.downloads {
  padding-top: 5rem;
}

.section-title {
  margin: 0;
  font-size: clamp(1.5rem, 3vw, 2rem);
  font-weight: 700;
  letter-spacing: -0.035em;
}

.section-lead {
  margin: 0.5rem 0 1.75rem;
  color: var(--text-secondary);
  font-size: 0.9375rem;
}

.download-groups {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 1.25rem;
}

.download-group {
  --accent-app: var(--app-autoslides);
  padding: 1.25rem 1.5rem 0.75rem;
  border: 1px solid var(--border-color);
  border-radius: 0.75rem;
  background-color: var(--bg-surface);
}

.download-group--extractor {
  --accent-app: var(--app-extractor);
}

.download-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 0.5rem;
}

.download-name {
  margin: 0;
  padding-bottom: 0.25rem;
  border-bottom: 2px solid var(--accent-app);
  font-size: 1.0625rem;
  font-weight: 600;
}

.download-version {
  font-size: 0.875rem;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.download-date {
  margin-left: 0.5rem;
  font-weight: 400;
  color: var(--text-muted);
}

.muted {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  margin: 0;
  padding: 0.75rem 0;
  color: var(--text-muted);
  font-size: 0.875rem;
}

/* ---------- loading / error ---------- */

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

.release-error {
  padding: 0.5rem 0 0.75rem;
}

.release-error-text {
  margin: 0 0 0.75rem;
  font-size: 0.875rem;
  line-height: 1.5;
  color: var(--text-secondary);
}

.release-error-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.readme-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 3rem 0;
  color: var(--text-muted);
  font-size: 0.875rem;
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

.pill:hover {
  background-color: var(--bg-hover);
}

/* ---------- docs ---------- */

.docs {
  padding-top: 4rem;
}

.docs-head {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 1rem;
  margin-bottom: 1.25rem;
  border-bottom: 1px solid var(--border-color);
}

.docs-head .section-title {
  padding-bottom: 0.75rem;
}

.tabs {
  display: flex;
  gap: 1.25rem;
}

/* Underline tabs; the underline is the app's colour, the same rule the
   download groups use. */
.tab {
  --accent-app: var(--app-autoslides);
  margin-bottom: -1px;
  padding: 0.5rem 0 0.75rem;
  border: none;
  border-bottom: 3px solid transparent;
  background: transparent;
  color: var(--text-secondary);
  font-size: 0.9375rem;
  font-weight: 500;
  cursor: pointer;
  transition: color 0.15s, border-color 0.15s;
}

.tab--extractor {
  --accent-app: var(--app-extractor);
}

.tab:hover {
  color: var(--text-primary);
}

.tab--active {
  color: var(--text-primary);
  border-bottom-color: var(--accent-app);
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
   supplies the surface so the README sits on the same background as the rest. */
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

@media (max-width: 760px) {
  .hero {
    padding: 3rem 0 1.5rem;
  }

  .window {
    margin-top: 2.5rem;
  }

  .window-demo {
    width: 92%;
    padding: 1.75rem 0 1.25rem;
  }

  .second,
  .downloads {
    padding-top: 3.5rem;
  }

  .download-groups {
    grid-template-columns: minmax(0, 1fr);
  }

  .readme {
    padding: 1.25rem;
  }
}

@media (prefers-reduced-motion: reduce) {
  .spinner {
    animation-duration: 2s;
  }
}
</style>
