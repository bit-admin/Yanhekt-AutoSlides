import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { NoteGroup, NoteSummary } from '@common/notesTypes'
import { MANAGED_GROUP_NAME, USER_GROUP_NAME, README_NOTE_TITLE } from '@common/notesTypes'
import { overrides } from '@shared/overrideRegistry'
import type { CloudNotesProvider } from '@shared/overrideRegistry'
import { configStore } from '@shared/services/configStore'
import { cloudStorageStore } from './cloudStorageStore'

// The store resolves its API via overrides.cloudNotesProvider, so tests inject a
// fake Yanhekt server. persistFlag goes through window.electronAPI.config — stub
// it globally (node environment has no window).
const setFlagMock = vi.fn(async (badge: string, value: boolean) => {
  const users = new Set(configStore.cloudStorageInitializedUsers ?? [])
  if (value) users.add(badge)
  else users.delete(badge)
  configStore.cloudStorageInitializedUsers = [...users]
})

;(globalThis as unknown as { window: unknown }).window = {
  electronAPI: { config: { setCloudStorageInitialized: setFlagMock } },
}

function noteSummary(id: number, title: string): NoteSummary {
  return {
    id, uuid: `u${id}`, type: 0, relevant_id: 0, root_id: 0, title,
    note_group_id: 0, deleted: 0, version: 1, created_at: '', updated_at: '',
  }
}

interface FakeServer {
  provider: CloudNotesProvider
  groups: NoteGroup[]
  notes: NoteSummary[]
  groupCreate: ReturnType<typeof vi.fn>
  noteCreate: ReturnType<typeof vi.fn>
}

function makeServer(opts: { groups?: NoteGroup[]; notes?: NoteSummary[]; groupListError?: string } = {}): FakeServer {
  const groups: NoteGroup[] = opts.groups ?? []
  const notes: NoteSummary[] = opts.notes ?? []
  let nextId = 1000
  const groupCreate = vi.fn(async (name: string) => {
    groups.push({ id: 500 + groups.length, name })
    return { ok: true as const, data: undefined }
  })
  const noteCreate = vi.fn(async () => {
    const id = nextId++
    notes.push(noteSummary(id, ''))
    return { ok: true as const, data: id }
  })
  const provider: CloudNotesProvider = {
    list: async () => ({
      ok: true,
      data: { current_page: 1, data: notes, total: notes.length, per_page: '500', last_page: 1 },
    }),
    get: async () => ({ ok: false, error: 'unused' }),
    shortenShareUrl: async () => ({ ok: false, error: 'unused' }),
    create: noteCreate,
    updateTitle: async (id, title) => {
      const n = notes.find((x) => x.id === id)
      if (n) n.title = title
      return { ok: true, data: undefined }
    },
    updateContent: async () => ({ ok: true, data: undefined }),
    moveToGroup: async (id: number) => ({ ok: true, data: id }),
    delete: async () => ({ ok: true, data: undefined }),
    groupList: async () =>
      opts.groupListError ? { ok: false, error: opts.groupListError } : { ok: true, data: [...groups] },
    groupCreate,
    groupDelete: async () => ({ ok: true, data: undefined }),
    uploadImage: async () => ({ ok: false, error: 'unused' }),
  }
  return { provider, groups, notes, groupCreate, noteCreate }
}

beforeEach(() => {
  configStore.cloudStorageInitializedUsers = []
  setFlagMock.mockClear()
  cloudStorageStore.setUser(null)
})

describe('cloudStorageStore.refresh', () => {
  it('reports not-signed-in without provisioning', async () => {
    const srv = makeServer({ groupListError: 'not-signed-in' })
    overrides.cloudNotesProvider = srv.provider
    cloudStorageStore.setUser('badge1')

    expect(await cloudStorageStore.refresh()).toBe('not-signed-in')
    expect(cloudStorageStore.blocked.value).toBe(true)
    expect(srv.groupCreate).not.toHaveBeenCalled()
  })

  it('reports error on transient failure without provisioning or reclassifying', async () => {
    const srv = makeServer({ groupListError: 'network' })
    overrides.cloudNotesProvider = srv.provider
    cloudStorageStore.setUser('badge1')

    expect(await cloudStorageStore.refresh()).toBe('error')
    expect(cloudStorageStore.lastError.value).toBe('network')
    expect(cloudStorageStore.blocked.value).toBe(false)
    expect(srv.groupCreate).not.toHaveBeenCalled()
  })

  it('never auto-initializes a never-initialized account (the duplicate-group bug)', async () => {
    const srv = makeServer()
    overrides.cloudNotesProvider = srv.provider
    cloudStorageStore.setUser('badge1')

    expect(await cloudStorageStore.refresh()).toBe('uninitialized')
    expect(await cloudStorageStore.ensureReady()).toBe('uninitialized')
    expect(srv.groupCreate).not.toHaveBeenCalled()
    expect(cloudStorageStore.blocked.value).toBe(true)
  })

  it('adopts both managed groups and self-heals the missing flag', async () => {
    const srv = makeServer({
      groups: [
        { id: 7, name: MANAGED_GROUP_NAME },
        { id: 8, name: USER_GROUP_NAME },
      ],
    })
    overrides.cloudNotesProvider = srv.provider
    cloudStorageStore.setUser('badge1')

    expect(await cloudStorageStore.refresh()).toBe('ready')
    expect(cloudStorageStore.managedGroupId.value).toBe(7)
    expect(cloudStorageStore.userGroupId.value).toBe(8)
    expect(srv.groupCreate).not.toHaveBeenCalled()
    expect(setFlagMock).toHaveBeenCalledWith('badge1', true)
  })

  it('stays uninitialized when only one managed group exists and no flag is set', async () => {
    const srv = makeServer({ groups: [{ id: 7, name: MANAGED_GROUP_NAME }] })
    overrides.cloudNotesProvider = srv.provider
    cloudStorageStore.setUser('badge1')

    // ASnote alone is not "ready" — the ASuser group must exist too. Without the
    // flag we never auto-provision, so it reports uninitialized.
    expect(await cloudStorageStore.refresh()).toBe('uninitialized')
    expect(srv.groupCreate).not.toHaveBeenCalled()
  })

  it('treats the first managed group as canonical when duplicates exist', async () => {
    const srv = makeServer({
      groups: [
        { id: 3, name: MANAGED_GROUP_NAME },
        { id: 9, name: MANAGED_GROUP_NAME },
        { id: 8, name: USER_GROUP_NAME },
      ],
    })
    overrides.cloudNotesProvider = srv.provider
    cloudStorageStore.setUser('badge1')

    expect(await cloudStorageStore.refresh()).toBe('ready')
    expect(cloudStorageStore.managedGroupId.value).toBe(3)
    expect(srv.groupCreate).not.toHaveBeenCalled()
  })

  it('auto re-provisions the missing group when the flag is set (deleted server-side)', async () => {
    // ASnote present, ASuser deleted: an initialized account re-provisions only
    // the missing ASuser group.
    const srv = makeServer({
      groups: [{ id: 7, name: MANAGED_GROUP_NAME }],
      notes: [noteSummary(1, README_NOTE_TITLE)],
    })
    overrides.cloudNotesProvider = srv.provider
    configStore.cloudStorageInitializedUsers = ['badge1']
    cloudStorageStore.setUser('badge1')

    expect(await cloudStorageStore.refresh()).toBe('ready')
    expect(srv.groupCreate).toHaveBeenCalledTimes(1)
    expect(srv.groupCreate).toHaveBeenCalledWith(USER_GROUP_NAME)
    // README already existed — no new note.
    expect(srv.noteCreate).not.toHaveBeenCalled()
    expect(cloudStorageStore.managedGroupId.value).toBe(7)
    expect(cloudStorageStore.userGroupId.value).not.toBeNull()
  })
})

describe('cloudStorageStore.initialize', () => {
  it('provisions group + README and persists the flag', async () => {
    const srv = makeServer()
    overrides.cloudNotesProvider = srv.provider
    cloudStorageStore.setUser('badge1')
    await cloudStorageStore.refresh()
    expect(cloudStorageStore.status.value).toBe('uninitialized')

    expect(await cloudStorageStore.initialize()).toBe(true)
    expect(cloudStorageStore.status.value).toBe('ready')
    // Both managed groups (ASnote + ASuser) are created.
    expect(srv.groupCreate).toHaveBeenCalledTimes(2)
    expect(srv.groupCreate).toHaveBeenCalledWith(MANAGED_GROUP_NAME)
    expect(srv.groupCreate).toHaveBeenCalledWith(USER_GROUP_NAME)
    expect(cloudStorageStore.managedGroupId.value).not.toBeNull()
    expect(cloudStorageStore.userGroupId.value).not.toBeNull()
    expect(srv.notes.some((n) => n.title === README_NOTE_TITLE)).toBe(true)
    expect(setFlagMock).toHaveBeenCalledWith('badge1', true)
    expect(configStore.cloudStorageInitializedUsers).toContain('badge1')
  })

  it('is idempotent when both groups already exist (no duplicate group)', async () => {
    const srv = makeServer({
      groups: [
        { id: 7, name: MANAGED_GROUP_NAME },
        { id: 8, name: USER_GROUP_NAME },
      ],
      notes: [noteSummary(1, README_NOTE_TITLE)],
    })
    overrides.cloudNotesProvider = srv.provider
    cloudStorageStore.setUser('badge1')

    expect(await cloudStorageStore.initialize()).toBe(true)
    expect(srv.groupCreate).not.toHaveBeenCalled()
    expect(srv.noteCreate).not.toHaveBeenCalled()
  })

  it('serializes concurrent triggers so each group is created exactly once', async () => {
    const srv = makeServer()
    overrides.cloudNotesProvider = srv.provider
    configStore.cloudStorageInitializedUsers = ['badge1']
    cloudStorageStore.setUser('badge1')

    // Two surfaces racing (e.g. launch check + an import click): the second
    // waits out the first and re-reads the server, which now has the groups.
    // A single provision run creates each group once (2 total), not 4.
    const [a, b] = await Promise.all([
      cloudStorageStore.ensureReady(),
      cloudStorageStore.ensureReady(),
    ])
    expect(a).toBe('ready')
    expect(b).toBe('ready')
    expect(srv.groupCreate).toHaveBeenCalledTimes(2)
  })
})

describe('cloudStorageStore across an account switch', () => {
  const managed = (): NoteGroup[] => [
    { id: 1, name: MANAGED_GROUP_NAME },
    { id: 2, name: USER_GROUP_NAME },
  ]

  /** A server whose group list answers only when the test says so. */
  function slowServer() {
    const srv = makeServer()
    const listCalls: Array<(groups: NoteGroup[]) => void> = []
    srv.provider.groupList = () =>
      new Promise((resolve) => listCalls.push((groups) => resolve({ ok: true, data: groups })))
    overrides.cloudNotesProvider = srv.provider
    return { srv, listCalls }
  }

  it("the new account's check is its own, not a join of the one still running", async () => {
    const { listCalls } = slowServer()
    cloudStorageStore.setUser('badgeA')
    const checkA = cloudStorageStore.refresh()
    cloudStorageStore.setUser('badgeB')
    const checkB = cloudStorageStore.refresh()
    expect(listCalls).toHaveLength(2)

    // A's answer (initialized) lands after the switch: it is not B's state.
    listCalls[0](managed())
    await checkA
    expect(cloudStorageStore.status.value).toBe('checking')
    expect(cloudStorageStore.managedGroupId.value).toBeNull()
    expect(setFlagMock).not.toHaveBeenCalled()

    listCalls[1]([])
    expect(await checkB).toBe('uninitialized')
    expect(cloudStorageStore.managedGroupId.value).toBeNull()
    expect(configStore.cloudStorageInitializedUsers).toEqual([])
  })

  it('a provision cut short by a switch makes no further groups and sets no flag', async () => {
    const { srv, listCalls } = slowServer()
    cloudStorageStore.setUser('badgeA')
    const init = cloudStorageStore.initialize()
    await Promise.resolve()
    expect(listCalls).toHaveLength(1)

    cloudStorageStore.setUser('badgeB')
    listCalls[0]([])
    expect(await init).toBe(false)
    expect(srv.groupCreate).not.toHaveBeenCalled()
    expect(setFlagMock).not.toHaveBeenCalled()
    expect(cloudStorageStore.status.value).toBe('unknown')
  })

  it('a check finished for the old account does not end the lock of the new one', async () => {
    const { listCalls } = slowServer()
    cloudStorageStore.setUser('badgeA')
    const checkA = cloudStorageStore.refresh()
    cloudStorageStore.setUser('badgeB')
    const checkB = cloudStorageStore.refresh()
    listCalls[0]([])
    await checkA
    // B's check is still the one in flight: a second caller joins it instead of asking again.
    const joined = cloudStorageStore.refresh()
    expect(listCalls).toHaveLength(2)
    listCalls[1](managed())
    expect(await checkB).toBe('ready')
    expect(await joined).toBe('ready')
    expect(configStore.cloudStorageInitializedUsers).toEqual(['badgeB'])
  })
})
