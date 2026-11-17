import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { YanhektWatchNoteEntry } from './watchNotesTypes'

type Result = { ok: true; data: unknown } | { ok: false; error: string }
const ok = (data: unknown = undefined): Result => ({ ok: true, data })
const refused = (error = 'server'): Result => ({ ok: false, error })

interface Server {
  badge: string | null
  calls: string[]
  notes: Array<{ id: number; title: string; note_group_id: number }>
  content: Map<number, string>
  fail: Set<string>
}
const servers: Server[] = []
let badge: string | null = 'A'
const state = vi.hoisted(() => ({ refreshes: 0 }))

/** One fake note API per account, built the way `ownedNotesApi` is asked for one. */
const serverFor = (owner: string | null): Server => {
  const server: Server = { badge: owner, calls: [], notes: [], content: new Map(), fail: new Set() }
  servers.push(server)
  return server
}
let next: Server | null = null

vi.mock('./ownedNotesApi', () => ({
  ownedNotesApi: (owner: string | null) => {
    const server = next ?? serverFor(owner)
    next = null
    server.badge = owner
    const call = (name: string, run: () => Result) => async () => {
      server.calls.push(name)
      return server.fail.has(name) ? refused() : run()
    }
    return {
      list: call('list', () => ok({ data: server.notes, last_page: 1 })),
      get: (id: number) => call('get', () => ok({ content: server.content.get(id) ?? '' }))(),
      create: call('create', () => ok(900)),
      updateTitle: call('updateTitle', () => ok()),
      updateContent: (id: number, content: string) =>
        call('updateContent', () => {
          server.content.set(id, content)
          return ok()
        })(),
      delete: call('delete', () => ok()),
      uploadImage: call('uploadImage', () => ok({ url: 'https://img.example/1.png' })),
    }
  },
}))
vi.mock('./cloudStorageStore', () => ({
  cloudStorageStore: { userGroupId: { value: 5 }, boundBadge: () => badge },
}))
vi.mock('./noteOpenRequest', () => ({
  notesRefreshStore: { requestNotesRefresh: () => { state.refreshes += 1 } },
}))
vi.mock('@features/course/tabStore', () => ({ tabStore: { state: { activeTabId: 'other' } } }))
vi.mock('@shared/utils/logger', () => ({ createLogger: () => ({ debug() {}, info() {}, warn() {}, error() {} }) }))

import { buildManagedNoteTitle } from '@common/notesTypes'
import { yanhektWatchSink } from './yanhektWatchSink'

const identity = { courseId: '70101', sessionId: '850101' }
const title = buildManagedNoteTitle('课程 第1周', identity)
const entry = (tabId: string): YanhektWatchNoteEntry =>
  ({
    tabId,
    provider: 'yanhekt',
    displayName: '课程 第1周',
    identity,
    status: 'loading',
    noteId: null,
    content: { blocks: [] },
  }) as unknown as YanhektWatchNoteEntry

beforeEach(() => {
  servers.length = 0
  next = null
  badge = 'A'
  state.refreshes = 0
  vi.stubGlobal('fetch', async () => ({ arrayBuffer: async () => new ArrayBuffer(1) }))
})

describe('the Yanhekt watch-note sink', () => {
  it('leaves an existing note that is not an editor document untouched', async () => {
    next = serverFor('A')
    next.notes.push({ id: 41, title, note_group_id: 5 })
    next.content.set(41, '<p>written elsewhere</p>')
    const row = entry('t1')
    await yanhektWatchSink.open(row)
    expect(row.status).toBe('error')
    expect(row.noteId).toBeNull()
    expect(servers[0].calls).toEqual(['list', 'get'])
    yanhektWatchSink.dispose('t1')
  })

  it('removes a note it created but could not title, and reports the failure', async () => {
    next = serverFor('A')
    next.fail.add('updateTitle')
    const row = entry('t2')
    await yanhektWatchSink.open(row)
    expect(row.status).toBe('error')
    expect(servers[0].calls).toEqual(['list', 'create', 'updateTitle', 'delete'])
    expect(state.refreshes).toBe(0)
    yanhektWatchSink.dispose('t2')
  })

  it('removes a note it could not seed', async () => {
    next = serverFor('A')
    next.fail.add('updateContent')
    const row = entry('t3')
    await yanhektWatchSink.open(row)
    expect(row.status).toBe('error')
    expect(servers[0].calls.slice(-2)).toEqual(['updateContent', 'delete'])
    yanhektWatchSink.dispose('t3')
  })

  it('keeps writing a tab’s note with the account it was opened under', async () => {
    const row = entry('t4')
    await yanhektWatchSink.open(row)
    expect(row.status).toBe('ready')
    expect(servers).toHaveLength(1)
    expect(servers[0].badge).toBe('A')

    // Another account signs in; the tab's uploads still name account A, which
    // main refuses once A is no longer active.
    badge = 'B'
    yanhektWatchSink.deliver(row, [{ dataUrl: 'data:image/png;base64,AA==', pngFilename: 's.png' }] as never)
    await vi.waitFor(() => expect(servers[0].calls).toContain('uploadImage'))
    expect(servers).toHaveLength(1)

    // A new open binds to whoever is signed in then.
    yanhektWatchSink.dispose('t4')
    await yanhektWatchSink.open(entry('t4'))
    expect(servers[1].badge).toBe('B')
    yanhektWatchSink.dispose('t4')
  })
})
