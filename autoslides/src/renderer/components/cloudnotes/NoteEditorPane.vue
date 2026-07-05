<template>
  <!-- Right pane, notes mode: title/group/share header + the Editor.js
       document. The editor lifecycle lives in useNoteEditor (constructed by
       the parent — openNote must work while this pane is unmounted in index
       mode); this component only renders the pane and binds the holder. -->
  <section class="cn-editor">
    <div v-if="!cn.selectedNote.value" class="cn-empty cn-editor-empty">{{ $t('cloudNotes.selectNote') }}</div>
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
        <button
          v-if="isManagedNoteTitle(cn.selectedNote.value.title)"
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
import { isManagedNoteTitle } from '@common/notesTypes'
import type { useCloudNotes } from '@features/cloudNotes/useCloudNotes'
import type { useNoteEditor } from '@features/cloudNotes/useNoteEditor'

const props = defineProps<{
  cn: ReturnType<typeof useCloudNotes>
  ed: ReturnType<typeof useNoteEditor>
}>()

const emit = defineEmits<{
  (e: 'share'): void
}>()

async function onMoveGroup(e: Event): Promise<void> {
  const note = props.cn.selectedNote.value
  if (!note) return
  const groupId = Number((e.target as HTMLSelectElement).value)
  await props.cn.moveNoteToGroup(note.id, groupId)
  note.note_group_id = groupId
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

/* This pane's copy of the shared empty-state style (the parent keeps its own
   for the note list / sign-in states). */
.cn-empty {
  padding: 24px;
  text-align: center;
  color: var(--text-muted);
  font-size: 13px;
}

.cn-editor-empty {
  margin: auto;
}

/* ── Editor.js theming (maps its hardcoded light chrome to design tokens so
      light + dark both look right) ──────────────────────────────────────── */

/* Left-align content (don't use Editor.js's own 650px centering); the doc's
   left padding provides the toolbar gutter instead, so it never overshoots. */
.cn-editor-doc :deep(.ce-block__content),
.cn-editor-doc :deep(.ce-toolbar__content) {
  max-width: 100%;
  margin: 0;
}

.cn-editor-doc :deep(.ce-paragraph),
.cn-editor-doc :deep(.ce-header),
.cn-editor-doc :deep(.cdx-block) {
  color: var(--text-primary);
}

.cn-editor-doc :deep(a) {
  color: var(--link-color);
}

/* Placeholders */
.cn-editor-doc :deep([data-placeholder]:empty::before),
.cn-editor-doc :deep(.cdx-block[data-placeholder]:empty::before) {
  color: var(--text-muted);
}

/* Left-gutter controls: + button and drag/settings handle */
.cn-editor-doc :deep(.ce-toolbar__plus),
.cn-editor-doc :deep(.ce-toolbar__settings-btn) {
  color: var(--text-secondary);
}

.cn-editor-doc :deep(.ce-toolbar__plus:hover),
.cn-editor-doc :deep(.ce-toolbar__settings-btn:hover) {
  background-color: var(--bg-hover);
}

/* Floating surfaces: toolbox popover, inline toolbar, conversion toolbar,
   block-settings popover */
.cn-editor-doc :deep(.ce-popover),
.cn-editor-doc :deep(.ce-inline-toolbar),
.cn-editor-doc :deep(.ce-conversion-toolbar),
.cn-editor-doc :deep(.ce-settings) {
  background-color: var(--bg-elevated);
  border-color: var(--border-color);
  color: var(--text-primary);
  box-shadow: var(--shadow-md);
}

.cn-editor-doc :deep(.ce-popover__item:hover),
.cn-editor-doc :deep(.ce-inline-tool:hover),
.cn-editor-doc :deep(.ce-inline-toolbar__dropdown:hover),
.cn-editor-doc :deep(.ce-conversion-tool:hover) {
  background-color: var(--bg-hover);
}

.cn-editor-doc :deep(.ce-popover__item-icon),
.cn-editor-doc :deep(.ce-conversion-tool__icon) {
  background-color: var(--bg-surface);
  border-color: var(--border-color);
  color: var(--text-primary);
}

/* Inputs inside Editor.js (e.g. image caption, quote text/caption) */
.cn-editor-doc :deep(.cdx-input) {
  background-color: var(--bg-input);
  border-color: var(--border-input);
  color: var(--text-primary);
}

/* Code block */
.cn-editor-doc :deep(.ce-code__textarea) {
  background-color: var(--bg-input);
  border-color: var(--border-input);
  color: var(--text-primary);
}

/* Table — themes itself through these three CSS variables */
.cn-editor-doc :deep(.tc-wrap) {
  --color-background: var(--bg-subtle);
  --color-text-secondary: var(--text-muted);
  --color-border: var(--border-color);
}

/* Delimiter dots */
.cn-editor-doc :deep(.ce-delimiter) {
  color: var(--text-muted);
}
</style>
