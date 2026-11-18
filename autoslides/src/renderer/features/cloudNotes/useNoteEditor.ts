import { ref, watch, onScopeDispose } from 'vue'
import { noteErrorText } from './noteErrors'
import EditorJS from '@editorjs/editorjs'
import type { OutputData } from '@editorjs/editorjs'
import Header from '@editorjs/header'
import List from '@editorjs/list'
import ImageTool from '@editorjs/image'
import Delimiter from '@editorjs/delimiter'
import Quote from '@editorjs/quote'
import CodeTool from '@editorjs/code'
import Table from '@editorjs/table'
import type { useCloudNotes } from './useCloudNotes'
import { syncEditorJsSelectionStyles } from './editorSelection'
import { createNoteSaveChain, type NoteSaveChain } from './noteSaveChain'
import { readNoteContent } from './noteContent'

type CloudNotesApi = ReturnType<typeof useCloudNotes>

/**
 * Editor.js lifecycle for the Cloud Notes editor pane: mount/destroy, the 1s
 * debounced auto-save with block-diff change detection, note switching (flush
 * pending edits first), and title save.
 *
 * Constructed in the PARENT (CloudNotesTab), not inside the editor pane
 * component: `openNote` is invoked by the cross-page note-open watch and the
 * import-conflict handler while the pane may not be mounted yet — `mountEditor`
 * no-ops on a null holder and the selection still updates, which must keep
 * working.
 */
export function useNoteEditor(
  cn: CloudNotesApi,
  t: (key: string, params?: Record<string, unknown>) => string,
) {
  const editableTitle = ref('')
  const editorHolder = ref<HTMLElement | null>(null)
  const saveStatus = ref<'idle' | 'saving' | 'saved'>('idle')
  let editor: EditorJS | null = null
  /** True once the editor has loaded a note and is ready to accept user edits. */
  let editorReady = false
  /**
   * The saves of the note this editor has open, one at a time and in order
   * (`noteSaveChain.ts`), with that note's own baseline: the serialized
   * *blocks* of what the server holds. Blocks only, never the whole
   * OutputData, because editor.save() stamps a fresh `time` on every call,
   * which would make every save look like a change. A new chain is made for
   * each mount, for that note and the account bound then.
   */
  let chain: NoteSaveChain | null = null
  let chainNoteId: number | null = null
  let saveTimer: ReturnType<typeof setTimeout> | undefined
  let savedFlashTimer: ReturnType<typeof setTimeout> | undefined
  // Yanhekt's reason for the last failed save of the note on screen.
  let lastSaveFailure = ''

  function startChain(noteId: number, baselineBlocks: string): void {
    const mine: NoteSaveChain = createNoteSaveChain(cn.noteWriter(noteId), {
      // Only the chain of the note on screen speaks for the status line.
      onWriteStart: () => {
        if (chain === mine) saveStatus.value = 'saving'
      },
      onSettled: (saved) => {
        if (chain !== mine) return
        // A failed save never reads as saved: the note stays dirty, and the
        // banner says the changes were not saved, with Yanhekt's reason.
        saveStatus.value = saved ? 'saved' : 'idle'
        if (!saved) {
          lastSaveFailure = cn.error.value
          if (lastSaveFailure) cn.error.value = t('cloudNotes.changesNotSaved', { reason: lastSaveFailure })
          return
        }
        lastSaveFailure = ''
        if (savedFlashTimer) clearTimeout(savedFlashTimer)
        savedFlashTimer = setTimeout(() => {
          if (saveStatus.value === 'saved') saveStatus.value = 'idle'
        }, 1500)
      },
    })
    mine.setBaseline(baselineBlocks)
    chain = mine
    chainNoteId = noteId
  }

  /**
   * Persist the current editor content for the given note id, if it changed.
   * False when the note has edits that could not be saved.
   */
  async function flushSave(noteId: number): Promise<boolean> {
    if (saveTimer) {
      clearTimeout(saveTimer)
      saveTimer = undefined
    }
    const instance = editor
    const saves = chain
    if (!instance || !editorReady || !saves || chainNoteId !== noteId) return true
    let data: OutputData
    try {
      data = await instance.save()
    } catch {
      // The editor went away under the save (a teardown race): nothing to read.
      return !saves.dirty
    }
    return saves.save({ blocks: JSON.stringify(data.blocks), content: JSON.stringify(data) })
  }

  /** Debounced auto-save triggered by Editor.js onChange. */
  function scheduleSave(): void {
    if (!editorReady) return
    const noteId = cn.selectedNoteId.value
    if (noteId == null) return
    if (saveTimer) clearTimeout(saveTimer)
    saveTimer = setTimeout(() => { flushSave(noteId) }, 1000)
  }

  async function destroyEditor(): Promise<void> {
    editorReady = false
    // Nothing more is sent for the note being left; a write already out ends
    // without touching the next note's baseline or status.
    chain?.close()
    chain = null
    chainNoteId = null
    if (saveTimer) {
      clearTimeout(saveTimer)
      saveTimer = undefined
    }
    if (editor) {
      try {
        await editor.isReady
        editor.destroy()
      } catch {
        // ignore teardown races
      }
      editor = null
    }
  }

  async function mountEditor(content: string): Promise<void> {
    await destroyEditor()
    if (!editorHolder.value) return
    saveStatus.value = 'idle'
    const noteId = cn.selectedNoteId.value
    const read = readNoteContent(content)
    // Content this editor cannot read is shown empty and locked. Editing it
    // would save a fresh document over the original, which is still intact on
    // Yanhekt; leaving it alone is the only way not to lose it.
    const readOnly = read.kind === 'unreadable'
    if (readOnly) cn.error.value = t('cloudNotes.unreadableContent')
    const instance = new EditorJS({
      holder: editorHolder.value,
      data: read.kind === 'document' ? (read.data as OutputData) : undefined,
      readOnly,
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
                const buf = await file.arrayBuffer()
                const res = await cn.notesApi().uploadImage(buf, file.name, file.type)
                if (res.ok) return { success: 1, file: { url: res.data.url } }
                cn.error.value = res.error === 'not-signed-in' ? t('cloudNotes.notSignedIn') : noteErrorText(res.error)
                return { success: 0 }
              },
            },
          },
        },
      },
    })
    editor = instance
    await instance.isReady
    syncEditorJsSelectionStyles()
    if (editor !== instance) return
    // A locked note has no saves at all.
    if (readOnly || noteId == null) return
    // Capture the editor's own block serialization of the just-loaded content as
    // the baseline, so the initial render's onChange (and block normalization)
    // don't count as an edit. Only block diffs against this trigger a real save.
    let baseline = ''
    try {
      baseline = JSON.stringify((await instance.save()).blocks)
    } catch {
      baseline = ''
    }
    if (editor !== instance) return
    startChain(noteId, baseline)
    editorReady = true
  }

  async function openNote(id: number): Promise<void> {
    // Persist any pending edits to the note we're leaving before switching,
    // behind every save of it already on its way. If they cannot be saved the
    // switch still happens (Yanhekt's note service fails often enough that
    // holding the user on the note would get in the way); the banner then
    // names the note whose changes were lost.
    const prevId = cn.selectedNoteId.value
    let lost: { title: string; reason: string } | null = null
    if (prevId != null && prevId !== id) {
      const title = cn.selectedNote.value?.title ?? ''
      if (!(await flushSave(prevId))) lost = { title, reason: lastSaveFailure }
    }
    const detail = await cn.openNote(id)
    if (lost && cn.selectedNoteId.value === id) {
      cn.error.value = t('cloudNotes.leftUnsaved', lost)
    }
    if (detail) {
      // cn.openNote drops a stale detail rather than clobbering a newer
      // selection, so a mismatch here means a faster open for another note
      // already won. Mounting anyway would put A's content on screen while B
      // is the selected row.
      if (cn.selectedNoteId.value !== id) return
      editableTitle.value = detail.title
      await mountEditor(detail.content)
    }
  }

  async function onSaveTitle(): Promise<void> {
    const note = cn.selectedNote.value
    if (!note) return
    const next = editableTitle.value.trim()
    if (next === note.title) return
    await cn.renameNote(note.id, next)
  }

  /** Freshest stringified content for the open note (live editor, else saved). */
  async function currentNoteContent(): Promise<string> {
    const saved = cn.selectedNote.value?.content ?? ''
    if (editor && editorReady) {
      try { return JSON.stringify(await editor.save()) } catch { return saved }
    }
    return saved
  }

  // If the selected note is cleared externally, tear the editor down.
  watch(() => cn.selectedNoteId.value, (id) => {
    if (id == null) destroyEditor()
  })

  onScopeDispose(() => {
    if (savedFlashTimer) clearTimeout(savedFlashTimer)
    void destroyEditor()
  })

  return {
    editableTitle,
    editorHolder,
    saveStatus,
    flushSave,
    destroyEditor,
    mountEditor,
    openNote,
    onSaveTitle,
    currentNoteContent,
  }
}
