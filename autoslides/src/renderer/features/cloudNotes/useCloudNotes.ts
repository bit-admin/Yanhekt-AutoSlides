import { computed, ref } from 'vue'
import type {
  NoteSummary,
  NoteDetail,
  NoteGroup,
  NotesResult,
} from '@common/notesTypes'
import { isManagedGroupName, README_NOTE_TITLE } from '@common/notesTypes'
import { overrides } from '@shared/overrideRegistry'

const PAGE_SIZE = 20
/** Page size used when fetching the full note set (server honours large sizes). */
const FETCH_PAGE_SIZE = 500
/** Safety cap on full-set paging (FETCH_PAGE_SIZE * this = max notes loaded). */
const MAX_FETCH_PAGES = 20

/**
 * Reactive state + actions for the Cloud Notes tab. All data flows through the
 * main process (window.electronAPI.cloudNotes), which holds the auth token.
 *
 * Grouping model: the server's note/list endpoint ignores any groupId filter,
 * so we load the complete note set once (paging note/list, which paginates
 * correctly and honours a large page_size) and do group filtering, keyword
 * filtering, and pagination entirely client-side over that in-memory set. List
 * rows carry no content, so the full set stays light even for many notes. The
 * Editor.js wiring lives in the component; this composable owns the data.
 */
export function useCloudNotes() {
  // Demo mode swaps the whole data source for fabricated notes (offline); in
  // production this is the real IPC namespace.
  const cloudNotesApi = overrides.cloudNotesProvider ?? window.electronAPI.cloudNotes

  const groups = ref<NoteGroup[]>([])
  /** Complete note set (all groups), loaded via loadAll(). */
  const allNotes = ref<NoteSummary[]>([])
  /** The current visible page after group + keyword filtering. */
  const notes = ref<NoteSummary[]>([])
  const selectedNote = ref<NoteDetail | null>(null)

  const keyword = ref('')
  const activeGroupId = ref<number | ''>('') // '' = all notes

  const page = ref(1)
  const totalPages = ref(1)
  /** Number of notes matching the current group + keyword filter. */
  const filteredCount = ref(0)

  const loading = ref(false)
  const saving = ref(false)
  const error = ref('')
  /** Set when the main process reports no token — the user must sign in first. */
  const notSignedIn = ref(false)

  const selectedNoteId = computed(() => selectedNote.value?.id ?? null)

  /** The AutoSlides-managed group(s), identified by reserved name. */
  const managedGroups = computed(() => groups.value.filter((g) => isManagedGroupName(g.name)))
  /** Everything else: the default (Ungrouped) group + user-created groups. */
  const otherGroups = computed(() => groups.value.filter((g) => !isManagedGroupName(g.name)))
  /** Whether the managed group has been provisioned on the server. */
  const hasManagedStorage = computed(() => managedGroups.value.length > 0)

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

  /** Recompute the visible page from allNotes given the active group + keyword. */
  function applyView(): void {
    const gid = activeGroupId.value
    const kw = keyword.value.trim().toLowerCase()
    let rows = allNotes.value
    if (gid !== '') rows = rows.filter((n) => n.note_group_id === gid)
    if (kw) rows = rows.filter((n) => (n.title || '').toLowerCase().includes(kw))

    filteredCount.value = rows.length
    totalPages.value = Math.max(1, Math.ceil(rows.length / PAGE_SIZE))
    if (page.value > totalPages.value) page.value = totalPages.value
    const start = (page.value - 1) * PAGE_SIZE
    notes.value = rows.slice(start, start + PAGE_SIZE)
  }

  async function refreshGroups(): Promise<void> {
    const res = await cloudNotesApi.groupList()
    const data = unwrap(res)
    if (data) groups.value = data
  }

  /** Load the complete note set by paging note/list, then recompute the view. */
  async function loadAll(): Promise<void> {
    loading.value = true
    error.value = ''
    try {
      const collected: NoteSummary[] = []
      let p = 1
      let lastPage = 1
      do {
        const res = await cloudNotesApi.list({ page: p, pageSize: FETCH_PAGE_SIZE })
        const data = unwrap(res)
        if (!data) break
        collected.push(...data.data)
        lastPage = Math.max(1, data.last_page)
        p += 1
      } while (p <= lastPage && p <= MAX_FETCH_PAGES)
      allNotes.value = collected
      applyView()
    } finally {
      loading.value = false
    }
  }

  /** Re-apply the group + keyword filter (client-side; no network). */
  function searchNotes(resetPage = true): void {
    if (resetPage) page.value = 1
    applyView()
  }

  function setGroup(groupId: number | ''): void {
    activeGroupId.value = groupId
    page.value = 1
    applyView()
  }

  function goToPage(next: number): void {
    page.value = Math.min(Math.max(1, next), totalPages.value)
    applyView()
  }

  /** Load full note detail into the editor pane. */
  async function openNote(id: number): Promise<NoteDetail | null> {
    error.value = ''
    const res = await cloudNotesApi.get(id)
    const data = unwrap(res)
    if (data) selectedNote.value = data
    return data
  }

  function closeNote(): void {
    selectedNote.value = null
  }

  async function createNote(): Promise<number | null> {
    error.value = ''
    const res = await cloudNotesApi.create()
    const id = unwrap(res)
    if (id != null) {
      // Refetch so the new (blank) note appears with proper metadata.
      await loadAll()
    }
    return id
  }

  async function saveContent(id: number, content: string): Promise<boolean> {
    saving.value = true
    error.value = ''
    try {
      const res = await cloudNotesApi.updateContent(id, content)
      if (!res.ok) unwrap(res)
      return res.ok
    } finally {
      saving.value = false
    }
  }

  async function renameNote(id: number, title: string): Promise<boolean> {
    error.value = ''
    const res = await cloudNotesApi.updateTitle(id, title)
    if (res.ok) {
      if (selectedNote.value?.id === id) selectedNote.value.title = title
      const row = allNotes.value.find((n) => n.id === id)
      if (row) row.title = title
      applyView()
    } else {
      unwrap(res)
    }
    return res.ok
  }

  async function deleteNote(id: number): Promise<boolean> {
    error.value = ''
    const res = await cloudNotesApi.delete(id)
    if (res.ok) {
      if (selectedNote.value?.id === id) selectedNote.value = null
      allNotes.value = allNotes.value.filter((n) => n.id !== id)
      applyView()
    } else {
      unwrap(res)
    }
    return res.ok
  }

  async function moveNoteToGroup(id: number, groupId: number): Promise<boolean> {
    error.value = ''
    const res = await cloudNotesApi.moveToGroup(id, groupId)
    if (res.ok) {
      const row = allNotes.value.find((n) => n.id === id)
      if (row) row.note_group_id = groupId
      await refreshGroups()
      applyView()
    } else {
      unwrap(res)
    }
    return res.ok
  }

  async function createGroup(name: string): Promise<boolean> {
    error.value = ''
    const res = await cloudNotesApi.groupCreate(name)
    if (res.ok) {
      await refreshGroups()
    } else {
      unwrap(res)
    }
    return res.ok
  }

  async function deleteGroup(id: number): Promise<boolean> {
    error.value = ''
    const res = await cloudNotesApi.groupDelete(id)
    if (res.ok) {
      // Server reassigns the group's notes to the default group (0).
      for (const n of allNotes.value) {
        if (n.note_group_id === id) n.note_group_id = 0
      }
      if (activeGroupId.value === id) {
        activeGroupId.value = ''
        page.value = 1
      }
      await refreshGroups()
      applyView()
    } else {
      unwrap(res)
    }
    return res.ok
  }

  /**
   * Keep the README pinned to the top of the note list. The server orders notes
   * by *created* time, so re-saving content doesn't move it — we instead recreate
   * it: create the replacement first (so a README always exists), then delete the
   * old one. The fresh note gets the newest created time and lands on top. No-op
   * when no README exists (cloudStorageStore provisions the first). `content` is a
   * freshly-built Editor.js document from the caller. Reloads to reflect the new order.
   */
  async function recreateReadme(content: string): Promise<void> {
    const existing = allNotes.value.find((n) => n.title === README_NOTE_TITLE)
    if (!existing) return
    const createRes = await cloudNotesApi.create()
    const id = unwrap(createRes)
    if (id == null) return
    const titleRes = await cloudNotesApi.updateTitle(id, README_NOTE_TITLE)
    if (!titleRes.ok) {
      unwrap(titleRes)
      return
    }
    const contentRes = await cloudNotesApi.updateContent(id, content)
    if (!contentRes.ok) {
      unwrap(contentRes)
      return
    }
    const delRes = await cloudNotesApi.delete(existing.id)
    if (!delRes.ok) unwrap(delRes)
    await loadAll()
  }

  /** Initial load — groups + the complete note set. */
  async function init(): Promise<void> {
    await Promise.all([refreshGroups(), loadAll()])
  }

  return {
    // state
    groups,
    managedGroups,
    otherGroups,
    hasManagedStorage,
    allNotes,
    notes,
    selectedNote,
    selectedNoteId,
    keyword,
    activeGroupId,
    page,
    totalPages,
    filteredCount,
    loading,
    saving,
    error,
    notSignedIn,
    // actions
    init,
    recreateReadme,
    refreshGroups,
    loadAll,
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
