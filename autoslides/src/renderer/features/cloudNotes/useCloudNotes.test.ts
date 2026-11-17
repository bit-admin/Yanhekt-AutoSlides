import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { NoteDetail, NoteGroup, NoteListParams, NoteListResult, NoteSummary, NotesResult } from '@common/notesTypes'
import { overrides, type CloudNotesProvider } from '@shared/overrideRegistry'
import { useCloudNotes } from './useCloudNotes'

function summary(id: number, title: string): NoteSummary {
  return {
    id, uuid: `u${id}`, type: 0, relevant_id: 0, root_id: 0, title,
    note_group_id: 0, deleted: 0, version: 1, created_at: '', updated_at: '',
  }
}
const pageOf = (rows: NoteSummary[], lastPage = 1): NotesResult<NoteListResult> => ({
  ok: true,
  data: { current_page: 1, data: rows, total: rows.length, per_page: '500', last_page: lastPage },
})
const detail = (id: number, title: string): NotesResult<NoteDetail> => ({
  ok: true,
  data: { ...summary(id, title), content: `{"blocks":[]}` } as NoteDetail,
})

type Pending<T> = { args: unknown[]; answer: (value: T) => void }

/** A notes server whose reads answer only when the test says so, in any order. */
function slowServer() {
  const lists: Array<Pending<NotesResult<NoteListResult>>> = []
  const groups: Array<Pending<NotesResult<NoteGroup[]>>> = []
  const gets: Array<Pending<NotesResult<NoteDetail>>> = []
  const wait = <T,>(queue: Array<Pending<T>>, args: unknown[]): Promise<T> =>
    new Promise((resolve) => queue.push({ args, answer: resolve }))
  const provider = {
    list: (params?: NoteListParams) => wait(lists, [params]),
    groupList: () => wait(groups, []),
    get: (id: number) => wait(gets, [id]),
  } as unknown as CloudNotesProvider
  overrides.cloudNotesProvider = provider
  return { lists, groups, gets }
}

const flush = async (): Promise<void> => {
  for (let i = 0; i < 5; i++) await Promise.resolve()
}

afterEach(() => {
  delete overrides.cloudNotesProvider
  vi.useRealTimers()
})

describe('Drive notes across an account switch', () => {
  let server: ReturnType<typeof slowServer>
  beforeEach(() => {
    server = slowServer()
  })

  it("drops the old account's list, groups and open note when they arrive after the switch", async () => {
    const cn = useCloudNotes()
    cn.bindAccount('A')
    const initA = cn.init()
    const openA = cn.openNote(7)
    await flush()

    cn.bindAccount('B')
    const initB = cn.init()
    await flush()
    // Same calls, but B's own: not joins of A's reads still in flight.
    expect(server.lists).toHaveLength(2)
    expect(server.groups).toHaveLength(2)

    server.groups[1].answer({ ok: true, data: [{ id: 20, name: 'B group' }] })
    server.lists[1].answer(pageOf([summary(21, 'B note')]))
    await initB

    server.groups[0].answer({ ok: true, data: [{ id: 10, name: 'A group' }] })
    server.lists[0].answer(pageOf([summary(11, 'A note')]))
    server.gets[0].answer(detail(7, 'A open note'))
    await initA
    expect(await openA).toBeNull()

    expect(cn.groups.value.map((g) => g.name)).toEqual(['B group'])
    expect(cn.allNotes.value.map((n) => n.title)).toEqual(['B note'])
    expect(cn.selectedNote.value).toBeNull()
    expect(cn.openingNoteId.value).toBeNull()
    expect(cn.loading.value).toBe(false)
  })

  it('empties everything loaded for the account at once, before the next load answers', async () => {
    const cn = useCloudNotes()
    cn.bindAccount('A')
    const initA = cn.init()
    await flush()
    server.groups[0].answer({ ok: true, data: [{ id: 10, name: 'A group' }] })
    server.lists[0].answer(pageOf([summary(11, 'A note')]))
    await initA
    const openA = cn.openNote(11)
    await flush()
    server.gets[0].answer(detail(11, 'A note'))
    await openA
    cn.setGroup(10)
    expect(cn.selectedNoteId.value).toBe(11)

    cn.bindAccount(null)
    expect(cn.allNotes.value).toEqual([])
    expect(cn.notes.value).toEqual([])
    expect(cn.groups.value).toEqual([])
    expect(cn.selectedNote.value).toBeNull()
    expect(cn.activeGroupId.value).toBe('')
  })

  it('closing a note keeps a detail still on its way from reopening it', async () => {
    const cn = useCloudNotes()
    const open = cn.openNote(7)
    await flush()
    cn.closeNote()
    server.gets[0].answer(detail(7, 'late'))
    await open
    expect(cn.selectedNote.value).toBeNull()
  })
})

describe('Drive note list loading', () => {
  let server: ReturnType<typeof slowServer>
  beforeEach(() => {
    server = slowServer()
  })

  it('ends the spinner of a keyword search that is cancelled by clearing the keyword', async () => {
    vi.useFakeTimers()
    const cn = useCloudNotes()
    cn.keyword.value = '线性'
    cn.searchNotes()
    await vi.advanceTimersByTimeAsync(400)
    expect(cn.loading.value).toBe(true)

    cn.keyword.value = ''
    cn.searchNotes()
    expect(cn.loading.value).toBe(false)
    // The cancelled search answering later changes nothing.
    server.lists[0].answer(pageOf([summary(1, 'late match')]))
    await flush()
    expect(cn.loading.value).toBe(false)
    expect(cn.notes.value).toEqual([])
  })

  it('lets a newer keyword search end the spinner the one it replaced had turned on', async () => {
    vi.useFakeTimers()
    const cn = useCloudNotes()
    cn.keyword.value = '线'
    cn.searchNotes()
    await vi.advanceTimersByTimeAsync(400)
    cn.keyword.value = '线性'
    cn.searchNotes()
    await vi.advanceTimersByTimeAsync(400)
    expect(server.lists).toHaveLength(2)

    server.lists[1].answer(pageOf([summary(2, '线性代数')]))
    await flush()
    expect(cn.loading.value).toBe(false)
    expect(cn.notes.value.map((n) => n.title)).toEqual(['线性代数'])
  })

  it('keeps the catalog it has when a later page of a reload fails', async () => {
    const cn = useCloudNotes()
    const first = cn.loadAll()
    await flush()
    server.lists[0].answer(pageOf([summary(1, 'one'), summary(2, 'two')]))
    await first

    const reload = cn.loadAll()
    await flush()
    server.lists[1].answer(pageOf([summary(1, 'one')], 2))
    await flush()
    server.lists[2].answer({ ok: false, error: 'network' })
    await reload
    expect(cn.allNotes.value.map((n) => n.title)).toEqual(['one', 'two'])
    expect(cn.error.value).toBe('network')
    expect(cn.loading.value).toBe(false)
    // Callers that decide "no such note yet" from the list are told it is not whole.
    expect(cn.catalog.value).toBe('failed')

    const again = cn.loadAll()
    await flush()
    server.lists[3].answer(pageOf([summary(1, 'one')]))
    await again
    expect(cn.catalog.value).toBe('complete')
  })

  it('says so when the account holds more pages than the cap reads', async () => {
    const cn = useCloudNotes()
    const load = cn.loadAll()
    for (let page = 0; page < 20; page += 1) {
      await flush()
      server.lists[page].answer(pageOf([summary(page + 1, `n${page}`)], 21))
    }
    await load
    expect(server.lists).toHaveLength(20)
    expect(cn.allNotes.value).toHaveLength(20)
    expect(cn.catalog.value).toBe('truncated')
  })

  it('a load replaced by a newer one resolves with the newer list in place', async () => {
    const cn = useCloudNotes()
    const older = cn.loadAll()
    const newer = cn.loadAll()
    await flush()
    // The first read is shared by both (same request); the newer owns the result.
    let olderDone = false
    void older.then(() => (olderDone = true))
    for (const call of server.lists) call.answer(pageOf([summary(3, 'three')]))
    await newer
    await flush()
    expect(olderDone).toBe(true)
    expect(cn.allNotes.value.map((n) => n.title)).toEqual(['three'])
    expect(cn.loading.value).toBe(false)
  })
})
