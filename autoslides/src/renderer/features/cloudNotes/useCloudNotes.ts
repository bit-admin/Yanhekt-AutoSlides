import { computed, ref } from 'vue'
import type {
  NoteSummary,
  NoteDetail,
  NoteGroup,
  NotesResult,
} from '@common/notesTypes'

const PAGE_SIZE = 20
/** When filtering by group, fetch up to this many notes and filter client-side. */
const GROUP_FETCH_CAP = 200

/**
 * Reactive state + actions for the Cloud Notes tab. All data flows through the
 * main process (window.electronAPI.cloudNotes), which holds the auth token.
 * The Editor.js wiring itself lives in the component; this composable owns the
 * note/group lists, selection, and the network actions.
 */
export function useCloudNotes() {
  const groups = ref<NoteGroup[]>([])
  const notes = ref<NoteSummary[]>([])
  const selectedNote = ref<NoteDetail | null>(null)

  const keyword = ref('')
  const activeGroupId = ref<number | ''>('') // '' = all notes

  const page = ref(1)
  const totalPages = ref(1)

  const loading = ref(false)
  const saving = ref(false)
  const error = ref('')
  /** Set when the main process reports no token — the user must sign in first. */
  const notSignedIn = ref(false)

  const selectedNoteId = computed(() => selectedNote.value?.id ?? null)

  /** Unwrap an IPC envelope; routes auth/errors into reactive state. */
  function unwrap<T>(res: NotesResult<T>): T | null {
    if (res.ok) {
      notSignedIn.value = false
      return res.data
    }
    if (res.error === 'not-signed-in') {
      notSignedIn.value = true
    } else {
      error.value = res.error
    }
    return null
  }

  async function refreshGroups(): Promise<void> {
    const res = await window.electronAPI.cloudNotes.groupList()
    const data = unwrap(res)
    if (data) groups.value = data
  }

  async function searchNotes(resetPage = true): Promise<void> {
    if (resetPage) page.value = 1
    loading.value = true
    error.value = ''
    try {
      // The server's note/list endpoint ignores group filtering, so when a
      // specific group is selected we pull a large page and filter by
      // note_group_id client-side (and hide the pager). "All notes" uses the
      // server's real pagination. Keyword search is honoured server-side in both.
      const filteringGroup = activeGroupId.value !== ''
      const res = await window.electronAPI.cloudNotes.list({
        page: filteringGroup ? 1 : page.value,
        pageSize: filteringGroup ? GROUP_FETCH_CAP : PAGE_SIZE,
        keyword: keyword.value.trim(),
      })
      const data = unwrap(res)
      if (data) {
        if (filteringGroup) {
          notes.value = data.data.filter((n) => n.note_group_id === activeGroupId.value)
          totalPages.value = 1
        } else {
          notes.value = data.data
          totalPages.value = Math.max(1, data.last_page)
        }
      }
    } finally {
      loading.value = false
    }
  }

  async function setGroup(groupId: number | ''): Promise<void> {
    activeGroupId.value = groupId
    await searchNotes(true)
  }

  async function goToPage(next: number): Promise<void> {
    page.value = Math.min(Math.max(1, next), totalPages.value)
    await searchNotes(false)
  }

  /** Load full note detail into the editor pane. */
  async function openNote(id: number): Promise<NoteDetail | null> {
    error.value = ''
    const res = await window.electronAPI.cloudNotes.get(id)
    const data = unwrap(res)
    if (data) selectedNote.value = data
    return data
  }

  function closeNote(): void {
    selectedNote.value = null
  }

  async function createNote(): Promise<number | null> {
    error.value = ''
    const res = await window.electronAPI.cloudNotes.create()
    const id = unwrap(res)
    if (id != null) {
      await searchNotes(true)
    }
    return id
  }

  async function saveContent(id: number, content: string): Promise<boolean> {
    saving.value = true
    error.value = ''
    try {
      const res = await window.electronAPI.cloudNotes.updateContent(id, content)
      return unwrap(res) !== null || res.ok
    } finally {
      saving.value = false
    }
  }

  async function renameNote(id: number, title: string): Promise<boolean> {
    error.value = ''
    const res = await window.electronAPI.cloudNotes.updateTitle(id, title)
    const ok = res.ok
    if (ok) {
      if (selectedNote.value?.id === id) selectedNote.value.title = title
      const summary = notes.value.find((n) => n.id === id)
      if (summary) summary.title = title
    } else {
      unwrap(res)
    }
    return ok
  }

  async function deleteNote(id: number): Promise<boolean> {
    error.value = ''
    const res = await window.electronAPI.cloudNotes.delete(id)
    const ok = res.ok
    if (ok) {
      if (selectedNote.value?.id === id) selectedNote.value = null
      await searchNotes(false)
    } else {
      unwrap(res)
    }
    return ok
  }

  async function moveNoteToGroup(id: number, groupId: number): Promise<boolean> {
    error.value = ''
    const res = await window.electronAPI.cloudNotes.moveToGroup(id, groupId)
    const ok = res.ok
    if (ok) {
      await Promise.all([refreshGroups(), searchNotes(false)])
    } else {
      unwrap(res)
    }
    return ok
  }

  async function createGroup(name: string): Promise<boolean> {
    error.value = ''
    const res = await window.electronAPI.cloudNotes.groupCreate(name)
    const ok = res.ok
    if (ok) {
      await refreshGroups()
    } else {
      unwrap(res)
    }
    return ok
  }

  async function deleteGroup(id: number): Promise<boolean> {
    error.value = ''
    const res = await window.electronAPI.cloudNotes.groupDelete(id)
    const ok = res.ok
    if (ok) {
      if (activeGroupId.value === id) activeGroupId.value = ''
      await Promise.all([refreshGroups(), searchNotes(true)])
    } else {
      unwrap(res)
    }
    return ok
  }

  /** Initial load — groups + first page of notes. */
  async function init(): Promise<void> {
    await Promise.all([refreshGroups(), searchNotes(true)])
  }

  return {
    // state
    groups,
    notes,
    selectedNote,
    selectedNoteId,
    keyword,
    activeGroupId,
    page,
    totalPages,
    loading,
    saving,
    error,
    notSignedIn,
    // actions
    init,
    refreshGroups,
    searchNotes,
    setGroup,
    goToPage,
    openNote,
    closeNote,
    createNote,
    saveContent,
    renameNote,
    deleteNote,
    moveNoteToGroup,
    createGroup,
    deleteGroup,
  }
}
