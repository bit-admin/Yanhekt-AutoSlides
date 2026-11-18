import { beforeEach, describe, expect, it, vi } from 'vitest'

type Listener = (event: { data?: unknown }) => void
const made = vi.hoisted(() => [] as Array<{ sent: Array<Record<string, unknown>>; emit: (type: string, data?: unknown) => void; terminated: boolean }>)

vi.mock('@shared/workers/slideClassifier.worker?worker', () => ({
  default: class {
    sent: Array<Record<string, unknown>> = []
    terminated = false
    private listeners = new Map<string, Listener[]>()
    constructor() {
      made.push(this)
    }
    postMessage(message: Record<string, unknown>) {
      this.sent.push(message)
    }
    terminate() {
      this.terminated = true
    }
    addEventListener(type: string, listener: Listener) {
      this.listeners.set(type, [...(this.listeners.get(type) ?? []), listener])
    }
    emit(type: string, data?: unknown) {
      for (const listener of this.listeners.get(type) ?? []) listener({ data })
    }
  },
}))
vi.mock('@shared/utils/logger', () => ({ createLogger: () => ({ debug() {}, info() {}, warn() {}, error() {} }) }))

import { classifyImage, ensureMlClassifierReady, resetMlClassifier } from './mlClassifierClient'

const settle = async () => {
  for (let i = 0; i < 6; i += 1) await Promise.resolve()
}
const answer = (index: number, at: number, extra: Record<string, unknown> = {}) =>
  made[index].emit('message', { id: made[index].sent[at].id, success: true, ...extra })
const outcome = (promise: Promise<unknown>) => promise.then(() => 'ok', (error: Error) => error.message)

beforeEach(() => {
  resetMlClassifier()
  made.length = 0
  vi.stubGlobal('window', { electronAPI: { mlClassifier: { getModelBuffer: async () => new ArrayBuffer(4) } } })
})

describe('the slide classifier worker', () => {
  it('fails a classification when the worker crashes, and works again afterwards', async () => {
    const first = outcome(classifyImage({} as ImageData))
    await settle()
    made[0].emit('error')
    expect(await first).toContain('worker reported an error')

    const second = classifyImage({} as ImageData)
    await settle()
    expect(made).toHaveLength(2)
    answer(1, 0)
    await settle()
    answer(1, 1, { result: { label: 'slide' } })
    expect(await second).toEqual({ label: 'slide' })
  })

  it('ends a start that a reset interrupts, without marking the new worker ready', async () => {
    const starting = outcome(ensureMlClassifierReady())
    await settle()
    resetMlClassifier()
    expect(await starting).toContain('stopped')

    // The next call starts the model again on a fresh worker.
    const again = ensureMlClassifierReady()
    await settle()
    expect(made).toHaveLength(2)
    expect(made[1].sent[0].type).toBe('init')
    answer(1, 0)
    await again
  })

  it('shares one start between callers and lets a failed start be retried', async () => {
    const a = outcome(ensureMlClassifierReady())
    const b = outcome(ensureMlClassifierReady())
    await settle()
    expect(made[0].sent).toHaveLength(1)
    made[0].emit('message', { id: made[0].sent[0].id, success: false, error: 'bad model' })
    expect(await a).toBe('bad model')
    expect(await b).toBe('bad model')

    const retry = ensureMlClassifierReady()
    await settle()
    expect(made[0].sent).toHaveLength(2)
    answer(0, 1)
    await retry
  })
})
