<template>
  <div class="modal-overlay" @click.self="emit('close')">
    <div class="modal-content ngm-modal">
      <div class="modal-header">
        <h3>{{ $t('cloudNotes.newGroupTitle') }}</h3>
        <button class="modal-close" type="button" @click="emit('close')">×</button>
      </div>
      <div class="modal-body">
        <input
          ref="inputEl"
          v-model="name"
          class="text-input ngm-input"
          :maxlength="NOTE_GROUP_NAME_MAX"
          :placeholder="$t('cloudNotes.newGroupPlaceholder', { max: NOTE_GROUP_NAME_MAX })"
          @keyup.enter="submit"
        />
        <p class="ngm-hint">{{ $t('cloudNotes.newGroupHint', { max: NOTE_GROUP_NAME_MAX }) }}</p>
      </div>
      <div class="modal-footer">
        <button class="btn" type="button" @click="emit('close')">{{ $t('cloudNotes.cancel') }}</button>
        <button class="btn btn--primary" type="button" :disabled="!name.trim()" @click="submit">
          {{ $t('cloudNotes.add') }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { nextTick, onMounted, ref } from 'vue'
import { NOTE_GROUP_NAME_MAX } from '../../lib/notes/notesTypes'

const emit = defineEmits<{
  close: []
  create: [name: string]
}>()

const name = ref('')
const inputEl = ref<HTMLInputElement | null>(null)

onMounted(() => {
  void nextTick(() => inputEl.value?.focus())
})

function submit(): void {
  const trimmed = name.value.trim()
  if (!trimmed) return
  emit('create', trimmed)
}
</script>

<style scoped>
.ngm-modal {
  max-width: 22rem;
}

.ngm-input {
  width: 100%;
}

.ngm-hint {
  margin: 8px 0 0;
  font-size: 12px;
  color: var(--text-muted);
}
</style>
