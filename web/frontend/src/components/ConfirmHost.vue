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
  gap: 14px;
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
  font-size: 13px;
  line-height: 1.5;
  text-align: center;
  color: var(--text-secondary);
  word-break: break-word;
}

.confirm-message--solo {
  font-size: 15px;
  font-weight: 600;
  color: var(--text-primary);
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
