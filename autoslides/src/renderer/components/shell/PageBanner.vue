<template>
  <div class="page-banner" :class="`page-banner--${tone}`" :role="tone === 'danger' ? 'alert' : 'status'">
    <span class="page-banner-msg">
      <svg v-if="tone === 'danger'" width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.6"/>
        <path d="M12 7.5v5.5M12 16.5h.01" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
      </svg>
      <svg v-else width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M12 3l9 16H3L12 3z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>
        <path d="M12 10v4M12 17h.01" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
      </svg>
      <span class="page-banner-text"><slot /></span>
    </span>
    <span v-if="recheckLabel" class="page-banner-actions">
      <button
        type="button"
        class="page-banner-icon-btn"
        :class="{ 'is-spinning': busy }"
        :disabled="busy"
        :title="recheckLabel"
        :aria-label="recheckLabel"
        @click="emit('recheck')"
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M21 12a9 9 0 1 1-2.64-6.36M21 4v6h-6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </button>
    </span>
  </div>
</template>

<script setup lang="ts">
// Thin full-bleed notice strip for the top of a page (Home's campus-network
// warning, page load failures). Carries no margins — the host page positions it.
// Inline actions in the slot use `.page-banner-link` (styled unscoped below, so
// links nested inside another component's slot, e.g. <i18n-t>, still match).
withDefaults(defineProps<{
  tone?: 'warning' | 'danger'
  /** Shows the recheck icon button when set (its tooltip / aria label). */
  recheckLabel?: string
  /** Spins and disables the recheck button. */
  busy?: boolean
}>(), {
  tone: 'warning',
  recheckLabel: undefined,
  busy: false,
})

const emit = defineEmits<{
  (e: 'recheck'): void
}>()
</script>

<style scoped>
.page-banner {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  flex-shrink: 0;
  padding: 7px 14px;
  font-size: 12px;
  line-height: 1.45;
  color: var(--text-primary);
  border-bottom: 1px solid var(--border-color);
}

.page-banner--warning {
  background-color: var(--warning-bg);
}

.page-banner--danger {
  background-color: var(--danger-bg);
}

.page-banner-msg {
  display: inline-flex;
  align-items: flex-start;
  gap: 8px;
  min-width: 0;
}

.page-banner-msg svg {
  flex-shrink: 0;
}

.page-banner--warning .page-banner-msg svg {
  color: var(--warning);
}

.page-banner--danger .page-banner-msg svg {
  color: var(--danger);
}

.page-banner-text {
  min-width: 0;
  overflow-wrap: anywhere;
}

.page-banner-actions {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  flex-shrink: 0;
}

.page-banner-icon-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 3px;
  border: none;
  border-radius: 4px;
  background: none;
  color: var(--text-muted);
  cursor: pointer;
  line-height: 0;
}

.page-banner-icon-btn:hover:not(:disabled) {
  color: var(--text-primary);
  background-color: var(--bg-hover);
}

.page-banner-icon-btn:disabled {
  cursor: default;
}

.page-banner-icon-btn.is-spinning svg {
  animation: page-banner-spin 0.8s linear infinite;
}

@keyframes page-banner-spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
</style>

<style>
/* Unscoped on purpose: :slotted() stops matching once the link sits inside a
   nested component's slot (PageErrorNotice renders its links through <i18n-t>). */
.page-banner .page-banner-link {
  padding: 0;
  border: none;
  background: none;
  font: inherit;
  line-height: inherit;
  color: var(--link-color);
  cursor: pointer;
  white-space: nowrap;
}

.page-banner .page-banner-link:hover {
  text-decoration: underline;
}
</style>
