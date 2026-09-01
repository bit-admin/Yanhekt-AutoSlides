<template>
  <Teleport to="body">
    <div class="modal-overlay" @click.self="onOverlay">
      <div
        class="dialog-box share-slide-box"
        role="dialog"
        aria-modal="true"
        :aria-labelledby="titleId"
        @click.stop
      >
        <h3 :id="titleId" class="dialog-title">{{ $t('playback.loadFromLinkTitle') }}</h3>
        <p class="dialog-help">{{ $t('playback.loadFromLinkHint') }}</p>
        <input
          ref="inputEl"
          v-model="link"
          type="text"
          class="input-field share-slide-input"
          :placeholder="$t('playback.loadFromLinkPastePlaceholder')"
          :disabled="resolving"
          spellcheck="false"
          autocomplete="off"
          @keydown.enter.prevent="onSubmit"
        />
        <p v-if="error" class="share-slide-error">{{ error }}</p>
        <div class="dialog-actions">
          <button type="button" class="btn dialog-btn" :disabled="resolving" @click="emit('close')">
            {{ $t('trash.cancel') }}
          </button>
          <button
            type="button"
            class="btn btn--primary dialog-btn"
            :disabled="resolving || !link.trim()"
            @click="onSubmit"
          >
            {{ resolving ? $t('playback.loadFromLinkResolving') : $t('playback.loadFromLinkAction') }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { nextTick, onMounted, ref, useId } from 'vue'

const props = defineProps<{
  resolving: boolean
  error: string
}>()

const emit = defineEmits<{
  close: []
  submit: [link: string]
}>()

const titleId = useId()
const link = ref('')
const inputEl = ref<HTMLInputElement | null>(null)

onMounted(() => {
  void nextTick(() => inputEl.value?.focus())
})

function onSubmit(): void {
  if (props.resolving) return
  const raw = link.value.trim()
  if (!raw) return
  emit('submit', raw)
}

function onOverlay(): void {
  if (props.resolving) return
  emit('close')
}
</script>

<style scoped>
.share-slide-box {
  width: 460px;
  max-width: 92vw;
}

.share-slide-input {
  width: 100%;
}

.share-slide-error {
  margin: -6px 0 0;
  font-size: 12px;
  color: var(--danger);
  line-height: 1.4;
}
</style>
