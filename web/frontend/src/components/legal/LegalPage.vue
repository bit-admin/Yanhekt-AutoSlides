<template>
  <div class="legal-page custom-scrollbar">
    <header class="topbar">
      <a class="brand" href="/">
        <svg class="brand-mark" width="30" height="22" viewBox="0 0 30 22" fill="none" aria-hidden="true">
          <rect width="30" height="22" rx="5" fill="#FF0000" />
          <polygon points="12,6 20,11 12,16" fill="white" />
          <line x1="6" y1="18" x2="24" y2="18" stroke="white" stroke-width="1.5" stroke-linecap="round" />
        </svg>
        <span class="brand-text">AutoSlides</span>
      </a>
    </header>

    <div class="legal-body">
      <!-- Sidebar: the other legal documents, as on youtube.com/t/terms -->
      <aside class="legal-nav">
        <RouterLink
          v-for="entry in LEGAL_DOCS"
          :key="entry.id"
          class="legal-nav-link"
          :class="{ 'legal-nav-link--active': entry.id === doc.id }"
          :to="{ name: entry.id }"
        >
          {{ entry.title.en }}
        </RouterLink>
      </aside>

      <main class="legal-main">
        <h1 class="legal-title">{{ doc.title.en }}</h1>
        <p class="legal-title-zh">{{ doc.title.zh }}</p>
        <p class="legal-updated">
          {{ $t('legal.updated', { date: formatDate(doc.updated) }) }}
        </p>
        <p class="legal-langs">{{ $t('legal.bilingualNote') }}</p>

        <p v-for="(para, i) in doc.intro" :key="`i${i}`" class="legal-intro">
          <span class="legal-en" v-html="renderInline(para.en)" />
          <span class="legal-zh" v-html="renderInline(para.zh)" />
        </p>

        <!-- Index box, mirroring YouTube's "What's in these terms?" -->
        <nav class="legal-index" :aria-label="$t('legal.indexTitle')">
          <h2 class="legal-index-title">{{ $t('legal.indexTitle') }}</h2>
          <p class="legal-index-lead">{{ $t('legal.indexLead') }}</p>
          <div v-for="section in doc.sections" :key="section.id" class="legal-index-item">
            <a class="legal-index-link" :href="`#${section.id}`" @click.prevent="jumpTo(section.id)">
              {{ section.heading.en }} {{ section.heading.zh }}
            </a>
            <p class="legal-index-blurb">
              <span class="legal-en">{{ section.summary.en }}</span>
              <span class="legal-zh">{{ section.summary.zh }}</span>
            </p>
          </div>
        </nav>

        <section v-for="section in doc.sections" :id="section.id" :key="section.id" class="legal-section">
          <h2 class="legal-heading">
            {{ section.heading.en }}
            <span class="legal-heading-zh">{{ section.heading.zh }}</span>
          </h2>
          <p
            v-for="(para, i) in section.paragraphs"
            :key="i"
            class="legal-para"
            :class="{ 'legal-para--emphasis': para.emphasis }"
          >
            <span class="legal-en" v-html="renderInline(para.en)" />
            <span class="legal-zh" v-html="renderInline(para.zh)" />
          </p>
        </section>

        <footer class="legal-foot">
          <p>© {{ COPYRIGHT_YEAR }} bit-admin</p>
        </footer>
      </main>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { LEGAL_DOCS, legalDoc, renderInline, type LegalDocId } from '../../legal'
import { COPYRIGHT_YEAR } from '../../legal/meta'

const props = defineProps<{ docId: LegalDocId }>()

const { locale } = useI18n()
const doc = computed(() => legalDoc(props.docId))

const formatDate = (iso: string): string =>
  new Date(iso).toLocaleDateString(locale.value === 'zh' ? 'zh-CN' : 'en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

/** The page scrolls inside its own container, so anchors need scrolling by hand. */
const jumpTo = (id: string) => {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  history.replaceState(null, '', `#${id}`)
}

const jumpToHash = () => {
  const id = window.location.hash.slice(1)
  if (id) requestAnimationFrame(() => document.getElementById(id)?.scrollIntoView())
}

onMounted(jumpToHash)
// Switching documents must land at the top rather than keep the old offset.
watch(() => props.docId, () => document.querySelector('.legal-page')?.scrollTo(0, 0))
</script>

<style scoped>
.legal-page {
  height: 100vh;
  overflow-y: auto;
  background-color: var(--bg-page);
  color: var(--text-primary);
}

.topbar {
  position: sticky;
  top: 0;
  z-index: 20;
  display: flex;
  align-items: center;
  height: var(--header-height);
  padding: 0 1.5rem;
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

.legal-body {
  display: grid;
  grid-template-columns: 14rem minmax(0, 1fr);
  gap: 2.5rem;
  max-width: 62rem;
  margin: 0 auto;
  padding: 2.5rem 1.5rem 4rem;
}

.legal-nav {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  position: sticky;
  top: calc(var(--header-height) + 2.5rem);
  align-self: start;
}

.legal-nav-link {
  padding: 0.4rem 0.625rem;
  border-radius: 0.5rem;
  color: var(--accent-deep);
  font-size: 0.875rem;
  text-decoration: none;
}

.legal-nav-link:hover {
  background-color: var(--bg-hover);
}

.legal-nav-link--active {
  color: var(--text-primary);
  font-weight: 600;
}

.legal-title {
  margin: 0;
  font-size: clamp(2rem, 5vw, 3rem);
  font-weight: 700;
  letter-spacing: -0.04em;
  line-height: 1.1;
}

.legal-title-zh {
  margin: 0.25rem 0 0;
  font-size: 1.25rem;
  font-weight: 500;
  color: var(--text-secondary);
}

.legal-updated {
  margin: 1rem 0 0;
  font-size: 0.8125rem;
  color: var(--text-muted);
}

.legal-langs {
  margin: 0.25rem 0 1.75rem;
  font-size: 0.8125rem;
  color: var(--text-muted);
}

.legal-intro {
  margin: 0 0 1rem;
}

/* Index box */
.legal-index {
  margin: 1.5rem 0 2.5rem;
  padding: 1.25rem 1.5rem;
  border: 1px solid var(--border-color);
  border-radius: 0.75rem;
  background-color: var(--bg-elevated);
}

.legal-index-title {
  margin: 0;
  font-size: 1.125rem;
  font-weight: 600;
}

.legal-index-lead {
  margin: 0.5rem 0 1.25rem;
  font-size: 0.875rem;
  color: var(--text-secondary);
}

.legal-index-item + .legal-index-item {
  margin-top: 1rem;
}

.legal-index-link {
  color: var(--accent-deep);
  font-size: 0.875rem;
  font-weight: 600;
  text-decoration: none;
}

.legal-index-link:hover {
  text-decoration: underline;
}

.legal-index-blurb {
  margin: 0.25rem 0 0;
  font-size: 0.8125rem;
  line-height: 1.6;
  color: var(--text-secondary);
}

/* Body */
.legal-section {
  /* Anchor targets must clear the sticky topbar. */
  scroll-margin-top: calc(var(--header-height) + 1rem);
  padding-top: 1.5rem;
}

.legal-heading {
  margin: 0 0 0.875rem;
  font-size: 1.25rem;
  font-weight: 600;
  letter-spacing: -0.02em;
}

.legal-heading-zh {
  margin-left: 0.5rem;
  font-weight: 500;
  color: var(--text-secondary);
}

.legal-para {
  margin: 0 0 1rem;
}

/* English above, 繁體中文 below — the pairing docs/terms.md uses. */
.legal-en,
.legal-zh {
  display: block;
  font-size: 0.9375rem;
  line-height: 1.7;
}

.legal-en {
  color: var(--text-primary);
}

.legal-zh {
  margin-top: 0.2rem;
  color: var(--text-secondary);
}

.legal-para--emphasis {
  padding: 0.875rem 1rem;
  border-left: 3px solid var(--border-strong);
  border-radius: 0 0.375rem 0.375rem 0;
  background-color: var(--bg-elevated);
}

.legal-foot {
  margin-top: 3rem;
  padding-top: 1.5rem;
  border-top: 1px solid var(--border-color);
  font-size: 0.75rem;
  color: var(--text-muted);
}

.legal-foot p {
  margin: 0;
}

@media (max-width: 800px) {
  .legal-body {
    grid-template-columns: minmax(0, 1fr);
    gap: 1.5rem;
    padding-top: 1.5rem;
  }

  .legal-nav {
    position: static;
    flex-direction: row;
    flex-wrap: wrap;
    gap: 0.5rem;
    padding-bottom: 0.5rem;
    border-bottom: 1px solid var(--border-color);
  }
}
</style>
