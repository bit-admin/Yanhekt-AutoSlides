import { describe, expect, it } from 'vitest'
import { migrateLegacyWatchSync, normalizeWatchNotesProvider } from './watchNotesProviders'

describe('migrateLegacyWatchSync', () => {
  it('does nothing without the legacy key', () => {
    expect(migrateLegacyWatchSync(false, undefined)).toBeNull()
  })

  it('carries an enabled legacy sync over to the Yanhekt provider', () => {
    expect(migrateLegacyWatchSync(true, true)).toEqual({ watchNotesEnabled: true, watchNotesProvider: 'yanhekt' })
  })

  it('migrates anything but true as disabled', () => {
    expect(migrateLegacyWatchSync(true, false)?.watchNotesEnabled).toBe(false)
    expect(migrateLegacyWatchSync(true, 'true')?.watchNotesEnabled).toBe(false)
  })
})

describe('normalizeWatchNotesProvider', () => {
  it('keeps a known id and falls back for unknown values', () => {
    expect(normalizeWatchNotesProvider('yanhekt')).toBe('yanhekt')
    expect(normalizeWatchNotesProvider('obsidian')).toBe('yanhekt')
    expect(normalizeWatchNotesProvider(undefined)).toBe('yanhekt')
  })
})
