<template>
  <section class="nec-canvas">
    <div class="nec-topbar">
      <button
        v-if="mobile"
        type="button"
        class="nec-menu-btn"
        :aria-label="$t('cloudNotes.openSidebar')"
        @click="emit('open-sidebar')"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" />
        </svg>
      </button>
      <div class="nec-topbar-spacer" />
      <span v-if="hasNote" class="nec-save" :class="saveStatus">
        <template v-if="saveStatus === 'saving'">{{ $t('cloudNotes.saving') }}</template>
        <template v-else-if="saveStatus === 'saved'">{{ $t('cloudNotes.saved') }}</template>
      </span>
    </div>

    <div v-if="!hasNote" class="nec-empty">
      <div class="nec-empty-card">
        <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="16" y1="13" x2="8" y2="13" />
          <line x1="16" y1="17" x2="8" y2="17" />
        </svg>
        <p>{{ $t('cloudNotes.selectNote') }}</p>
        <button type="button" class="nec-empty-cta" @click="emit('create-note')">
          {{ $t('cloudNotes.newPage') }}
        </button>
      </div>
    </div>

    <div v-else class="nec-doc-scroll custom-scrollbar">
      <div class="nec-doc">
        <input
          class="nec-title"
          :value="title"
          :placeholder="$t('cloudNotes.untitled')"
          @input="onTitleInput"
          @blur="emit('save-title')"
          @keyup.enter="($event.target as HTMLInputElement).blur()"
        />

        <div class="nec-meta">
          <label class="nec-meta-label">
            <span class="nec-meta-caption">{{ $t('cloudNotes.folderLabel') }}</span>
            <select class="nec-group-select" :value="String(groupId)" @change="onGroupChange">
              <option value="0">{{ $t('cloudNotes.defaultGroup') }}</option>
              <option v-for="g in moveGroups" :key="g.id" :value="String(g.id)">{{ g.name }}</option>
            </select>
          </label>
        </div>

        <div
          :ref="(el) => emit('set-holder', el as HTMLElement | null)"
          class="nec-editor-doc"
        />
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import type { NoteGroup } from '../../lib/notes/notesTypes'

defineProps<{
  hasNote: boolean
  title: string
  groupId: number
  moveGroups: NoteGroup[]
  saveStatus: 'idle' | 'saving' | 'saved'
  mobile: boolean
}>()

const emit = defineEmits<{
  'open-sidebar': []
  'create-note': []
  'update:title': [value: string]
  'save-title': []
  'move-group': [groupId: number]
  'set-holder': [el: HTMLElement | null]
}>()

function onTitleInput(e: Event): void {
  emit('update:title', (e.target as HTMLInputElement).value)
}

function onGroupChange(e: Event): void {
  emit('move-group', Number((e.target as HTMLSelectElement).value))
}
</script>

<style scoped>
.nec-canvas {
  flex: 1;
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
  background: var(--nt-bg, #ffffff);
  color: var(--nt-text, #37352f);
}

.nec-topbar {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 44px;
  padding: 6px 14px;
  flex-shrink: 0;
}

.nec-menu-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--nt-text-muted, #787774);
  cursor: pointer;
}

.nec-menu-btn:hover {
  background: var(--nt-sidebar-hover, rgba(0, 0, 0, 0.04));
  color: var(--nt-text, #37352f);
}

.nec-topbar-spacer {
  flex: 1;
}

.nec-save {
  font-size: 12px;
  color: var(--nt-text-muted, #787774);
  min-width: 3.5rem;
  text-align: right;
}

.nec-save.saving {
  color: var(--nt-text-muted, #787774);
}

.nec-save.saved {
  color: var(--success, #0f7b6c);
}

.nec-empty {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
}

.nec-empty-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  color: var(--nt-text-muted, #787774);
  text-align: center;
}

.nec-empty-card p {
  margin: 0;
  font-size: 14px;
}

.nec-empty-cta {
  margin-top: 4px;
  padding: 8px 14px;
  border: none;
  border-radius: 6px;
  background: var(--nt-sidebar-active, rgba(0, 0, 0, 0.08));
  color: var(--nt-text, #37352f);
  font-size: 13.5px;
  font-weight: 500;
  cursor: pointer;
}

.nec-empty-cta:hover {
  background: var(--nt-sidebar-hover, rgba(0, 0, 0, 0.12));
}

.nec-doc-scroll {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
}

.nec-doc {
  max-width: var(--nt-doc-max, 48rem);
  margin: 0 auto;
  padding: 12px 48px 120px;
  box-sizing: border-box;
}

.nec-title {
  display: block;
  width: 100%;
  box-sizing: border-box;
  margin: 0;
  padding: 8px 0 4px;
  border: none;
  background: transparent;
  color: var(--nt-text, #37352f);
  font-size: var(--nt-title-size, 2.5rem);
  font-weight: 700;
  line-height: 1.2;
  letter-spacing: -0.02em;
  font-family: inherit;
}

.nec-title::placeholder {
  color: var(--nt-text-muted, #787774);
  opacity: 0.55;
}

.nec-title:focus {
  outline: none;
}

.nec-meta {
  display: flex;
  align-items: center;
  gap: 12px;
  margin: 4px 0 20px;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--nt-border, rgba(0, 0, 0, 0.06));
}

.nec-meta-label {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: var(--nt-text-muted, #787774);
}

.nec-meta-caption {
  flex-shrink: 0;
}

.nec-group-select {
  appearance: none;
  max-width: 12rem;
  padding: 4px 22px 4px 8px;
  border: 1px solid transparent;
  border-radius: 4px;
  background:
    linear-gradient(45deg, transparent 50%, var(--nt-text-muted, #787774) 50%) calc(100% - 10px) 10px / 5px 5px no-repeat,
    linear-gradient(135deg, var(--nt-text-muted, #787774) 50%, transparent 50%) calc(100% - 6px) 10px / 5px 5px no-repeat,
    transparent;
  color: var(--nt-text, #37352f);
  font-size: 12.5px;
  cursor: pointer;
}

.nec-group-select:hover {
  background-color: var(--nt-sidebar-hover, rgba(0, 0, 0, 0.04));
}

.nec-group-select:focus {
  outline: none;
  border-color: var(--nt-border, rgba(0, 0, 0, 0.12));
  background-color: var(--nt-sidebar-hover, rgba(0, 0, 0, 0.04));
}

.nec-editor-doc {
  /* Left gutter for Editor.js block toolbar (＋ / drag handle). */
  padding-left: 56px;
  box-sizing: border-box;
  min-height: 12rem;
}

/* Editor.js theming — Notion neutrals on this canvas only */
.nec-editor-doc :deep(.ce-block__content),
.nec-editor-doc :deep(.ce-toolbar__content) {
  max-width: 100%;
  margin: 0;
}

.nec-editor-doc :deep(.ce-paragraph),
.nec-editor-doc :deep(.ce-header),
.nec-editor-doc :deep(.cdx-block) {
  color: var(--nt-text, #37352f);
}

.nec-editor-doc :deep(.ce-header) {
  font-weight: 600;
  letter-spacing: -0.01em;
}

.nec-editor-doc :deep(a) {
  color: var(--nt-accent, #2383e2);
}

.nec-editor-doc :deep([data-placeholder]:empty::before),
.nec-editor-doc :deep(.cdx-block[data-placeholder]:empty::before) {
  color: var(--nt-text-muted, #787774);
}

.nec-editor-doc :deep(.ce-toolbar__plus),
.nec-editor-doc :deep(.ce-toolbar__settings-btn) {
  color: var(--nt-text-muted, #787774);
}

.nec-editor-doc :deep(.ce-toolbar__plus:hover),
.nec-editor-doc :deep(.ce-toolbar__settings-btn:hover) {
  background-color: var(--nt-sidebar-hover, rgba(0, 0, 0, 0.04));
}

.nec-editor-doc :deep(.ce-popover),
.nec-editor-doc :deep(.ce-inline-toolbar),
.nec-editor-doc :deep(.ce-conversion-toolbar),
.nec-editor-doc :deep(.ce-settings) {
  background-color: var(--nt-bg, #ffffff);
  border-color: var(--nt-border, rgba(0, 0, 0, 0.09));
  color: var(--nt-text, #37352f);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08);
}

.nec-editor-doc :deep(.ce-popover__item:hover),
.nec-editor-doc :deep(.ce-inline-tool:hover),
.nec-editor-doc :deep(.ce-inline-toolbar__dropdown:hover),
.nec-editor-doc :deep(.ce-conversion-tool:hover) {
  background-color: var(--nt-sidebar-hover, rgba(0, 0, 0, 0.04));
}

.nec-editor-doc :deep(.ce-popover__item-icon),
.nec-editor-doc :deep(.ce-conversion-tool__icon) {
  background-color: var(--nt-sidebar-bg, #f7f7f5);
  border-color: var(--nt-border, rgba(0, 0, 0, 0.09));
  color: var(--nt-text, #37352f);
}

.nec-editor-doc :deep(.cdx-input),
.nec-editor-doc :deep(.ce-code__textarea) {
  background-color: var(--nt-sidebar-bg, #f7f7f5);
  border-color: var(--nt-border, rgba(0, 0, 0, 0.09));
  color: var(--nt-text, #37352f);
}

.nec-editor-doc :deep(.tc-wrap) {
  --color-background: var(--nt-sidebar-bg, #f7f7f5);
  --color-text-secondary: var(--nt-text-muted, #787774);
  --color-border: var(--nt-border, rgba(0, 0, 0, 0.09));
}

.nec-editor-doc :deep(.ce-delimiter) {
  color: var(--nt-text-muted, #787774);
}

@media (max-width: 768px) {
  .nec-doc {
    padding: 4px 20px 96px;
  }

  .nec-title {
    font-size: 1.85rem;
  }

  .nec-editor-doc {
    padding-left: 40px;
  }
}
</style>
