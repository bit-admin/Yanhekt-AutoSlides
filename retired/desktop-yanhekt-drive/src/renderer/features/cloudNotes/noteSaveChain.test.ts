import { describe, expect, it } from 'vitest'
import { createNoteSaveChain, type NoteSnapshot } from './noteSaveChain'

const snap = (text: string): NoteSnapshot => ({ blocks: text, content: `doc:${text}` })

/** A server that takes whole-content writes and lets the test decide when each one lands. */
function fakeServer() {
  let stored = 'doc:v0'
  const writes: Array<{ content: string; finish: (ok: boolean) => void }> = []
  const write = (content: string): Promise<boolean> =>
    new Promise((resolve) => {
      writes.push({
        content,
        finish: (ok) => {
          if (ok) stored = content
          resolve(ok)
        },
      })
    })
  return { write, writes, stored: () => stored }
}

const tick = () => new Promise((resolve) => setTimeout(resolve, 0))

describe('the saves of one note', () => {
  it('sends nothing when the content is what was loaded', async () => {
    const server = fakeServer()
    const chain = createNoteSaveChain(server.write)
    chain.setBaseline('v0')
    expect(await chain.save(snap('v0'))).toBe(true)
    expect(server.writes).toHaveLength(0)
    expect(chain.dirty).toBe(false)
  })

  it('never has two writes out at once, so the newest content is what the server ends with', async () => {
    const server = fakeServer()
    const chain = createNoteSaveChain(server.write)
    chain.setBaseline('v0')
    const first = chain.save(snap('v1'))
    const second = chain.save(snap('v2'))
    await tick()
    expect(server.writes.map((w) => w.content)).toEqual(['doc:v1'])

    server.writes[0].finish(true)
    await tick()
    expect(server.writes.map((w) => w.content)).toEqual(['doc:v1', 'doc:v2'])
    server.writes[1].finish(true)
    expect(await first).toBe(true)
    expect(await second).toBe(true)
    expect(server.stored()).toBe('doc:v2')
    expect(chain.dirty).toBe(false)
  })

  it('sends only the newest of the snapshots that waited', async () => {
    const server = fakeServer()
    const chain = createNoteSaveChain(server.write)
    chain.setBaseline('v0')
    void chain.save(snap('v1'))
    void chain.save(snap('v2'))
    const last = chain.save(snap('v3'))
    await tick()
    server.writes[0].finish(true)
    await tick()
    server.writes[1].finish(true)
    await last
    expect(server.writes.map((w) => w.content)).toEqual(['doc:v1', 'doc:v3'])
  })

  it('stays dirty after a failed write and sends the same content again when asked', async () => {
    const server = fakeServer()
    const settled: boolean[] = []
    const chain = createNoteSaveChain(server.write, { onSettled: (saved) => settled.push(saved) })
    chain.setBaseline('v0')
    const failedSave = chain.save(snap('v1'))
    await tick()
    server.writes[0].finish(false)
    expect(await failedSave).toBe(false)
    expect(chain.dirty).toBe(true)
    expect(settled).toEqual([false])

    const retry = chain.save(snap('v1'))
    await tick()
    server.writes[1].finish(true)
    expect(await retry).toBe(true)
    expect(chain.dirty).toBe(false)
    expect(server.stored()).toBe('doc:v1')
  })

  it('treats a write that throws as a failed write', async () => {
    const chain = createNoteSaveChain(async () => {
      throw new Error('offline')
    })
    chain.setBaseline('v0')
    expect(await chain.save(snap('v1'))).toBe(false)
    expect(chain.dirty).toBe(true)
  })

  it('keeps its own baseline: a late save of another note changes nothing here', async () => {
    const serverA = fakeServer()
    const serverB = fakeServer()
    const noteA = createNoteSaveChain(serverA.write)
    noteA.setBaseline('a0')
    const lateSave = noteA.save(snap('a1'))
    await tick()

    // The editor moved on to note B while A's write is still out.
    noteA.close()
    const noteB = createNoteSaveChain(serverB.write)
    noteB.setBaseline('b0')
    serverA.writes[0].finish(true)
    expect(await lateSave).toBe(false)

    // B's unchanged content is still "unchanged", and an edit of B is sent.
    expect(await noteB.save(snap('b0'))).toBe(true)
    expect(serverB.writes).toHaveLength(0)
    const edit = noteB.save(snap('b1'))
    await tick()
    serverB.writes[0].finish(true)
    expect(await edit).toBe(true)
  })

  it('sends nothing after it is closed', async () => {
    const server = fakeServer()
    const chain = createNoteSaveChain(server.write)
    chain.setBaseline('v0')
    void chain.save(snap('v1'))
    void chain.save(snap('v2'))
    await tick()
    chain.close()
    server.writes[0].finish(true)
    await tick()
    expect(await chain.save(snap('v3'))).toBe(false)
    expect(server.writes.map((w) => w.content)).toEqual(['doc:v1'])
  })
})
