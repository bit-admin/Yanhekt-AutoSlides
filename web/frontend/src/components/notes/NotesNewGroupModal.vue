<template>
  <!-- Compact prompt modal (matches HomePage "Add Saved Search" / Electron NewGroupModal) -->
  <div class="modal-overlay" @click.self="emit('close')">
    <div class="ngm-box" role="dialog" aria-modal="true" :aria-label="$t('cloudNotes.newGroupTitle')">
      <h3 class="ngm-title">{{ $t('cloudNotes.newGroupTitle') }}</h3>
      <input
        ref="inputEl"
        v-model="name"
        class="ngm-input"
        :maxlength="NOTE_GROUP_NAME_MAX"
        :placeholder="$t('cloudNotes.newGroupPlaceholder', { max: NOTE_GROUP_NAME_MAX })"
        @keyup.enter="submit"
        @keyup.esc="emit('close')"
      />
      <p class="ngm-hint">{{ $t('cloudNotes.newGroupHint', { max: NOTE_GROUP_NAME_MAX }) }}</p>
      <div class="ngm-actions">
        <button class="btn ngm-btn" type="button" @click="emit('close')">
          {{ $t('cloudNotes.cancel') }}
        </button>
        <button
          class="btn btn--primary ngm-btn"
          type="button"
          :disabled="!name.trim()"
          @click="submit"
        >
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
.ngm-box {
  background: var(--bg-modal);
  border-radius: 12px;
  padding: 20px;
  width: 320px;
  max-width: calc(100vw - 32px);
  box-shadow: 0 8px 32px var(--shadow-lg);
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.ngm-title {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
  text-align: center;
  color: var(--text-primary);
}

.ngm-input {
  width: 100%;
  box-sizing: border-box;
  padding: 8px 11px;
  border: 1px solid var(--border-input);
  border-radius: 7px;
  font-size: 13px;
  outline: none;
  transition: border-color 0.2s;
  background-color: var(--bg-input);
  color: var(--text-primary);
}

.ngm-input::placeholder {
  color: var(--text-muted);
}

.ngm-input:focus {
  border-color: var(--accent);
}

.ngm-hint {
  margin: -6px 0 0;
  font-size: 12px;
  color: var(--text-muted);
  line-height: 1.4;
}

.ngm-actions {
  display: flex;
  gap: 8px;
  margin-top: 2px;
}

.ngm-btn {
  flex: 1;
  min-height: 32px;
  border-radius: 7px;
  font-size: 13px;
}
</style>
