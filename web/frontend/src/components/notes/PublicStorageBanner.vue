<template>
  <aside class="psb" role="status" aria-live="polite">
    <div class="psb-row">
      <svg
        class="psb-icon"
        width="22"
        height="22"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="1.75"
        stroke-linecap="round"
        stroke-linejoin="round"
        aria-hidden="true"
      >
        <!-- Shield with an open eye: public / world-readable storage -->
        <path d="M12 3 4.5 6.5v5c0 4.6 3.2 8.1 7.5 9.5 4.3-1.4 7.5-4.9 7.5-9.5v-5L12 3z" />
        <circle cx="12" cy="12" r="2.25" />
        <path d="M6.8 12c1.3-2.1 3.1-3.2 5.2-3.2s3.9 1.1 5.2 3.2c-1.3 2.1-3.1 3.2-5.2 3.2s-3.9-1.1-5.2-3.2z" />
      </svg>
      <p class="psb-text">
        <span>{{ $t('cloudNotes.publicStorageBanner.textLead') }}</span>
        {{ ' ' }}
        <span class="psb-text-warn">{{ $t('cloudNotes.publicStorageBanner.textWarn') }}</span>
      </p>
    </div>
    <div class="psb-actions">
      <a
        class="psb-link"
        :href="disclosureHref"
        target="_blank"
        rel="noopener noreferrer"
      >{{ $t('cloudNotes.publicStorageBanner.learnWhy') }}</a>
      <button
        type="button"
        class="psb-dismiss"
        @click="publicStorageNoticeStore.acknowledge()"
      >
        {{ $t('cloudNotes.publicStorageBanner.dismiss') }}
      </button>
    </div>
  </aside>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { publicStorageNoticeStore } from '../../stores/publicStorageNoticeStore'

// Resolve via the router so a base path (if any) is honoured; open in a new
// tab so the keep-alive Notes editor is not abandoned mid-session.
const router = useRouter()
const disclosureHref = computed(() => router.resolve({ name: 'disclosure' }).href)
</script>

<style scoped>
.psb {
  position: absolute;
  right: 1.5rem;
  bottom: 1.5rem;
  z-index: 30;
  display: flex;
  flex-direction: column;
  gap: 0.875rem;
  width: min(26rem, calc(100% - 3rem));
  padding: 1.125rem 1.25rem;
  border: 1px solid var(--nt-border);
  border-radius: 0.875rem;
  background: var(--nt-elevated);
  color: var(--nt-text);
  box-shadow: var(--nt-elevated-shadow);
}

.psb-row {
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
}

.psb-icon {
  flex-shrink: 0;
  margin-top: 0.1rem;
  color: var(--nt-text-muted);
}

.psb-text {
  margin: 0;
  font-size: 0.875rem;
  line-height: 1.55;
  color: var(--nt-text-muted);
}

.psb-text-warn {
  color: var(--danger-pink, #ff4d4d);
  font-weight: 500;
}

.psb-actions {
  /* Match .psb-row icon (22px) + gap so "Learn why" lines up with the text. */
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  padding-left: calc(22px + 0.75rem);
}

.psb-link {
  color: var(--nt-accent);
  font-size: 0.875rem;
  text-decoration: none;
  white-space: nowrap;
}

.psb-link:hover {
  text-decoration: underline;
}

.psb-dismiss {
  padding: 0.45rem 0.95rem;
  border: 1px solid var(--nt-border);
  border-radius: 0.55rem;
  background: var(--nt-bg);
  color: var(--nt-text);
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
}

.psb-dismiss:hover {
  background: var(--nt-sidebar-hover);
}

@media (max-width: 768px) {
  .psb {
    right: 1rem;
    bottom: 1rem;
    width: min(26rem, calc(100% - 2rem));
  }
}
</style>
