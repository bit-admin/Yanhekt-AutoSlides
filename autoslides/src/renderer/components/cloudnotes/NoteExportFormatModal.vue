<template>
  <div v-if="visible" class="modal-overlay" @click.self="close">
    <div class="cn-modal-box cn-export-box">
      <h3 class="cn-modal-title">{{ $t('cloudNotes.exportTitle') }}</h3>
      <p class="cn-modal-help">{{ $t('cloudNotes.exportHint') }}</p>
      <div class="cn-export-formats">
        <button
          v-for="f in formats"
          :key="f.id"
          class="cn-export-format"
          :disabled="busy"
          @click="run(f.id)"
        >
          <span class="cn-export-format-name">{{ f.label }}</span>
          <span class="cn-export-format-desc">{{ f.desc }}</span>
        </button>
      </div>
      <p v-if="busy" class="cn-export-status">{{ $t('cloudNotes.exportBusy') }}</p>
      <p v-if="error" class="cn-export-status cn-export-error">{{ error }}</p>
      <div class="cn-modal-actions">
        <button class="btn cn-modal-btn" :disabled="busy" @click="close">{{ $t('cloudNotes.cancel') }}</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { managedNoteDisplayName } from '@common/notesTypes'
import type { useCloudNotes } from '@features/cloudNotes/useCloudNotes'

type Format = 'pdf' | 'markdown' | 'docx'

const props = defineProps<{
  cn: ReturnType<typeof useCloudNotes>
  getContent: () => Promise<string>
}>()

const { t } = useI18n()
const visible = ref(false)
const busy = ref(false)
const error = ref('')

const formats = computed<{ id: Format; label: string; desc: string }[]>(() => [
  { id: 'pdf', label: t('cloudNotes.exportPdf'), desc: t('cloudNotes.exportPdfDesc') },
  { id: 'markdown', label: t('cloudNotes.exportMarkdown'), desc: t('cloudNotes.exportMarkdownDesc') },
  { id: 'docx', label: t('cloudNotes.exportDocx'), desc: t('cloudNotes.exportDocxDesc') },
])

function open(): void {
  error.value = ''
  busy.value = false
  visible.value = true
}

function close(): void {
  if (busy.value) return
  visible.value = false
}

async function run(format: Format): Promise<void> {
  const note = props.cn.selectedNote.value
  if (!note) return
  busy.value = true
  error.value = ''
  try {
    const content = await props.getContent()
    const title = managedNoteDisplayName(note.title)
    const res = await window.electronAPI.noteExport.export({ title, content, format })
    if (res.canceled) {
      busy.value = false
      return
    }
    if (res.ok) {
      visible.value = false
    } else {
      error.value = res.error || t('cloudNotes.exportFailed')
    }
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  } finally {
    busy.value = false
  }
}

defineExpose({ open })
</script>

<style scoped>
/* Matches the Drive modals (NewGroupModal): rounded box, centered title, no
   header bar / close button / footer chrome. */
.cn-modal-box {
  background: var(--bg-modal);
  border-radius: 12px;
  padding: 20px;
  width: 360px;
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

.cn-modal-help {
  margin: -6px 0 0;
  font-size: 12px;
  color: var(--text-muted);
  line-height: 1.4;
}

.cn-export-formats {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.cn-export-format {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 2px;
  padding: 11px 13px;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  background-color: var(--bg-surface);
  cursor: pointer;
  text-align: left;
  transition: border-color 0.15s ease, background-color 0.15s ease;
}

.cn-export-format:hover:not(:disabled) {
  border-color: var(--accent);
  background-color: var(--bg-hover);
}

.cn-export-format:disabled {
  opacity: 0.6;
  cursor: default;
}

.cn-export-format-name {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
}

.cn-export-format-desc {
  font-size: 12px;
  color: var(--text-muted);
}

.cn-export-status {
  margin: 0;
  font-size: 12px;
  color: var(--text-secondary);
}

.cn-export-error {
  color: var(--danger);
}

.cn-modal-actions {
  display: flex;
  justify-content: flex-end;
  margin-top: 2px;
}

.cn-modal-btn {
  min-height: 32px;
  padding: 0 18px;
  border-radius: 7px;
  font-size: 13px;
}
</style>
