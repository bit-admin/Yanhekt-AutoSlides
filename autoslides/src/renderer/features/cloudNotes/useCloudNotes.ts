import { computed, ref } from 'vue'
import { noteErrorText } from './noteErrors'
import type {
  NoteSummary,
  NoteDetail,
  NoteGroup,
  NotesResult,
} from '@common/notesTypes'
import {
  isManagedGroupName,
  isUserGroupName,
  isAutoSlidesGroupName,
  README_NOTE_TITLE,
  NOTES_ACCOUNT_CHANGED,
} from '@common/notesTypes'
import { createLatest } from '@shared/utils/latest'
import { withNoteReadCoalescing } from './noteReadCoalescing'
import { ownedNotesApi } from './ownedNotesApi'

const PAGE_SIZE = 20
/** Page size used when fetching the full note set (server honours large sizes). */
const FETCH_PAGE_SIZE = 500
/** Safety cap on full-set paging (FETCH_PAGE_SIZE * this = max notes loaded). */
const MAX_FETCH_PAGES = 20
/** Debounce for live keyword search so we don't hit the API on every keystroke. */
const SEARCH_DEBOUNCE_MS = 300

/**
 * Reactive state + actions for the Cloud Notes tab. All data flows through the
 * main process (window.electronAPI.cloudNotes), which holds the auth token.
 *
 * Grouping model: the server's note/list endpoint ignores any groupId filter,
 * so we load the complete note set once (paging note/list with empty keyword)
 * into `allNotes` and filter by group + paginate client-side. Keyword search is
 * server-side: a non-empty keyword pages note/list with `keyword=` into
 * `searchResults`, then the same client group/page slice runs over that buffer.
 * Export/import keep using the full catalog via loadAll() + allNotes. List rows
 * carry no content, so both sets stay light. The Editor.js wiring lives in the
 * component; this composable owns the data.
 */
export function useCloudNotes() {
  // Demo mode swaps the whole data source for fabricated notes (offline); in
  // production this is the real IPC namespace, wrapped so a repeat click on a
  // sidebar row joins the fetch already in flight instead of starting a second.
  //
  // Coalescing only, never a memo: a note is a document the user is editing, so
  // a cached body could show them content they have already changed. With no
  // memo there is nothing to go stale, which is also why writes from other
  // surfaces (watch notes, import/export) need no invalidation hook here.
  //
  // The provider and everything loaded through it belong to one account
  // (`bindAccount`). Each action takes `cloudNotesApi` and `live` once, at its
  // start: after an account change the old provider answers `account-changed`
  // without sending, and `live()` is false, so an action still running writes
  // no state and starts no further request.
  let cloudNotesApi = withNoteReadCoalescing(ownedNotesApi(null))
  const account = createLatest()
  let live = account.begin()

  const groups = ref<NoteGroup[]>([])
  /** Complete note set (all groups), loaded via loadAll(). */
  const allNotes = ref<NoteSummary[]>([])
  /**
   * Server keyword matches when a search is active; null means "use allNotes".
   * Kept separate so export/import can still rely on the full catalog.
   */
  const searchResults = ref<NoteSummary[] | null>(null)
  /** The current visible page after group filtering over the active source set. */
  const notes = ref<NoteSummary[]>([])
  const selectedNote = ref<NoteDetail | null>(null)

  const keyword = ref('')
  const activeGroupId = ref<number | ''>('') // '' = all notes

  const page = ref(1)
  const totalPages = ref(1)
  /** Number of notes matching the current group (+ keyword, when searching). */
  const filteredCount = ref(0)

  const loading = ref(false)
  const saving = ref(false)
  const error = ref('')
  /** Set when the main process reports no token — the user must sign in first. */
  const notSignedIn = ref(false)

  /** Bumps on every new search so in-flight keyword pages discard stale results. */
  let searchGen = 0
  /** Bumps on every openNote so a stale detail fetch cannot win a rapid A→B→A. */
  let openGen = 0
  /**
   * Whether `allNotes` is the whole list as of the last load: `failed` when a
   * page did not answer (the previous list is kept), `truncated` when the
   * account holds more notes than the page cap reads. Anything that decides
   * "this note does not exist yet" from `allNotes` must look here first.
   */
  const catalog = ref<'complete' | 'truncated' | 'failed'>('complete')
  /** Bumps on every loadAll: the newest load owns the catalog and the spinner. */
  let listGen = 0
  /** The newest loadAll, for the loads it replaced to wait on. */
  let listRun: Promise<void> | null = null
  /** True while the spinner was turned on by a keyword search (not by loadAll). */
  let searchOwnsLoading = false
  /** The note whose detail is being fetched; dims its sidebar row. */
  const openingNoteId = ref<number | null>(null)
  let searchDebounceTimer: ReturnType<typeof setTimeout> | null = null

  const selectedNoteId = computed(() => selectedNote.value?.id ?? null)

  /** Managed groups — ASnote (AutoSlides Database) first, then ASuser (Watch Notes). */
  const managedGroups = computed(() =>
    groups.value
      .filter((g) => isAutoSlidesGroupName(g.name))
      .slice()
      .sort((a, b) => Number(isUserGroupName(a.name)) - Number(isUserGroupName(b.name))),
  )
  /** Everything else: the default (Ungrouped) group + user-created groups. */
  const otherGroups = computed(() => groups.value.filter((g) => !isAutoSlidesGroupName(g.name)))
  /** Whether the ASnote import group has been provisioned on the server. */
  const hasManagedStorage = computed(() => groups.value.some((g) => isManagedGroupName(g.name)))

  /** Unwrap an IPC envelope; routes auth/errors into reactive state. */
  function unwrap<T>(res: NotesResult<T>): T | null {
    if (res.ok) {
      notSignedIn.value = false
      return res.data
    }
    // The call was for the account just left: nothing was sent, nothing to show.
    if (res.error === NOTES_ACCOUNT_CHANGED) return null
    if (res.error === 'not-signed-in') {
      notSignedIn.value = true
    } else {
      error.value = noteErrorText(res.error)
    }
    return null
  }

  /** Active source set: server keyword matches when searching, else full catalog. */
  function sourceRows(): NoteSummary[] {
    return searchResults.value ?? allNotes.value
  }

  /** Recompute the visible page from the active source given the active group. */
  function applyView(): void {
    const gid = activeGroupId.value
    let rows = sourceRows()
    if (gid !== '') rows = rows.filter((n) => n.note_group_id === gid)

    filteredCount.value = rows.length
    totalPages.value = Math.max(1, Math.ceil(rows.length / PAGE_SIZE))
    if (page.value > totalPages.value) page.value = totalPages.value
    const start = (page.value - 1) * PAGE_SIZE
    notes.value = rows.slice(start, start + PAGE_SIZE)
  }

  /** Patch a note title in both the full catalog and the active search buffer. */
  function patchTitle(id: number, title: string): void {
    const row = allNotes.value.find((n) => n.id === id)
    if (row) row.title = title
    const searchRow = searchResults.value?.find((n) => n.id === id)
    if (searchRow) searchRow.title = title
  }

  /** Drop a note from both the full catalog and the active search buffer. */
  function removeFromBuffers(id: number): void {
    allNotes.value = allNotes.value.filter((n) => n.id !== id)
    if (searchResults.value) {
      searchResults.value = searchResults.value.filter((n) => n.id !== id)
    }
  }

  /** Patch note_group_id in both buffers. */
  function patchGroup(id: number, groupId: number): void {
    const row = allNotes.value.find((n) => n.id === id)
    if (row) row.note_group_id = groupId
    const searchRow = searchResults.value?.find((n) => n.id === id)
    if (searchRow) searchRow.note_group_id = groupId
  }

  async function refreshGroups(): Promise<void> {
    const alive = live
    const res = await cloudNotesApi.groupList()
    if (!alive()) return
    const data = unwrap(res)
    if (data) groups.value = data
  }

  /**
   * Page note/list with a non-empty keyword into searchResults. Stale responses
   * (superseded by a newer searchGen) are discarded. Does not touch allNotes.
   */
  async function fetchKeywordMatches(kw: string): Promise<void> {
    const api = cloudNotesApi
    const gen = ++searchGen
    // The spinner is this search's when nothing else is loading, or when the
    // search it replaces had it (that one can no longer end it).
    const ownLoading = !loading.value || searchOwnsLoading
    if (ownLoading) {
      loading.value = true
      searchOwnsLoading = true
    }
    error.value = ''
    try {
      const collected: NoteSummary[] = []
      let p = 1
      let lastPage = 1
      do {
        const res = await api.list({ page: p, pageSize: FETCH_PAGE_SIZE, keyword: kw })
        if (gen !== searchGen) return
        const data = unwrap(res)
        if (!data) break
        collected.push(...data.data)
        lastPage = Math.max(1, data.last_page)
        p += 1
      } while (p <= lastPage && p <= MAX_FETCH_PAGES)
      if (gen !== searchGen) return
      searchResults.value = collected
      applyView()
    } finally {
      if (ownLoading && gen === searchGen) endSearchLoading()
    }
  }

  /** Give back the spinner a keyword search took, when it ends or is cancelled. */
  function endSearchLoading(): void {
    if (!searchOwnsLoading) return
    searchOwnsLoading = false
    loading.value = false
  }

  /**
   * Load the complete note set by paging note/list (empty keyword), then
   * recompute the view. The newest load owns the catalog: one it replaced
   * writes nothing and resolves when the newest has finished, so a caller that
   * awaits any of them reads the list that is current.
   */
  function loadAll(): Promise<void> {
    const run = runLoadAll(++listGen)
    listRun = run
    return run
  }

  async function runLoadAll(gen: number): Promise<void> {
    const api = cloudNotesApi
    const replaced = (): boolean => gen !== listGen
    // Invalidate any in-flight keyword search; loadAll owns the next view update.
    searchGen += 1
    searchOwnsLoading = false
    if (searchDebounceTimer != null) {
      clearTimeout(searchDebounceTimer)
      searchDebounceTimer = null
    }
    loading.value = true
    error.value = ''
    try {
      const collected: NoteSummary[] = []
      let p = 1
      let lastPage = 1
      let complete = true
      do {
        const res = await api.list({ page: p, pageSize: FETCH_PAGE_SIZE })
        if (replaced()) return await (listRun ?? Promise.resolve())
        const data = unwrap(res)
        if (!data) {
          complete = false
          break
        }
        collected.push(...data.data)
        lastPage = Math.max(1, data.last_page)
        p += 1
      } while (p <= lastPage && p <= MAX_FETCH_PAGES)
      // A page that failed leaves the catalog as it was (the error is shown):
      // the pages before it are not the whole list, and import and export
      // read this set as if it were.
      if (complete) allNotes.value = collected
      // `truncated`: the server has more pages than the cap reads.
      catalog.value = !complete ? 'failed' : p <= lastPage ? 'truncated' : 'complete'
      const kw = keyword.value.trim()
      if (kw !== '') {
        // Keep loading true across the keyword re-fetch.
        await fetchKeywordMatches(kw)
        if (replaced()) return await (listRun ?? Promise.resolve())
      } else {
        searchResults.value = null
        applyView()
      }
    } finally {
      if (!replaced()) loading.value = false
    }
  }

  /**
   * Apply the current keyword: empty → clear search buffer (instant, local);
   * non-empty → debounced server keyword fetch. Group filter stays client-side.
   */
  function searchNotes(resetPage = true): void {
    if (resetPage) page.value = 1
    if (searchDebounceTimer != null) {
      clearTimeout(searchDebounceTimer)
      searchDebounceTimer = null
    }
    const kw = keyword.value.trim()
    if (kw === '') {
      searchGen += 1
      // The search just cancelled can no longer end its own spinner.
      endSearchLoading()
      searchResults.value = null
      applyView()
      return
    }
    searchDebounceTimer = setTimeout(() => {
      searchDebounceTimer = null
      void fetchKeywordMatches(kw)
    }, SEARCH_DEBOUNCE_MS)
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
  /**
   * Load full note detail into the editor pane.
   *
   * Guarded by a generation counter (same idea as `searchGen`) so a slow fetch
   * for note A cannot land after the user moved to B and clobber the newer
   * selection. The losing call still returns its data to its own caller — it
   * just no longer owns `selectedNote`.
   */
  async function openNote(id: number): Promise<NoteDetail | null> {
    const alive = live
    error.value = ''
    const gen = ++openGen
    openingNoteId.value = id
    try {
      const res = await cloudNotesApi.get(id)
      // Another account's note is nobody's to mount, not even its own caller's.
      if (!alive()) return null
      const data = unwrap(res)
      if (data && gen === openGen) selectedNote.value = data
      return data
    } finally {
      if (gen === openGen) openingNoteId.value = null
    }
  }

  function closeNote(): void {
    // A detail still on its way must not reopen what was just closed.
    openGen += 1
    openingNoteId.value = null
    selectedNote.value = null
  }

  async function createNote(): Promise<number | null> {
    const alive = live
    error.value = ''
    const res = await cloudNotesApi.create()
    if (!alive()) return null
    const id = unwrap(res)
    if (id != null) {
      // Refetch so the new (blank) note appears with proper metadata.
      await loadAll()
    }
    return id
  }

  /**
   * The write of one note's content, for the account bound now. Kept by the
   * editor's save chain for as long as that note is open: after an account
   * change it sends nothing and answers false.
   */
  function noteWriter(id: number): (content: string) => Promise<boolean> {
    const api = cloudNotesApi
    const alive = live
    return async (content) => {
      if (!alive()) return false
      saving.value = true
      error.value = ''
      try {
        const res = await api.updateContent(id, content)
        if (!alive()) return false
        if (!res.ok) unwrap(res)
        return res.ok
      } finally {
        if (alive()) saving.value = false
      }
    }
  }

  function saveContent(id: number, content: string): Promise<boolean> {
    return noteWriter(id)(content)
  }

  async function renameNote(id: number, title: string): Promise<boolean> {
    const alive = live
    error.value = ''
    const res = await cloudNotesApi.updateTitle(id, title)
    if (!alive()) return false
    if (res.ok) {
      if (selectedNote.value?.id === id) selectedNote.value.title = title
      patchTitle(id, title)
      applyView()
    } else {
      unwrap(res)
    }
    return res.ok
  }

  async function deleteNote(id: number): Promise<boolean> {
    const alive = live
    error.value = ''
    const res = await cloudNotesApi.delete(id)
    if (!alive()) return false
    if (res.ok) {
      if (selectedNote.value?.id === id) selectedNote.value = null
      removeFromBuffers(id)
      applyView()
    } else {
      unwrap(res)
    }
    return res.ok
  }

  /**
   * Move `id` into `groupId` (0 = Ungrouped).
   * Returns the resulting note id (new when ungrouped via recreate), or null on failure.
   * Pass live editor `content` when ungrouping so unsaved edits aren't lost.
   */
  async function moveNoteToGroup(
    id: number,
    groupId: number,
    content?: string,
  ): Promise<number | null> {
    const alive = live
    error.value = ''
    const row = allNotes.value.find((n) => n.id === id)
    const title = row?.title ?? selectedNote.value?.title ?? ''
    const res = await cloudNotesApi.moveToGroup(id, groupId, title, content)
    if (!alive()) return null
    const newId = unwrap(res)
    if (newId == null) return null

    if (newId !== id) {
      // Ungroup recreated the note under a new id — drop the old row and reload.
      removeFromBuffers(id)
      if (selectedNote.value?.id === id) selectedNote.value = null
      await loadAll()
    } else {
      patchGroup(id, groupId)
      if (selectedNote.value?.id === id) selectedNote.value.note_group_id = groupId
      await refreshGroups()
      applyView()
    }
    return newId
  }

  async function createGroup(name: string): Promise<boolean> {
    const alive = live
    error.value = ''
    const res = await cloudNotesApi.groupCreate(name)
    if (!alive()) return false
    if (res.ok) {
      await refreshGroups()
    } else {
      unwrap(res)
    }
    return res.ok
  }

  async function deleteGroup(id: number): Promise<boolean> {
    const alive = live
    error.value = ''
    const res = await cloudNotesApi.groupDelete(id)
    if (!alive()) return false
    if (res.ok) {
      // Server reassigns the group's notes to the default group (0).
      for (const n of allNotes.value) {
        if (n.note_group_id === id) n.note_group_id = 0
      }
      if (searchResults.value) {
        for (const n of searchResults.value) {
          if (n.note_group_id === id) n.note_group_id = 0
        }
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
    // Every step goes through the provider taken here. If the account changes
    // part-way, the remaining steps answer `account-changed` and send nothing,
    // so the steps already made stay with the account they were made for: at
    // worst that account keeps a second README, which its next Drive open finds
    // by title and replaces.
    const api = cloudNotesApi
    const alive = live
    const existing = allNotes.value.find((n) => n.title === README_NOTE_TITLE)
    if (!existing) return
    const createRes = await api.create()
    if (!alive()) return
    const id = unwrap(createRes)
    if (id == null) return
    // A failed title/content write would leave a blank "Untitled" note behind on
    // every Drive open; drop the replacement and keep the old README instead.
    const titleRes = await api.updateTitle(id, README_NOTE_TITLE)
    const contentRes = titleRes.ok ? await api.updateContent(id, content) : titleRes
    if (!contentRes.ok) {
      await api.delete(id)
      if (alive()) unwrap(contentRes)
      return
    }
    const delRes = await api.delete(existing.id)
    if (!alive()) return
    if (!delRes.ok) unwrap(delRes)
    await loadAll()
  }

  /** Initial load — groups + the complete note set. */
  async function init(): Promise<void> {
    await Promise.all([refreshGroups(), loadAll()])
  }

  /**
   * Whose notes this instance shows: the signed-in account's badge, or null.
   * Everything loaded for the account before is dropped at once (its ids mean
   * nothing under another account), and whatever is still on its way for it
   * arrives to nothing. The caller loads again (`init`).
   */
  function bindAccount(badge: string | null): void {
    live = account.begin()
    cloudNotesApi = withNoteReadCoalescing(ownedNotesApi(badge), badge ?? '')
    searchGen += 1
    openGen += 1
    listGen += 1
    listRun = null
    searchOwnsLoading = false
    if (searchDebounceTimer != null) {
      clearTimeout(searchDebounceTimer)
      searchDebounceTimer = null
    }
    groups.value = []
    allNotes.value = []
    catalog.value = 'complete'
    searchResults.value = null
    notes.value = []
    selectedNote.value = null
    openingNoteId.value = null
    keyword.value = ''
    activeGroupId.value = ''
    page.value = 1
    totalPages.value = 1
    filteredCount.value = 0
    loading.value = false
    saving.value = false
    error.value = ''
    notSignedIn.value = false
  }

  return {
    // state
    groups,
    managedGroups,
    otherGroups,
    hasManagedStorage,
    allNotes,
    catalog,
    notes,
    selectedNote,
    selectedNoteId,
    keyword,
    activeGroupId,
    page,
    totalPages,
    filteredCount,
    loading,
    openingNoteId,
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
    noteWriter,
    notesApi: () => cloudNotesApi,
    bindAccount,
    renameNote,
    deleteNote,
    moveNoteToGroup,
    createGroup,
    deleteGroup,
  }
}
