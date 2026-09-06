<template>
  <!-- The one button that matters: the installer for the visitor's platform,
       straight from GitHub. While the release loads it waits; if there is no
       build for this platform (or GitHub failed) it hands off to the full list. -->
  <button v-if="state.status === 'loading'" type="button" class="cta cta--primary" disabled>
    <span class="cta-spinner" aria-hidden="true" />
    {{ $t('apps.loading') }}
  </button>

  <a v-else-if="asset" class="cta cta--primary" :href="asset.url" :download="asset.name">
    <svg class="cta-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
    {{ $t('apps.downloadFor', { platform: platformLabel(platform) }) }}
  </a>

  <button v-else type="button" class="cta cta--primary" @click="emit('all')">
    {{ $t('apps.allDownloads') }}
  </button>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { platformLabel, type Platform, type ReleaseAsset } from '../../lib/github'
import type { AppDef, AppState } from './appsModel'

const props = defineProps<{
  app: AppDef
  state: AppState
  platform: Platform
}>()

const emit = defineEmits<{ all: [] }>()

/** Installer first; a portable build only when that is all there is. */
const asset = computed<ReleaseAsset | null>(() => {
  const mine = props.state.release?.assets.filter((a) => a.platform === props.platform) ?? []
  return mine.find((a) => a.kind === 'installer') ?? mine[0] ?? null
})
</script>

<style scoped>
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
  transition: background-color 0.15s, opacity 0.15s;
}

.cta--primary {
  background-color: var(--text-primary);
  color: var(--bg-page);
}

.cta--primary:hover {
  background-color: var(--text-secondary);
}

.cta--primary:disabled {
  opacity: 0.6;
  cursor: default;
}

.cta-icon {
  width: 1rem;
  height: 1rem;
}

.cta-spinner {
  width: 0.875rem;
  height: 0.875rem;
  border: 2px solid var(--bg-page);
  border-top-color: transparent;
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
