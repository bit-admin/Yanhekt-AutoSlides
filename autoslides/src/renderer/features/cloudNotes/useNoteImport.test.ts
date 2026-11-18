import { ref } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('./cloudStorageStore', () => ({ cloudStorageStore: { managedGroupId: { value: 5 } } }))

import { useNoteImport } from './useNoteImport'

const calls: string[] = []
const answer = (name: string, data: unknown = undefined) => async () => {
  calls.push(name)
  return { ok: true as const, data }
}
const api = {
  create: answer('create', 900),
  updateTitle: answer('updateTitle'),
  uploadImageFromPath: answer('upload', { url: 'https://img.example/1.png' }),
  updateContent: answer('updateContent'),
  delete: answer('delete'),
}

const catalog = ref<'complete' | 'truncated' | 'failed'>('complete')
const cn = {
  loadAll: async () => {},
  refreshGroups: async () => {},
  allNotes: ref([]),
  managedGroups: ref([]),
  catalog,
  notesApi: () => api,
}
const folder = { name: 'slides_课程_第1周__c70101s850101', path: '/out/a', imageCount: 1 }
const build = () =>
  useNoteImport(cn as never, { meta: () => '', slideCaption: () => '' })

beforeEach(() => {
  calls.length = 0
  catalog.value = 'complete'
  vi.stubGlobal('window', {
    electronAPI: {
      pdfmaker: {
        getFolders: async () => [folder],
        getImages: async () => [{ name: 'Slide_001.png', path: '/out/a/Slide_001.png' }],
      },
      slideMetadata: { get: async () => null },
      slideTimeline: { get: async () => null },
    },
  })
})

describe('note import and the note list it checks against', () => {
  it('imports through the calls of the account it began under', async () => {
    const imp = build()
    await imp.startImport([folder.name])
    expect(imp.queue.value[0].status).toBe('done')
    expect(calls).toEqual(['create', 'updateTitle', 'upload', 'updateContent'])
  })

  it('creates nothing when the note list could not be read in full', async () => {
    catalog.value = 'failed'
    const imp = build()
    await imp.startImport([folder.name])
    expect(imp.queue.value[0]).toMatchObject({ status: 'error', error: 'list-incomplete' })
    expect(calls).toEqual([])
    expect(await imp.syncFolder(folder.name)).toBe('error')
    expect(await imp.resyncFolder(folder.name)).toBe('error')
    expect(calls).toEqual([])
  })
})
