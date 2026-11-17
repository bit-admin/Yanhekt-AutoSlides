import { beforeEach, describe, expect, it, vi } from 'vitest'

const reports: Array<{ sessionId: string; bucket: number; token: string }> = []
const resumes: Array<{ sessionId: string; token: string; answer: (position: number | null) => void }> = []
let token: string | null = 'A'

vi.mock('./apiClient', () => ({
  ApiClient: class {
    reportWatchProgress(sessionId: string, bucket: number, t: string) {
      reports.push({ sessionId, bucket, token: t })
      return Promise.resolve()
    }
    getResumePosition(sessionId: string, t: string) {
      return new Promise<number | null>((answer) => resumes.push({ sessionId, token: t, answer }))
    }
  },
}))
vi.mock('./authService', () => ({ tokenManager: { getToken: () => token } }))
vi.mock('@shared/utils/logger', () => ({ createLogger: () => ({ debug() {}, info() {}, warn() {}, error() {} }) }))

import { createWatchProgressSync } from './watchProgressService'

let sessionId: string | undefined = '70101'
let time = 0
const sync = () =>
  createWatchProgressSync({
    sessionId: () => sessionId,
    enabled: () => true,
    getCurrentTime: () => time,
    isPlaying: () => true,
  })

beforeEach(() => {
  reports.length = 0
  resumes.length = 0
  token = 'A'
  sessionId = '70101'
  time = 0
})

describe('watch progress across an account switch', () => {
  it('reports the same position again for the next account', () => {
    const progress = sync()
    time = 62
    progress.stop()
    progress.stop()
    expect(reports).toEqual([{ sessionId: '70101', bucket: 60, token: 'A' }])

    token = 'B'
    progress.stop()
    expect(reports[1]).toEqual({ sessionId: '70101', bucket: 60, token: 'B' })
  })

  it('gives no position when the answer is for the previous account', async () => {
    const progress = sync()
    const resumed = progress.resume()
    token = 'B'
    resumes[0].answer(300)
    expect(await resumed).toBeNull()

    // Nothing was recorded for A's position either: B's report at 300 lands.
    time = 300
    progress.stop()
    expect(reports).toEqual([{ sessionId: '70101', bucket: 300, token: 'B' }])
  })

  it('gives no position when another lecture opened meanwhile', async () => {
    const progress = sync()
    const resumed = progress.resume()
    sessionId = '70102'
    resumes[0].answer(300)
    expect(await resumed).toBeNull()
  })

  it('still resumes and skips the bucket the server already has', async () => {
    const progress = sync()
    const resumed = progress.resume()
    resumes[0].answer(300)
    expect(await resumed).toBe(300)
    time = 301
    progress.stop()
    expect(reports).toEqual([])
  })
})
