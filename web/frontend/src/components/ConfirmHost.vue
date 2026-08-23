<template>
  <Teleport to="body">
    <div
      v-if="active"
      class="modal-overlay confirm-overlay"
      @click.self="onOverlay"
      @keydown.esc.prevent="onDismiss"
    >
      <div
        class="confirm-box"
        role="dialog"
        aria-modal="true"
        :aria-labelledby="titleId"
        :aria-describedby="active.title ? messageId : undefined"
      >
        <div v-if="showIcon" class="confirm-icon" :class="iconClass" aria-hidden="true">
          <svg v-if="isDanger" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
            <line x1="12" y1="9" x2="12" y2="13"/>
            <line x1="12" y1="17" x2="12.01" y2="17"/>
          </svg>
          <svg v-else width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="10"/>
            <line x1="12" y1="16" x2="12" y2="12"/>
            <line x1="12" y1="8" x2="12.01" y2="8"/>
          </svg>
        </div>
        <h3 v-if="active.title" :id="titleId" class="confirm-title">{{ active.title }}</h3>
        <p
          :id="active.title ? messageId : titleId"
          class="confirm-message"
          :class="{ 'confirm-message--solo': !active.title }"
        >
          {{ active.message }}
        </p>
        <div class="confirm-actions">
          <button
            v-if="active.kind === 'confirm'"
            ref="cancelEl"
            class="btn confirm-btn"
            type="button"
            @click="dialogStore.resolve(false)"
          >
            {{ active.cancelText || $t('dialog.cancel') }}
          </button>
          <button
            ref="confirmEl"
            class="btn confirm-btn"
            :class="confirmBtnClass"
            type="button"
            @click="dialogStore.resolve(true)"
          >
            {{ active.confirmText || $t('dialog.ok') }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, nextTick, onUnmounted, ref, watch } from 'vue'
import { dialogStore } from '../stores/dialogStore'

const titleId = 'autoslides-confirm-title'
const messageId = 'autoslides-confirm-message'

const active = dialogStore.active
const cancelEl = ref<HTMLButtonElement | null>(null)
const confirmEl = ref<HTMLButtonElement | null>(null)

const isDanger = computed(() => !!active.value && active.value.kind === 'confirm' && !!active.value.danger)
const showIcon = computed(() => !!active.value && (active.value.kind === 'alert' || isDanger.value))
const iconClass = computed(() => (isDanger.value ? 'confirm-icon--danger' : 'confirm-icon--info'))

const confirmBtnClass = computed(() => {
  const dialog = active.value
  if (!dialog || dialog.kind === 'alert' || !dialog.danger) return 'btn--primary'
  return 'btn--danger'
})

watch(active, async (dialog) => {
  window.removeEventListener('keydown', onWindowKey)
  if (!dialog) return
  window.addEventListener('keydown', onWindowKey)
  await nextTick()
  const focusEl =
    dialog.kind === 'confirm' && dialog.danger ? cancelEl.value : confirmEl.value
  focusEl?.focus()
})

onUnmounted(() => {
  window.removeEventListener('keydown', onWindowKey)
})

function onWindowKey(event: KeyboardEvent): void {
  if (event.key !== 'Escape') return
  event.preventDefault()
  onDismiss()
}

function onDismiss(): void {
  const dialog = active.value
  if (!dialog) return
  dialogStore.resolve(dialog.kind === 'alert')
}

function onOverlay(): void {
  onDismiss()
}
</script>

<style scoped>
.confirm-overlay {
  /* Above preview / extraction modals (same token as FirstRunNotice). */
  z-index: var(--z-super-modal);
}

.confirm-box {
  background: var(--bg-modal);
  border-radius: 12px;
  padding: 20px;
  width: 360px;
  max-width: calc(100vw - 32px);
  box-shadow: 0 8px 32px var(--shadow-lg);
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.confirm-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  margin: 0 auto;
  border-radius: 50%;
}

.confirm-icon--danger {
  background: var(--danger-bg);
  color: var(--danger);
}

.confirm-icon--info {
  background: color-mix(in srgb, var(--accent) 12%, var(--bg-surface));
  color: var(--accent);
}

.confirm-title {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
  text-align: center;
  color: var(--text-primary);
}

.confirm-message {
  margin: 0;
  font-size: 14px;
  line-height: 1.5;
  text-align: center;
  color: var(--text-primary);
  word-break: break-word;
}

.confirm-message--solo {
  font-size: 15px;
  font-weight: 600;
}

.confirm-actions {
  display: flex;
  gap: 8px;
  margin-top: 2px;
}

.confirm-btn {
  flex: 1;
  min-height: 32px;
  border-radius: 7px;
  font-size: 13px;
}
</style>
