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

/* Layout only — Editor.js chrome/theme lives in styles/editor.css. */
.wn-editor-doc :deep(.ce-block__content),
.wn-editor-doc :deep(.ce-toolbar__content) {
  max-width: 100%;
  margin: 0;
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
