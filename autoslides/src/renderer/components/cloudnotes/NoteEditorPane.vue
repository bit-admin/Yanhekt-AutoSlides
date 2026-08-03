<template>
  <!-- Right pane, notes mode: title/group/share header + the Editor.js
       document. The editor lifecycle lives in useNoteEditor (constructed by
       the parent — openNote must work while this pane is unmounted in index
       mode); this component only renders the pane and binds the holder. -->
  <section class="cn-editor">
    <!-- Mirrors CloudIndexViewer's empty state (icon + caption) for consistency. -->
    <div v-if="!cn.selectedNote.value" class="cn-editor-empty">
      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
        <polyline points="14 2 14 8 20 8"/>
        <line x1="16" y1="13" x2="8" y2="13"/>
        <line x1="16" y1="17" x2="8" y2="17"/>
      </svg>
      <p>{{ $t('cloudNotes.selectNote') }}</p>
    </div>
    <template v-else>
      <div class="cn-editor-header">
        <input
          v-model="ed.editableTitle.value"
          class="text-input cn-title-input"
          :placeholder="$t('cloudNotes.untitled')"
          @blur="ed.onSaveTitle"
          @keyup.enter="ed.onSaveTitle"
        />
        <select class="text-input cn-group-select" :value="String(cn.selectedNote.value.note_group_id ?? 0)" @change="onMoveGroup">
          <option value="0">{{ $t('cloudNotes.defaultGroup') }}</option>
          <option v-for="g in cn.groups.value.filter(x => x.id !== 0)" :key="g.id" :value="String(g.id)">{{ g.name }}</option>
        </select>
        <!-- Share is always available for the open note (image check happens in the
             modal so live edits that add images don't hide the button). Export stays
             non-ASnote only. Share sits left of Export when both show. -->
        <button
          class="btn btn--ghost cn-share-btn"
          :title="$t('cloudNotes.shareTip')"
          @click="emit('share')"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
            <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
          </svg>
          <span>{{ $t('cloudNotes.shareButton') }}</span>
        </button>
        <button
          v-if="isExportableNote"
          class="btn btn--ghost cn-share-btn"
          :title="$t('cloudNotes.exportTip')"
          @click="emit('export')"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
          </svg>
          <span>{{ $t('cloudNotes.exportButton') }}</span>
        </button>
        <span class="cn-save-status" :class="ed.saveStatus.value">
          <template v-if="ed.saveStatus.value === 'saving'">{{ $t('cloudNotes.saving') }}</template>
          <template v-else-if="ed.saveStatus.value === 'saved'">{{ $t('cloudNotes.saved') }}</template>
          <template v-else>{{ $t('cloudNotes.idle') }}</template>
        </span>
      </div>
      <div class="cn-editor-holder custom-scrollbar">
        <div :ref="(el) => (ed.editorHolder.value = el as HTMLElement | null)" class="cn-editor-doc"></div>
      </div>
    </template>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { useCloudNotes } from '@features/cloudNotes/useCloudNotes'
import type { useNoteEditor } from '@features/cloudNotes/useNoteEditor'
import { cloudStorageStore } from '@features/cloudNotes/cloudStorageStore'

const props = defineProps<{
  cn: ReturnType<typeof useCloudNotes>
  ed: ReturnType<typeof useNoteEditor>
}>()

const emit = defineEmits<{
  (e: 'share'): void
  (e: 'export'): void
}>()

/** Notes outside ASnote (ASuser, Ungrouped, custom folders) export to a file. */
const isExportableNote = computed(() => {
  const note = props.cn.selectedNote.value
  if (!note) return false
  const managedGroupId = cloudStorageStore.managedGroupId.value
  if (managedGroupId == null) return true
  return Number(note.note_group_id ?? 0) !== Number(managedGroupId)
})

async function onMoveGroup(e: Event): Promise<void> {
  const note = props.cn.selectedNote.value
  if (!note) return
  const prevId = note.id
  const groupId = Number((e.target as HTMLSelectElement).value)
  // Ungroup recreates the note — ship the live editor document so we don't drop edits.
  const content = groupId === 0 ? await props.ed.currentNoteContent() : undefined
  const newId = await props.cn.moveNoteToGroup(prevId, groupId, content)
  if (newId == null) return
  if (newId !== prevId) {
    await props.ed.openNote(newId)
  } else {
    note.note_group_id = groupId
  }
}
</script>

<style scoped>
.cn-editor {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.cn-editor-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
  border-bottom: 1px solid var(--border-color);
}

.cn-title-input {
  flex: 1;
  min-width: 0;
  font-weight: 600;
}

.cn-group-select {
  width: 120px;
  flex-shrink: 0;
}

.cn-save-status {
  flex-shrink: 0;
  font-size: 12px;
  white-space: nowrap;
  min-width: 50px;
  text-align: center;
  color: var(--text-muted);
  transition: color 0.2s ease;
}

.cn-save-status.saving {
  color: var(--text-secondary);
}

.cn-save-status.saved {
  color: var(--success);
}

.cn-share-btn {
  flex-shrink: 0;
  gap: 5px;
  padding: 4px 12px;
  font-size: 12px;
}

.cn-editor-holder {
  flex: 1;
  overflow-y: auto;
  padding: 28px 24px 96px;
  color: var(--text-primary);
}

.cn-editor-doc {
  max-width: 760px;
  margin: 0 auto;
  /* Left gutter houses Editor.js's block toolbar (＋ / drag handle), which sits
     at right:100% of the content column. Without this the toolbar overshoots
     into the panel divider. */
  padding: 0 16px 0 56px;
  box-sizing: border-box;
}

/* Empty state — same icon+caption composition as CloudIndexViewer's
   .ci-viewer-empty so the two right-pane placeholders read as one design. */
.cn-editor-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  flex: 1;
  color: var(--text-secondary);
  font-size: 14px;
}

.cn-editor-empty p {
  margin: 0;
}

.cn-editor-empty svg {
  color: var(--text-muted);
  opacity: 0.7;
}

/* Layout only — Editor.js chrome/theme lives in shared/styles/editor.css. */

/* Left-align content (don't use Editor.js's own 650px centering); the doc's
   left padding provides the toolbar gutter instead, so it never overshoots. */
.cn-editor-doc :deep(.ce-block__content),
.cn-editor-doc :deep(.ce-toolbar__content) {
  max-width: 100%;
  margin: 0;
}
</style>
