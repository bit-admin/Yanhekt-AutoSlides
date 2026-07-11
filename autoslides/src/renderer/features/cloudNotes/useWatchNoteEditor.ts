import { ref } from 'vue'
import EditorJS from '@editorjs/editorjs'
import type { OutputData } from '@editorjs/editorjs'
import Header from '@editorjs/header'
import List from '@editorjs/list'
import ImageTool from '@editorjs/image'
import Delimiter from '@editorjs/delimiter'
import Quote from '@editorjs/quote'
import CodeTool from '@editorjs/code'
import Table from '@editorjs/table'

/**
 * Slim Editor.js lifecycle for the right-panel watch-notes editor. Mirrors the
 * structure of `useNoteEditor` (mount/destroy, 1s debounced block-diff save,
 * same tools + image uploader) but is decoupled from `useCloudNotes` — it saves
 * through an injected `onSave` callback instead of a note-CRUD facade, so
 * `watchNotesStore` owns persistence. Also exposes `insertImageAtEnd` so the
 * store can append a captured slide into the live editor without a remount.
 */
export function useWatchNoteEditor(
  t: (key: string, params?: Record<string, unknown>) => string,
) {
  const editorHolder = ref<HTMLElement | null>(null)
  const saveStatus = ref<'idle' | 'saving' | 'saved'>('idle')
  let editor: EditorJS | null = null
  let editorReady = false
  let lastSavedBlocks = ''
  let saveTimer: ReturnType<typeof setTimeout> | undefined
  let onSave: ((data: OutputData) => void) | null = null

  function parse(raw: OutputData | string): OutputData | undefined {
    if (!raw) return undefined
    if (typeof raw !== 'string') return raw
    try {
      const parsed = JSON.parse(raw)
      if (parsed && Array.isArray(parsed.blocks)) return parsed as OutputData
    } catch {
      /* malformed — start blank */
    }
    return undefined
  }

  async function flush(): Promise<void> {
    if (saveTimer) {
      clearTimeout(saveTimer)
      saveTimer = undefined
    }
    if (!editor || !editorReady || !onSave) return
    const data = await editor.save()
    const blocks = JSON.stringify(data.blocks)
    if (blocks === lastSavedBlocks) return
    lastSavedBlocks = blocks
    saveStatus.value = 'saving'
    onSave(data)
    saveStatus.value = 'saved'
  }

  function scheduleSave(): void {
    if (!editorReady) return
    if (saveTimer) clearTimeout(saveTimer)
    saveTimer = setTimeout(() => { void flush() }, 1000)
  }

  async function destroyEditor(): Promise<void> {
    editorReady = false
    lastSavedBlocks = ''
    onSave = null
    if (saveTimer) {
      clearTimeout(saveTimer)
      saveTimer = undefined
    }
    if (editor) {
      try {
        await editor.isReady
        editor.destroy()
      } catch {
        /* ignore teardown races */
      }
      editor = null
    }
  }

  async function mountEditor(
    content: OutputData | string,
    opts: { onSave: (data: OutputData) => void },
  ): Promise<void> {
    await destroyEditor()
    if (!editorHolder.value) return
    onSave = opts.onSave
    saveStatus.value = 'idle'
    const instance = new EditorJS({
      holder: editorHolder.value,
      data: parse(content),
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
                const res = await window.electronAPI.cloudNotes.uploadImage(buf, file.name, file.type)
                if (res.ok) return { success: 1, file: { url: res.data.url } }
                return { success: 0 }
              },
            },
          },
        },
      },
    })
    editor = instance
    await instance.isReady
    if (editor !== instance) return
    try {
      lastSavedBlocks = JSON.stringify((await instance.save()).blocks)
    } catch {
      lastSavedBlocks = ''
    }
    editorReady = true
  }

  /** Append an image block at the very end of the live document (slide capture). */
  function insertImageAtEnd(url: string): void {
    if (!editor || !editorReady) return
    try {
      const count = editor.blocks.getBlocksCount()
      editor.blocks.insert(
        'image',
        { file: { url }, caption: '', withBorder: false, stretched: false, withBackground: false },
        undefined,
        count,
      )
      // insert() doesn't always trigger onChange — persist explicitly.
      scheduleSave()
    } catch {
      /* editor mid-teardown — the background path will have the block instead */
    }
  }

  async function readContent(): Promise<OutputData | null> {
    if (!editor || !editorReady) return null
    try {
      return await editor.save()
    } catch {
      return null
    }
  }

  return {
    editorHolder,
    saveStatus,
    mountEditor,
    destroyEditor,
    flush,
    insertImageAtEnd,
    readContent,
  }
}
