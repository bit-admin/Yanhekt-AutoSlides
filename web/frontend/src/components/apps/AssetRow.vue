<template>
  <div class="asset" :class="`asset--${accent}`">
    <div class="asset-meta">
      <p class="asset-name" :title="asset.name">{{ asset.name }}</p>
      <p class="asset-facts">
        <span class="asset-kind">{{ $t(`apps.kind.${asset.kind}`) }}</span>
        <span aria-hidden="true">·</span>
        <span>{{ asset.formattedSize }}</span>
      </p>
    </div>

    <div class="asset-actions">
      <!-- Two routes to the same file: GitHub direct, and the gh-proxy mirror
           for when GitHub is throttled or unreachable on the campus network. -->
      <a class="dl dl--primary" :href="asset.url" :download="asset.name">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="7 10 12 15 17 10" />
          <line x1="12" y1="15" x2="12" y2="3" />
        </svg>
        {{ $t('apps.download') }}
      </a>
      <a
        class="dl dl--mirror"
        :href="asset.proxyUrl"
        :download="asset.name"
        :title="$t('apps.mirrorTitle')"
      >
        {{ $t('apps.mirror') }}
      </a>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { ReleaseAsset } from '../../lib/github'

defineProps<{
  asset: ReleaseAsset
  /** Which app's colour the primary button wears. */
  accent: 'autoslides' | 'extractor'
}>()
</script>

<style scoped>
.asset {
  --accent-solid: var(--app-autoslides-solid);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0.625rem 0;
  border-top: 1px solid var(--border-color);
}

.asset--extractor {
  --accent-solid: var(--app-extractor-solid);
}

.asset:first-of-type {
  border-top: none;
}

.asset-meta {
  min-width: 0;
}

/* Filenames are machine data — set in mono so version and arch stay scannable. */
.asset-name {
  margin: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 0.75rem;
  color: var(--text-primary);
}

.asset-facts {
  display: flex;
  align-items: center;
  gap: 0.3rem;
  margin: 0.2rem 0 0;
  font-size: 0.6875rem;
  color: var(--text-muted);
}

.asset-kind {
  color: var(--text-secondary);
}

.asset-actions {
  display: flex;
  flex-shrink: 0;
  gap: 0.375rem;
}

.dl {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  padding: 0.375rem 0.75rem;
  border-radius: 1rem;
  font-size: 0.75rem;
  font-weight: 600;
  text-decoration: none;
  white-space: nowrap;
  transition: filter 0.15s, background-color 0.15s;
}

.dl--primary {
  background-color: var(--accent-solid);
  color: #ffffff;
}

.dl--primary:hover {
  filter: brightness(1.1);
}

.dl--mirror {
  border: 1px solid var(--border-input);
  color: var(--text-secondary);
}

.dl--mirror:hover {
  background-color: var(--bg-hover);
  color: var(--text-primary);
}
</style>
