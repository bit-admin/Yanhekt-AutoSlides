import { describe, expect, it } from 'vitest'
import {
  isWatchNotesChoice,
  isWatchNotesProvider,
  normalizeWatchNotesProvider,
  WATCH_NOTES_CHOICES,
  WATCH_NOTES_PROVIDERS,
} from './watchNotesProviders'

describe('desktop watch notes providers', () => {
  it('offers Off, Obsidian and Notion; only the last two are providers', () => {
    expect(WATCH_NOTES_CHOICES).toEqual(['off', 'obsidian', 'notion'])
    for (const choice of WATCH_NOTES_CHOICES) {
      expect(isWatchNotesChoice(choice)).toBe(true)
      expect(normalizeWatchNotesProvider(choice)).toBe(choice)
    }
    for (const provider of WATCH_NOTES_PROVIDERS) expect(isWatchNotesProvider(provider)).toBe(true)
    expect(isWatchNotesProvider('off')).toBe(false)
  })

  it('reads the retired Yanhekt provider and anything unknown as Off', () => {
    expect(isWatchNotesChoice('yanhekt')).toBe(false)
    expect(normalizeWatchNotesProvider('yanhekt')).toBe('off')
    expect(normalizeWatchNotesProvider(undefined)).toBe('off')
  })
})
