<template>
  <Teleport to="body">
    <!-- No backdrop dismissal and no close button: the single action is the
         acknowledgement, so there is no way to bypass it by clicking away. -->
    <div class="modal-overlay notice-overlay">
      <div
        class="modal-content notice"
        role="dialog"
        aria-modal="true"
        :aria-labelledby="titleId"
      >
        <div class="notice-body custom-scrollbar">
          <h2 :id="titleId" class="notice-title">{{ $t('notice.title') }}</h2>

          <p class="notice-lead">{{ $t('notice.lead') }}</p>

          <ul class="notice-list">
            <li v-for="item in ITEMS" :key="item.key" class="notice-item">
              <svg class="notice-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <template v-if="item.key === 'signedIn'">
                  <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" />
                </template>
                <template v-else-if="item.key === 'slides'">
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                  <circle cx="9" cy="9" r="2" />
                  <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
                </template>
                <template v-else>
                  <line x1="4" y1="21" x2="4" y2="14" />
                  <line x1="4" y1="10" x2="4" y2="3" />
                  <line x1="12" y1="21" x2="12" y2="12" />
                  <line x1="12" y1="8" x2="12" y2="3" />
                  <line x1="20" y1="21" x2="20" y2="16" />
                  <line x1="20" y1="12" x2="20" y2="3" />
                  <line x1="1" y1="14" x2="7" y2="14" />
                  <line x1="9" y1="8" x2="15" y2="8" />
                  <line x1="17" y1="16" x2="23" y2="16" />
                </template>
              </svg>
              <span>{{ $t(`notice.items.${item.key}`) }}</span>
            </li>
          </ul>

          <p class="notice-para">{{ $t('notice.cookies') }}</p>
          <p class="notice-para">{{ $t('notice.affiliation') }}</p>
          <p class="notice-para notice-para--agree">{{ $t('notice.agree') }}</p>
        </div>

        <div class="notice-actions">
          <button type="button" class="notice-accept" @click="noticeStore.acknowledge()">
            {{ $t('notice.accept') }}
          </button>
        </div>

        <div class="notice-legal">
          <RouterLink class="notice-legal-link" :to="{ name: 'privacy' }">{{ $t('legal.privacy') }}</RouterLink>
          <span class="notice-legal-dot" aria-hidden="true">•</span>
          <RouterLink class="notice-legal-link" :to="{ name: 'terms' }">{{ $t('legal.terms') }}</RouterLink>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { useId } from 'vue'
import { noticeStore } from '../stores/noticeStore'

const titleId = useId()

// Only the icon varies per row; the text lives in notice.items.*
const ITEMS = [{ key: 'signedIn' }, { key: 'slides' }, { key: 'settings' }] as const
</script>

<style scoped>
.notice-overlay {
  padding: 1.5rem;
  /* Above every other modal: nothing should be reachable behind it. */
  z-index: var(--z-super-modal);
}

.notice {
  width: min(34rem, 100%);
  max-height: min(44rem, calc(100vh - 3rem));
  border-radius: 0.75rem;
}

.notice-body {
  overflow-y: auto;
  padding: 1.75rem 1.75rem 0.5rem;
}

.notice-title {
  margin: 0 0 1.25rem;
  font-size: 1.375rem;
  font-weight: 600;
  letter-spacing: -0.02em;
  text-align: center;
}

.notice-lead {
  margin: 0 0 1rem;
  font-size: 0.875rem;
  color: var(--text-primary);
}

.notice-list {
  display: flex;
  flex-direction: column;
  gap: 0.875rem;
  margin: 0 0 1.25rem;
  padding: 0;
  list-style: none;
}

.notice-item {
  display: flex;
  align-items: flex-start;
  gap: 0.875rem;
  font-size: 0.875rem;
  line-height: 1.55;
  color: var(--text-primary);
}

.notice-icon {
  flex-shrink: 0;
  margin-top: 0.125rem;
  color: var(--text-secondary);
}

.notice-para {
  margin: 0 0 0.875rem;
  font-size: 0.8125rem;
  line-height: 1.6;
  color: var(--text-secondary);
}

.notice-para--agree {
  color: var(--text-primary);
}

.notice-actions {
  display: flex;
  justify-content: flex-end;
  padding: 0.75rem 1.75rem 0.25rem;
}

.notice-accept {
  padding: 0.5rem 1.5rem;
  border: none;
  border-radius: 1.25rem;
  background-color: var(--text-primary);
  color: var(--bg-surface);
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: opacity 0.15s;
}

.notice-accept:hover {
  opacity: 0.85;
}

.notice-legal {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1.75rem 1.25rem;
  font-size: 0.75rem;
}

.notice-legal-link {
  color: var(--text-secondary);
  text-decoration: none;
}

.notice-legal-link:hover {
  color: var(--text-primary);
  text-decoration: underline;
}

.notice-legal-dot {
  color: var(--text-muted);
}

@media (max-width: 520px) {
  .notice-body {
    padding: 1.25rem 1.25rem 0.5rem;
  }

  .notice-actions,
  .notice-legal {
    padding-left: 1.25rem;
    padding-right: 1.25rem;
  }

  .notice-actions {
    justify-content: stretch;
  }

  .notice-accept {
    width: 100%;
  }
}
</style>
