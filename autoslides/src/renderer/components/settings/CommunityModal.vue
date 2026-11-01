<template>
  <Teleport to="body">
    <div class="modal-overlay" @click.self="emit('close')" @keydown="onKeydown">
      <div
        ref="dialogEl"
        class="dialog-box community-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="community-title"
        aria-describedby="community-help"
        @click.stop
      >
        <h3 id="community-title" class="dialog-title">{{ $t('titlebar.joinCommunity') }}</h3>
        <p id="community-help" class="dialog-help">{{ $t('titlebar.communityScanHint') }}</p>
        <img
          class="community-qr"
          :src="communityQr"
          :alt="$t('titlebar.communityQrAlt')"
          width="408"
          height="408"
          draggable="false"
        />
        <p v-if="failed" class="community-error" role="alert">{{ $t('titlebar.communityOpenFailed') }}</p>
        <div class="dialog-actions">
          <button ref="closeButton" type="button" class="btn dialog-btn" @click="emit('close')">
            {{ $t('titlebar.close') }}
          </button>
          <button type="button" class="btn btn--primary dialog-btn" :disabled="opening" @click="openQQ">
            {{ opening ? $t('titlebar.communityOpening') : $t('titlebar.communityOpenQQ') }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { nextTick, onMounted, ref } from 'vue'
import { createLogger } from '@shared/utils/logger'
// Bundled QR payload: https://qm.qq.com/cgi-bin/qm/qr?k=46c1-VkItO41Shd6vayUxoUUAwzGxYS2&jump_from=webapi&qr=1#
import communityQr from '@renderer/assets/community-qr.png'

const emit = defineEmits<{ (e: 'close'): void }>()
const log = createLogger('CommunityModal')
const dialogEl = ref<HTMLElement | null>(null)
const closeButton = ref<HTMLButtonElement | null>(null)
const opening = ref(false)
const failed = ref(false)

onMounted(() => {
  void nextTick(() => closeButton.value?.focus())
})

function onKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape') {
    event.preventDefault()
    event.stopPropagation()
    emit('close')
  } else if (event.key === 'Tab') {
    const buttons = dialogEl.value?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')
    if (!buttons?.length) return
    const first = buttons[0]
    const last = buttons[buttons.length - 1]
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault()
      first.focus()
    }
  }
}

async function openQQ(): Promise<void> {
  if (opening.value) return
  opening.value = true
  failed.value = false
  try {
    const result = await window.electronAPI.shell.openCommunity()
    if (!result.success) throw new Error(result.error)
  } catch (error) {
    log.error('Failed to open QQ community:', error)
    failed.value = true
  } finally {
    opening.value = false
  }
}
</script>

<style scoped>
.community-dialog {
  width: 360px;
  max-width: calc(100vw - 32px);
  overflow-y: auto;
}

.community-qr {
  display: block;
  align-self: center;
  width: 256px;
  max-width: 100%;
  height: auto;
  flex-shrink: 0;
  border-radius: 8px;
  image-rendering: pixelated;
}

.community-error {
  margin: 0;
  color: var(--danger);
  font-size: 12px;
  line-height: 1.4;
  text-align: center;
}
</style>
