import { ref, watch, onScopeDispose } from 'vue';
import EditorJS from '@editorjs/editorjs';
import type { OutputData } from '@editorjs/editorjs';
import Header from '@editorjs/header';
import List from '@editorjs/list';
import ImageTool from '@editorjs/image';
import Delimiter from '@editorjs/delimiter';
import Quote from '@editorjs/quote';
import CodeTool from '@editorjs/code';
import Table from '@editorjs/table';
import { notesClient } from '../../lib/notes/notesClient';
import type { useCloudNotes } from './useCloudNotes';

type CloudNotesApi = ReturnType<typeof useCloudNotes>;

/**
 * Editor.js lifecycle for the Notes page editor pane: mount/destroy, the 1s
 * debounced auto-save with block-diff change detection, note switching (flush
 * pending edits first), and title save. Ported from the desktop useNoteEditor;
 * the image uploader goes through notesClient instead of the IPC bridge.
 */
export function useNoteEditor(
  cn: CloudNotesApi,
  t: (key: string, params?: Record<string, unknown>) => string,
) {
  const editableTitle = ref('');
  const editorHolder = ref<HTMLElement | null>(null);
  const saveStatus = ref<'idle' | 'saving' | 'saved'>('idle');
  let editor: EditorJS | null = null;
  /** True once the editor has loaded a note and is ready to accept user edits. */
  let editorReady = false;
  /**
   * Serialized *blocks* of the currently-loaded content, used to detect genuine
   * edits. We compare blocks only — never the whole OutputData — because
   * editor.save() stamps a fresh `time` on every call, which would otherwise make
   * every save look like a change. The initial-render onChange also diffs equal.
   */
  let lastSavedBlocks = '';
  let saveTimer: ReturnType<typeof setTimeout> | undefined;
  let savedFlashTimer: ReturnType<typeof setTimeout> | undefined;

  function parseContent(raw: string): OutputData | undefined {
    if (!raw) return undefined;
    try {
      const parsed = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.blocks)) return parsed as OutputData;
    } catch {
      // Malformed content — start blank rather than crash the editor.
    }
    return undefined;
  }

  /** Persist the current editor content for the given note id, if it changed. */
  async function flushSave(noteId: number): Promise<void> {
    if (saveTimer) {
      clearTimeout(saveTimer);
      saveTimer = undefined;
    }
    if (!editor || !editorReady) return;
    const data = await editor.save();
    const blocks = JSON.stringify(data.blocks);
    // No genuine change vs. what's loaded/last-saved → don't hit the network.
    if (blocks === lastSavedBlocks) return;
    saveStatus.value = 'saving';
    const ok = await cn.saveContent(noteId, JSON.stringify(data));
    if (ok) lastSavedBlocks = blocks;
    // Don't clobber the status if the user already switched to another note.
    if (cn.selectedNoteId.value !== noteId) return;
    saveStatus.value = ok ? 'saved' : 'idle';
    if (ok) {
      if (savedFlashTimer) clearTimeout(savedFlashTimer);
      savedFlashTimer = setTimeout(() => {
        if (saveStatus.value === 'saved') saveStatus.value = 'idle';
      }, 1500);
    }
  }

  /** Debounced auto-save triggered by Editor.js onChange. */
  function scheduleSave(): void {
    if (!editorReady) return;
    const noteId = cn.selectedNoteId.value;
    if (noteId == null) return;
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      void flushSave(noteId);
    }, 1000);
  }

  async function destroyEditor(): Promise<void> {
    editorReady = false;
    lastSavedBlocks = '';
    if (saveTimer) {
      clearTimeout(saveTimer);
      saveTimer = undefined;
    }
    if (editor) {
      try {
        await editor.isReady;
        editor.destroy();
      } catch {
        // ignore teardown races
      }
      editor = null;
    }
  }

  async function mountEditor(content: string): Promise<void> {
    await destroyEditor();
    if (!editorHolder.value) return;
    saveStatus.value = 'idle';
    const instance = new EditorJS({
      holder: editorHolder.value,
      data: parseContent(content),
      placeholder: t('cloudNotes.editorPlaceholder'),
      onChange: scheduleSave,
      tools: {
        header: Header,
        list: List,
        quote: Quote,
        code: CodeTool,
        table: Table,
        delimiter: Delimiter,
        image: {
          class: ImageTool,
          config: {
            uploader: {
              uploadByFile: async (file: File) => {
                const buf = await file.arrayBuffer();
                const res = await notesClient.uploadImage(buf, file.name, file.type);
                if (res.ok) return { success: 1, file: { url: res.data.url } };
                cn.error.value = res.error === 'not-signed-in' ? t('cloudNotes.notSignedIn') : res.error;
                return { success: 0 };
              },
            },
          },
        },
      },
    });
    editor = instance;
    await instance.isReady;
    if (editor !== instance) return;
    // Capture the editor's own block serialization of the just-loaded content as
    // the baseline, so the initial render's onChange (and block normalization)
    // don't count as an edit. Only block diffs against this trigger a real save.
    try {
      lastSavedBlocks = JSON.stringify((await instance.save()).blocks);
    } catch {
      lastSavedBlocks = '';
    }
    editorReady = true;
  }

  async function openNote(id: number): Promise<void> {
    // Persist any pending edits to the note we're leaving before switching.
    const prevId = cn.selectedNoteId.value;
    if (prevId != null && prevId !== id) await flushSave(prevId);
    const detail = await cn.openNote(id);
    if (detail) {
      editableTitle.value = detail.title;
      await mountEditor(detail.content);
    }
  }

  async function onSaveTitle(): Promise<void> {
    const note = cn.selectedNote.value;
    if (!note) return;
    const next = editableTitle.value.trim();
    if (next === note.title) return;
    await cn.renameNote(note.id, next);
  }

  // If the selected note is cleared externally, tear the editor down.
  watch(
    () => cn.selectedNoteId.value,
    (id) => {
      if (id == null) void destroyEditor();
    },
  );

  onScopeDispose(() => {
    if (savedFlashTimer) clearTimeout(savedFlashTimer);
    void destroyEditor();
  });

  return {
    editableTitle,
    editorHolder,
    saveStatus,
    flushSave,
    destroyEditor,
    mountEditor,
    openNote,
    onSaveTitle,
  };
}
