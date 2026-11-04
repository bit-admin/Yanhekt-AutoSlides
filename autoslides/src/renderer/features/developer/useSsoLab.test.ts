import { describe, expect, it } from 'vitest'
import type { DevSsoStep } from '@common/devSso'
import { latestSelection } from './useSsoLab'

const step = (exchangeIds: number[]): DevSsoStep => ({
  id: 'load_login_page',
  state: 'done',
  reachedAt: 0,
  notes: {},
  exchanges: exchangeIds.map((id) => ({ id }) as DevSsoStep['exchanges'][number]),
})

describe('latestSelection', () => {
  it('follows the newest request, even past a step that has none yet', () => {
    expect(latestSelection([step([1, 2]), step([])])).toEqual({ step: 0, exchange: 2 })
  })

  it('falls back to the newest step before any request', () => {
    expect(latestSelection([step([])])).toEqual({ step: 0, exchange: null })
    expect(latestSelection([])).toBeNull()
  })
})
