<template>
  <!-- New Group modal (matches HomePage "Add Saved Search" modal) -->
  <div v-if="open" class="modal-overlay" @click.self="emit('close')">
    <div class="cn-modal-box">
      <h3 class="cn-modal-title">{{ $t('cloudNotes.newGroupTitle') }}</h3>
      <input
        ref="newGroupInput"
        v-model="newGroupName"
        class="cn-modal-input"
        :maxlength="NOTE_GROUP_NAME_MAX"
        :placeholder="$t('cloudNotes.newGroupPlaceholder', { max: NOTE_GROUP_NAME_MAX })"
        @keyup.enter="onCreateGroup"
        @keyup.esc="emit('close')"
      />
      <p class="cn-modal-help">{{ $t('cloudNotes.newGroupHelp', { max: NOTE_GROUP_NAME_MAX }) }}</p>
      <div class="cn-modal-actions">
        <button class="btn cn-modal-btn" @click="emit('close')">{{ $t('cloudNotes.cancel') }}</button>
        <button class="btn btn--primary cn-modal-btn" :disabled="!newGroupName.trim()" @click="onCreateGroup">
          {{ $t('cloudNotes.add') }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { nextTick, ref, watch } from 'vue'
import { NOTE_GROUP_NAME_MAX } from '@common/notesTypes'
import type { useCloudNotes } from '@features/cloudNotes/useCloudNotes'

const props = defineProps<{
  open: boolean
  cn: ReturnType<typeof useCloudNotes>
}>()

const emit = defineEmits<{
  (e: 'close'): void
}>()

const newGroupName = ref('')
const newGroupInput = ref<HTMLInputElement | null>(null)

async function onCreateGroup(): Promise<void> {
  const name = newGroupName.value.trim()
  if (!name) return
  const ok = await props.cn.createGroup(name)
  if (ok) {
    newGroupName.value = ''
    emit('close')
  }
}

watch(() => props.open, (open) => {
  if (open) {
    nextTick(() => newGroupInput.value?.focus())
  } else {
    newGroupName.value = ''
  }
})
</script>

<style scoped>
.cn-modal-box {
  background: var(--bg-modal);
  border-radius: 12px;
  padding: 20px;
  width: 320px;
  box-shadow: 0 8px 32px var(--shadow-lg);
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.cn-modal-title {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
  text-align: center;
  color: var(--text-primary);
}

.cn-modal-input {
  padding: 8px 11px;
  border: 1px solid var(--border-input);
  border-radius: 7px;
  font-size: 13px;
  outline: none;
  transition: border-color 0.2s;
  background-color: var(--bg-input);
  color: var(--text-primary);
}

.cn-modal-input::placeholder {
  color: var(--text-muted);
}

.cn-modal-input:focus {
  border-color: var(--accent);
}

.cn-modal-help {
  margin: -6px 0 0;
  font-size: 12px;
  color: var(--text-muted);
  line-height: 1.4;
}

.cn-modal-actions {
  display: flex;
  gap: 8px;
  margin-top: 2px;
}

.cn-modal-btn {
  flex: 1;
  min-height: 32px;
  border-radius: 7px;
  font-size: 13px;
}
</style>
