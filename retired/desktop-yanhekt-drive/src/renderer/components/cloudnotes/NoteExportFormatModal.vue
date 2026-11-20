<template>
  <div v-if="visible" class="modal-overlay" @click.self="close">
    <div
      class="dialog-box cn-export-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="cn-export-title"
    >
      <h3 id="cn-export-title" class="dialog-title">{{ $t('cloudNotes.exportTitle') }}</h3>
      <p class="dialog-help">{{ $t('cloudNotes.exportHint') }}</p>

      <div class="cn-export-cards" role="group" :aria-label="$t('cloudNotes.exportTitle')">
        <button
          v-for="f in formats"
          :key="f.id"
          type="button"
          class="cn-format-card"
          :class="{ 'is-busy': busy && activeFormat === f.id }"
          :disabled="busy"
          @click="run(f.id)"
        >
          <span class="cn-format-icon" :class="`cn-format-icon--${f.id}`" aria-hidden="true">
            <!-- PDF -->
            <svg v-if="f.id === 'pdf'" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <path d="M14 2v6h6"/>
              <path d="M8 13h2.2a1.4 1.4 0 0 1 0 2.8H8V18"/>
              <path d="M13 13v5M13 13h1.6a1.4 1.4 0 0 1 0 2.8H13"/>
              <path d="M18 18v-5h.01"/>
            </svg>
            <!-- Markdown / zip -->
            <svg v-else-if="f.id === 'markdown'" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <path d="M14 2v6h6"/>
              <path d="M8 14.5l2 2 2-2M10 16.5v-5"/>
              <path d="M15 11.5v5l2-2"/>
            </svg>
            <!-- Word -->
            <svg v-else width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <path d="M14 2v6h6"/>
              <path d="M8 13l1.4 5L12 13l2.6 5L16 13"/>
            </svg>
          </span>
          <span class="cn-format-copy">
            <span class="cn-format-name-row">
              <span class="cn-format-name">{{ f.label }}</span>
              <span class="cn-format-ext">{{ f.ext }}</span>
            </span>
            <span class="cn-format-desc">{{ f.desc }}</span>
          </span>
          <span class="cn-format-trail" aria-hidden="true">
            <span v-if="busy && activeFormat === f.id" class="cn-format-spinner"></span>
            <svg v-else width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="9 18 15 12 9 6"/>
            </svg>
          </span>
        </button>
      </div>

      <p v-if="error" class="cn-export-error">{{ error }}</p>
      <p v-else-if="busy" class="cn-export-status">{{ $t('cloudNotes.exportBusy') }}</p>

      <div class="dialog-actions">
        <button class="btn dialog-btn" type="button" :disabled="busy" @click="close">{{ $t('cloudNotes.cancel') }}</button>
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
const activeFormat = ref<Format | null>(null)

const formats = computed<{ id: Format; label: string; desc: string; ext: string }[]>(() => [
  { id: 'pdf', label: t('cloudNotes.exportPdf'), desc: t('cloudNotes.exportPdfDesc'), ext: '.pdf' },
  { id: 'markdown', label: t('cloudNotes.exportMarkdown'), desc: t('cloudNotes.exportMarkdownDesc'), ext: '.zip' },
  { id: 'docx', label: t('cloudNotes.exportDocx'), desc: t('cloudNotes.exportDocxDesc'), ext: '.docx' },
])

function open(): void {
  error.value = ''
  busy.value = false
  activeFormat.value = null
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
  activeFormat.value = format
  error.value = ''
  try {
    const content = await props.getContent()
    const title = managedNoteDisplayName(note.title)
    const res = await window.electronAPI.noteExport.export({ title, content, format })
    if (res.canceled) {
      busy.value = false
      activeFormat.value = null
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
    activeFormat.value = null
  }
}

defineExpose({ open })
</script>

<style scoped>
.cn-export-modal {
  width: 400px;
  max-width: calc(100vw - 32px);
}

.cn-export-cards {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.cn-format-card {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  padding: 11px 12px;
  border: 1px solid var(--border-color);
  border-radius: 10px;
  background: var(--bg-surface);
  cursor: pointer;
  text-align: left;
  transition: border-color 0.15s ease, background-color 0.15s ease, transform 0.15s ease;
}

.cn-format-card:hover:not(:disabled) {
  border-color: var(--accent);
  background: color-mix(in srgb, var(--accent) 6%, var(--bg-surface));
  transform: translateY(-1px);
}

.cn-format-card:disabled {
  cursor: default;
  opacity: 0.7;
}

.cn-format-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: 8px;
  flex-shrink: 0;
}

.cn-format-icon--pdf {
  background: color-mix(in srgb, var(--danger) 14%, var(--bg-surface));
  color: var(--danger);
}

.cn-format-icon--markdown {
  background: var(--bg-elevated);
  color: var(--text-primary);
}

.cn-format-icon--docx {
  background: color-mix(in srgb, var(--accent) 14%, var(--bg-surface));
  color: var(--accent);
}

.cn-format-copy {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
  flex: 1 1 auto;
}

.cn-format-name-row {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.cn-format-name {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
}

.cn-format-ext {
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.02em;
  color: var(--text-muted);
  background: var(--bg-elevated);
  border: 1px solid var(--border-color);
  border-radius: 4px;
  padding: 1px 5px;
}

.cn-format-desc {
  font-size: 12px;
  color: var(--text-muted);
  line-height: 1.35;
}

.cn-format-trail {
  display: flex;
  align-items: center;
  color: var(--text-muted);
  flex-shrink: 0;
}

.cn-format-card:hover:not(:disabled) .cn-format-trail {
  color: var(--accent);
}

.cn-format-spinner {
  width: 14px;
  height: 14px;
  border: 2px solid var(--border-color);
  border-top-color: var(--accent);
  border-radius: 50%;
  animation: cn-export-spin 0.7s linear infinite;
}

@keyframes cn-export-spin {
  to { transform: rotate(360deg); }
}

.cn-export-status,
.cn-export-error {
  margin: 0;
  min-height: 16px;
  font-size: 12px;
  color: var(--text-secondary);
}

.cn-export-error {
  color: var(--danger);
}
</style>
