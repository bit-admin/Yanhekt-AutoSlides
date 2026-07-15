<template>
  <!-- Teleported so the sidebar's overflow/stacking context can't clip it. -->
  <Teleport to="body">
    <div class="modal-overlay" @click.self="emit('close')">
      <div class="modal-content feedback-modal" role="dialog" aria-modal="true" :aria-label="$t('feedback.title')">
        <div class="modal-header">
          <h3 class="feedback-title">{{ $t('feedback.title') }}</h3>
          <button type="button" class="modal-close" :aria-label="$t('feedback.close')" @click="emit('close')">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div class="modal-body">
          <p class="feedback-lead">{{ $t('feedback.lead') }}</p>

          <button type="button" class="feedback-row" @click="openIssue">
            <span class="feedback-row-icon">
              <svg width="20" height="20" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
                <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
              </svg>
            </span>
            <span class="feedback-row-text">
              <span class="feedback-row-title">{{ $t('feedback.openIssue') }}</span>
              <span class="feedback-row-desc">{{ $t('feedback.openIssueDesc') }}</span>
            </span>
            <svg class="feedback-row-chevron" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>

          <button type="button" class="feedback-row" @click="openEmail">
            <span class="feedback-row-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                <polyline points="22,6 12,13 2,6" />
              </svg>
            </span>
            <span class="feedback-row-text">
              <span class="feedback-row-title">{{ $t('feedback.sendEmail') }}</span>
              <span class="feedback-row-desc">{{ $t('feedback.sendEmailDesc') }}</span>
            </span>
            <svg class="feedback-row-chevron" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue'

const emit = defineEmits<{ close: [] }>()

const ISSUE_URL = 'https://github.com/bit-admin/Yanhekt-AutoSlides/issues/new'
const CONTACT_EMAIL = 'info@ruc.edu.kg'

const openIssue = () => {
  window.open(ISSUE_URL, '_blank', 'noopener,noreferrer')
  emit('close')
}

/**
 * Mirrors the desktop app's feedback email, with the environment snapshot
 * adapted to what a browser can actually report (no app/Electron version).
 * The template stays English: it's addressed to the team, not the user.
 */
const openEmail = () => {
  const now = new Date()
  const timestampLocal = now.toLocaleString()
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Unknown'
  const platform = navigator.platform || 'Unknown'
  const language = navigator.language || 'Unknown'

  const subject = encodeURIComponent(`[AutoSlides Web Feedback] ${timestampLocal.slice(0, 10)}`)
  const body = encodeURIComponent(
    `Hello AutoSlides Team,\n\n` +
      `- What happened:\n` +
      `- Steps to reproduce:\n` +
      `- Expected result:\n` +
      `- Actual result:\n` +
      `- Additional notes:\n\n` +
      `────────────────────────\n` +
      `Environment Snapshot\n` +
      `────────────────────────\n` +
      `Timestamp: ${timestampLocal}\n` +
      `Time zone: ${timezone}\n` +
      `Page: ${window.location.href}\n` +
      `Browser: ${navigator.userAgent}\n` +
      `Platform: ${platform}\n` +
      `Language: ${language}\n`,
  )

  window.location.href = `mailto:${CONTACT_EMAIL}?subject=${subject}&body=${body}`
  emit('close')
}

const onKeydown = (e: KeyboardEvent) => {
  if (e.key === 'Escape') emit('close')
}

onMounted(() => window.addEventListener('keydown', onKeydown))
onUnmounted(() => window.removeEventListener('keydown', onKeydown))
</script>

<style scoped>
.feedback-modal {
  width: min(26rem, calc(100vw - 2rem));
}

.feedback-title {
  margin: 0;
  font-size: 1rem;
  font-weight: 600;
  color: var(--text-primary);
}

.feedback-lead {
  margin: 0 0 0.875rem;
  font-size: 0.8125rem;
  line-height: 1.5;
  color: var(--text-secondary);
}

.feedback-row {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  width: 100%;
  padding: 0.75rem;
  border: 1px solid var(--border-color);
  border-radius: 0.625rem;
  background: transparent;
  text-align: left;
  cursor: pointer;
  transition: background-color 0.15s, border-color 0.15s;
}

.feedback-row + .feedback-row {
  margin-top: 0.5rem;
}

.feedback-row:hover {
  background-color: var(--bg-hover);
  border-color: var(--border-strong);
}

.feedback-row-icon {
  display: flex;
  flex-shrink: 0;
  color: var(--text-primary);
}

.feedback-row-text {
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
  min-width: 0;
}

.feedback-row-title {
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--text-primary);
}

.feedback-row-desc {
  font-size: 0.75rem;
  line-height: 1.45;
  color: var(--text-secondary);
}

.feedback-row-chevron {
  flex-shrink: 0;
  margin-left: auto;
  color: var(--text-muted);
}
</style>
