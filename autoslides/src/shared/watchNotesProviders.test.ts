import { describe, expect, it } from 'vitest'
import { isWatchNotesProvider, normalizeWatchNotesProvider, WATCH_NOTES_PROVIDERS } from './watchNotesProviders'

describe('desktop watch notes providers', () => {
  it('accepts only Obsidian and Notion', () => {
    for (const provider of WATCH_NOTES_PROVIDERS) {
      expect(isWatchNotesProvider(provider)).toBe(true)
      expect(normalizeWatchNotesProvider(provider)).toBe(provider)
    }
    expect(isWatchNotesProvider('yanhekt')).toBe(false)
    expect(normalizeWatchNotesProvider('yanhekt')).toBe('obsidian')
    expect(normalizeWatchNotesProvider(undefined)).toBe('obsidian')
  })
})
