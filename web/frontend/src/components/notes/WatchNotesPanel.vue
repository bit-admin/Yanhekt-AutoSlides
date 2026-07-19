<template>
  <div class="watch-notes-panel">
    <template v-if="entry && entry.status === 'ready'">
      <div class="wn-header">
        <span class="wn-title" :title="entry.displayName">{{ entry.displayName }}</span>
        <span class="wn-status" :class="ed.saveStatus.value">{{ statusLabel }}</span>
      </div>
      <div class="wn-editor-holder custom-scrollbar">
        <div
          :ref="(el) => (ed.editorHolder.value = el as HTMLElement | null)"
          class="wn-editor-doc"
        ></div>
      </div>
    </template>

    <div v-else-if="entry && entry.status === 'creating'" class="wn-empty">
      {{ $t('cloudNotes.watchNotes.creating') }}
    </div>

    <div v-else-if="entry && entry.status === 'error'" class="wn-empty wn-empty--error">
      {{ $t('cloudNotes.watchNotes.error') }}
    </div>

    <div v-else class="wn-empty">
      {{ $t('cloudNotes.watchNotes.hint') }}
    </div>
  </div>
</template>

<script setup lang="ts">
// Playback-sidebar "Notes" view: the live editor for the current extraction
// folder's ASuser note. Ported from the desktop WatchNotesPanel; the web keys
// entries by extraction folder (one playback page at a time) instead of tab id.
// Registers itself with watchNotesStore so captured slides insert into the live
// editor rather than clobbering in-progress edits.
import { computed, watch, onBeforeUnmount } from 'vue';
import { useI18n } from 'vue-i18n';
import { watchNotesStore } from '../../stores/watchNotesStore';
import { useWatchNoteEditor } from '../../composables/notes/useWatchNoteEditor';

const props = defineProps<{ folder: string | null }>();

const { t } = useI18n();
const ed = useWatchNoteEditor(t);
const entry = computed(() => watchNotesStore.entryFor(props.folder));

let mountedFolder: string | null = null;

const statusLabel = computed(() => {
  switch (ed.saveStatus.value) {
    case 'saving':
      return t('cloudNotes.saving');
    case 'saved':
      return t('cloudNotes.saved');
    default:
      return '';
  }
});

/** Key that changes whenever we need to (re)mount: folder identity or readiness. */
const mountKey = computed(() => {
  const e = entry.value;
  return e && e.status === 'ready' && e.noteId != null ? e.folder : null;
});

async function syncEditor(nextFolder: string | null): Promise<void> {
  if (nextFolder === mountedFolder) return;
  // Persist and detach the note we're leaving.
  if (mountedFolder) {
    await ed.flush();
    watchNotesStore.unregisterActiveEditor(mountedFolder);
    await ed.destroyEditor();
    mountedFolder = null;
  }
  if (!nextFolder) return;
  const e = entry.value;
  if (!e || e.folder !== nextFolder) return;
  await ed.mountEditor(e.content, {
    onSave: (data) => watchNotesStore.commitEditorContent(nextFolder, data),
  });
  watchNotesStore.registerActiveEditor({ folder: nextFolder, insertImage: ed.insertImageAtEnd });
  mountedFolder = nextFolder;
}

watch(mountKey, (next) => void syncEditor(next), { flush: 'post', immediate: true });

onBeforeUnmount(async () => {
  if (mountedFolder) {
    await ed.flush();
    watchNotesStore.unregisterActiveEditor(mountedFolder);
  }
  await ed.destroyEditor();
});
</script>

<style scoped>
.watch-notes-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  background-color: var(--bg-surface);
}

.wn-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 10px 12px;
  border-bottom: 1px solid var(--border-color);
  flex-shrink: 0;
}

.wn-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.wn-status {
  font-size: 11px;
  color: var(--text-muted);
  flex-shrink: 0;
}

.wn-status.saving {
  color: var(--text-secondary);
}
.wn-status.saved {
  color: var(--success);
}

.wn-editor-holder {
  flex: 1;
  overflow-y: auto;
  padding: 12px 8px 60px;
  color: var(--text-primary);
}

.wn-editor-doc {
  /* Left gutter houses Editor.js's block toolbar (＋ / drag handle). The
     narrow-mode reset that keeps the toolbar in this gutter is shared globally
     in styles/editor.css (the Notes page editor needs the same fix). The right
     padding balances that left gutter so content isn't flush to the edge. */
  padding: 0 30px 0 58px;
  box-sizing: border-box;
}

/* ── Editor.js theming (maps its hardcoded light chrome to design tokens so
      light + dark both look right — mirrors NoteEditorPane) ───────────────── */
.wn-editor-doc :deep(.ce-block__content),
.wn-editor-doc :deep(.ce-toolbar__content) {
  max-width: 100%;
  margin: 0;
}

.wn-editor-doc :deep(.ce-paragraph),
.wn-editor-doc :deep(.ce-header),
.wn-editor-doc :deep(.cdx-block) {
  color: var(--text-primary);
}

.wn-editor-doc :deep(a) {
  color: var(--link-color);
}

.wn-editor-doc :deep([data-placeholder]:empty::before),
.wn-editor-doc :deep(.cdx-block[data-placeholder]:empty::before) {
  color: var(--text-muted);
}

/* Left-gutter controls: + button and drag/settings handle */
.wn-editor-doc :deep(.ce-toolbar__plus),
.wn-editor-doc :deep(.ce-toolbar__settings-btn) {
  color: var(--text-secondary);
}

.wn-editor-doc :deep(.ce-toolbar__plus:hover),
.wn-editor-doc :deep(.ce-toolbar__settings-btn:hover) {
  background-color: var(--bg-hover);
}

/* Floating surfaces: toolbox popover, inline toolbar, conversion toolbar,
   block-settings popover */
.wn-editor-doc :deep(.ce-popover),
.wn-editor-doc :deep(.ce-inline-toolbar),
.wn-editor-doc :deep(.ce-conversion-toolbar),
.wn-editor-doc :deep(.ce-settings) {
  background-color: var(--bg-elevated);
  border-color: var(--border-color);
  color: var(--text-primary);
  box-shadow: var(--shadow-md);
}

.wn-editor-doc :deep(.ce-popover__item:hover),
.wn-editor-doc :deep(.ce-inline-tool:hover),
.wn-editor-doc :deep(.ce-inline-toolbar__dropdown:hover),
.wn-editor-doc :deep(.ce-conversion-tool:hover) {
  background-color: var(--bg-hover);
}

.wn-editor-doc :deep(.ce-popover__item-icon),
.wn-editor-doc :deep(.ce-conversion-tool__icon) {
  background-color: var(--bg-surface);
  border-color: var(--border-color);
  color: var(--text-primary);
}

/* Inputs inside Editor.js (image caption, quote text/caption) */
.wn-editor-doc :deep(.cdx-input) {
  background-color: var(--bg-input);
  border-color: var(--border-input);
  color: var(--text-primary);
}

.wn-editor-doc :deep(.ce-code__textarea) {
  background-color: var(--bg-input);
  border-color: var(--border-input);
  color: var(--text-primary);
}

.wn-editor-doc :deep(.tc-wrap) {
  --color-background: var(--bg-subtle);
  --color-text-secondary: var(--text-muted);
  --color-border: var(--border-color);
}

.wn-editor-doc :deep(.ce-delimiter) {
  color: var(--text-muted);
}

.wn-empty {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  text-align: center;
  font-size: 13px;
  line-height: 1.5;
  color: var(--text-muted);
}

.wn-empty--error {
  color: var(--danger);
}
</style>
